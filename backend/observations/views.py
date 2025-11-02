from django.shortcuts import render
import json
from datetime import datetime, timezone
from django.utils.timezone import make_aware
import uuid
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Observation
from .serializer import ObservationSerializer
from .qc import compute_qc
from .qc_summary import parse_params, bin_blur, bin_brightness, ema_series, cached_json, verify_supabase_jwt
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncDate, TruncHour
import os
import os
import logging
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from .authentication import SupabaseJWTAuthentication
from .serializer import GameProfileSerializer
from .models import GameProfile
from django.conf import settings

try:
    from utils.storage import upload_bytes
    from utils.storage import signed_url as storage_signed_url
    from utils.storage import download_bytes
except Exception:
    upload_bytes = None
    logging.getLogger(__name__).info(
        'utils.storage not available; skipping supabase uploads')
    storage_signed_url = None
    download_bytes = None

# Create your views here.
ISO_FORMATS = [
    '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%S.%f',
    '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S'
]


def parse_iso(dt: str):
    if not dt:
        return None
    for fmt in ISO_FORMATS:
        try:
            parsed = datetime.strptime(dt, fmt)
            # If no timezone info, make it aware (assume UTC or local timezone)
            if parsed.tzinfo is None:
                parsed = make_aware(parsed, timezone.utc)
            return parsed
        except Exception:
            pass
    try:
        parsed = datetime.fromisoformat(dt.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            parsed = make_aware(parsed, timezone.utc)
        return parsed
    except Exception:
        return None


class ObservationListCreate(APIView):
    def get(self, request):
        qs = Observation.objects.order_by('-created_at')[:50]
        data = ObservationSerializer(qs, many=True, context={
                                     'request': request}).data
        return Response({'results': data})

    def post(self, request):
        # Extract uploaded file
        file = request.FILES.get('image')
        if not file:
            return Response({'detail': 'image is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Extract metadata
        raw = request.data.get('metadata', '{}')
        try:
            meta = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            return Response({'detail': 'metadata must be valid JSON string'}, status=status.HTTP_400_BAD_REQUEST)

        # Extract and format datetime
        dt = parse_iso(meta.get('captured_at'))
        if dt is None:
            return Response({'detail': 'captured_at (ISO8601) is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create observation
        # Allow client-supplied UUID but validate it. If the client provided a non-UUID
        # value (e.g. a numeric timestamp), ignore it so the DB will generate a proper UUID.
        obs_id = None
        raw_id = meta.get('id')
        if raw_id:
            try:
                # Ensure it's a valid UUID string/object
                # Accept both UUID instances and strings
                if isinstance(raw_id, uuid.UUID):
                    obs_id = raw_id
                else:
                    obs_id = uuid.UUID(str(raw_id))
            except Exception:
                logging.getLogger(__name__).warning(
                    'Invalid client id provided, ignoring: %r', raw_id)

        # Build creation kwargs and attach authenticated user when available
        create_kwargs = dict(
            id=obs_id,
            image=file,
            captured_at=dt,
            lat=meta.get('lat'),
            lon=meta.get('lon'),
            location_accuracy_m=meta.get('location_accuracy_m'),
            device_info=meta.get('device_info'),
            notes=meta.get('notes'),
            status='received',
        )

        if getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
            create_kwargs['user'] = request.user

        obs = Observation.objects.create(**create_kwargs)

        # Try to upload to Supabase storage if helper available and env configured
        try:
            if upload_bytes and os.environ.get('SUPABASE_URL') and os.environ.get('STORAGE_BUCKET_OBS') and getattr(obs, 'image', None):
                # read local file bytes
                local_path = getattr(obs.image, 'path', None)
                if local_path and os.path.exists(local_path):
                    with open(local_path, 'rb') as fh:
                        data = fh.read()
                    ext = os.path.splitext(obs.image.name)[
                        1].lstrip('.') or 'jpg'
                    path = f"{obs.id}.{ext}"
                    uri = upload_bytes(os.environ.get('STORAGE_BUCKET_OBS'), path, data, content_type=getattr(
                        obs.image.file, 'content_type', 'image/jpeg'))
                    if uri:
                        obs.image_url = uri
                        obs.save(update_fields=['image_url', 'updated_at'])
        except Exception as e:
            logging.getLogger(__name__).warning(
                'Supabase upload failed: %s', e)

        # Enqueue background processing (QC + segmentation) so uploads return fast.
        try:
            # Enqueue presence classification first so workers can decide to
            # skip expensive segmentation when the image contains no target.
            from .tasks import run_qc_and_segmentation, segment_and_cover, classify_presence

            # schedule presence classification (async if possible)
            try:
                classify_presence.delay(str(obs.id))
            except Exception:
                # fallback: call synchronously if Celery not configured
                try:
                    classify_presence(str(obs.id))
                except Exception:
                    pass

            # schedule QC (will compute qc and update obs)
            try:
                run_qc_and_segmentation.delay(str(obs.id))
            except Exception:
                # fallback: call synchronously if Celery not configured
                try:
                    run_qc_and_segmentation(str(obs.id))
                except Exception:
                    pass

            # Do not enqueue segmentation here. Segmentation will be scheduled
            # by the presence classifier only when the image is labeled
            # 'present' to avoid unnecessary work for absent images.
        except Exception:
            # If task imports fail, continue without background processing
            pass

        serializer = ObservationSerializer(obs, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ObservationSignedUrl(APIView):
    """Return a signed URL for an observation's uploaded image (if available).

    GET /v1/observations/<id>/signed_url
    """

    def get(self, request, obs_id):
        try:
            obs = Observation.objects.get(id=obs_id)
        except Observation.DoesNotExist:
            return Response({'detail': 'not found'}, status=status.HTTP_404_NOT_FOUND)

        # Prefer an explicit image_url (supabase://bucket/path) set by server-side upload
        if getattr(obs, 'image_url', None):
            # parse image_url like supabase://bucket/path
            uri = obs.image_url
            if uri.startswith('supabase://') and storage_signed_url:
                try:
                    # extract bucket and path
                    _, rest = uri.split('://', 1)
                    bucket, path = rest.split('/', 1)
                    signed = storage_signed_url(bucket, path, expires_sec=600)
                    return Response({'signed_url': signed})
                except Exception as e:
                    logging.getLogger(__name__).warning(
                        'signed url creation failed: %s', e)
                    return Response({'detail': 'signed url creation failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Fallback: if we have image file stored by Django ImageField, try to create signed url
        if storage_signed_url and getattr(obs, 'image', None):
            # If image field name is like observations/2025/09/..., we need the storage path
            # Here we assume server-side upload used obs.id.<ext> and STORAGE_BUCKET_OBS is used
            bucket = os.environ.get('STORAGE_BUCKET_OBS')
            if bucket and obs.image:
                # create path that server-side upload uses: f"{obs.id}.{ext}"
                ext = os.path.splitext(obs.image.name)[1].lstrip('.') or 'jpg'
                path = f"{obs.id}.{ext}"
                try:
                    signed = storage_signed_url(bucket, path, expires_sec=600)
                    return Response({'signed_url': signed})
                except Exception as e:
                    logging.getLogger(__name__).warning(
                        'signed url creation failed: %s', e)

        return Response({'detail': 'signed url not available'}, status=status.HTTP_404_NOT_FOUND)


class ObservationRefCreate(APIView):
    """Create an Observation record that references an already-uploaded object in Supabase Storage.

    POST /v1/observations/ref
    Body JSON: { bucket: str, path: str, captured_at?: ISO8601, lat?: float, lon?: float }
    """

    def post(self, request):
        try:
            data = request.data
            bucket = data.get('bucket')
            path = data.get('path')
            if not bucket or not path:
                return Response({'detail': 'bucket and path are required'}, status=status.HTTP_400_BAD_REQUEST)

            captured_at = None
            if data.get('captured_at'):
                captured_at = parse_iso(data.get('captured_at'))

            create_kwargs = dict(
                image_url=f"supabase://{bucket}/{path}",
                captured_at=captured_at or None,
                lat=data.get('lat'),
                lon=data.get('lon'),
                status='queued',
            )
            if getattr(request, 'user', None) and getattr(request.user, 'is_authenticated', False):
                create_kwargs['user'] = request.user

            obs = Observation.objects.create(**create_kwargs)

            # Try immediate QC by downloading the object from Supabase (service role)
            did_qc = False
            try:
                if download_bytes:
                    raw = download_bytes(bucket, path)
                    # normalize various return shapes
                    if isinstance(raw, dict):
                        # supabase-py may return {'data': b'...'}
                        raw = raw.get('data') or raw.get(
                            'body') or raw.get('content')
                    if raw:
                        import tempfile
                        import os
                        suffix = os.path.splitext(path)[1] or '.jpg'
                        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tf:
                            tf.write(raw)
                            tmpname = tf.name
                        try:
                            qc = compute_qc(tmpname)
                            obs.qc = qc
                            obs.qc_score = qc.get('score')
                            obs.status = 'done'
                            obs.save(update_fields=[
                                     'qc', 'qc_score', 'status', 'updated_at'])
                            did_qc = True
                        finally:
                            try:
                                os.unlink(tmpname)
                            except Exception:
                                pass
            except Exception as e:
                logging.getLogger(__name__).warning(
                    'Immediate QC failed: %s', e)

            # If immediate QC not performed, enqueue worker if available
            # Enqueue presence classification so downstream workers can skip
            # segmentation when the image is absent.
            try:
                from .tasks import classify_presence
                try:
                    classify_presence.delay(str(obs.id))
                except Exception:
                    try:
                        classify_presence(str(obs.id))
                    except Exception:
                        pass
            except Exception:
                pass

            # If immediate QC was not performed, enqueue QC for the worker.
            if not did_qc:
                try:
                    from .tasks import run_qc_and_segmentation
                    run_qc_and_segmentation.delay(str(obs.id))
                except Exception:
                    pass

            # also enqueue segmentation task (will handle download/upload)
            # NOTE: segmentation is intentionally NOT enqueued here; the
            # presence classifier will schedule it when appropriate.

            serializer = ObservationSerializer(
                obs, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logging.getLogger(__name__).exception(
                'failed to create observation ref')
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def qc_summary(request):
    # parse and validate params
    try:
        params = parse_params(request)
    except ValidationError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # Verify JWT from Authorization header (Supabase). For local/dev testing you can
    # set QC_SUMMARY_ALLOW_DEV=1 to bypass verification.
    dev_bypass = os.environ.get(
        'QC_SUMMARY_ALLOW_DEV') in ('1', 'true', 'True')
    auth = request.META.get('HTTP_AUTHORIZATION')
    if not dev_bypass:
        if not auth or not auth.startswith('Bearer '):
            return Response({'detail': 'Authorization required'}, status=status.HTTP_401_UNAUTHORIZED)
        token = auth.split(None, 1)[1]
        try:
            supabase_url = os.environ.get('SUPABASE_URL') or ''
            verify_supabase_jwt(token, supabase_url)
        except PermissionDenied as e:
            return Response({'detail': str(e)}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            # Return a unified unauthorized response when verification fails
            return Response({'detail': 'Token verification failed: %s' % (str(e),)}, status=status.HTTP_401_UNAUTHORIZED)

    cache_key = f"qc:summary:v1.1:{params.start.isoformat()}:{params.end.isoformat()}:{params.tz.key}:{params.granularity_resolved}:{params.smooth}:{params.user_id or 'none'}:{params.min_confidence or 'none'}:{params.device_model or 'none'}:{params.platform or 'none'}:{params.species}"

    @cached_json(cache_key, ttl_seconds=int(os.environ.get('QC_SUMMARY_TTL', '600')))
    def compute():
        qs = Observation.objects.filter(
            created_at__gte=params.start, created_at__lt=params.end)
        if params.species:
            qs = qs.filter(notes__icontains=params.species)
        # future filters: user_id, min_confidence, device_model, platform

        # Treat observations with status='done' as accepted
        totals = qs.aggregate(total=Count('id'), done=Count(
            'id', filter=Q(status='done')))
        total = totals.get('total') or 0
        accepted = totals.get('done') or 0
        rejected = total - accepted
        accept_rate = (accepted / total) if total else 0.0

        # window-level averages (use qc_score as roll-up)
        window_avg = qs.aggregate(avg_qc=Avg('qc_score'))
        accept_reject_ratio = (accepted / rejected) if rejected else None

        # histograms
        blur_bins = bin_blur(qs.values_list('qc_score', flat=True))
        brightness_bins = bin_brightness(qs.values_list('qc_score', flat=True))

        # time series (daily/hourly)
        if params.granularity_resolved == 'hour':
            trunc = TruncHour('created_at', tzinfo=params.tz)
        else:
            trunc = TruncDate('created_at', tzinfo=params.tz)

        ts = (
            qs.annotate(t=trunc)
              .values('t')
              .annotate(uploads=Count('id'), avg_qc=Avg('qc_score'), accepted=Count('id', filter=Q(status='done')))
              .order_by('t')
        )
        buckets = []
        for row in ts:
            uploads = row.get('uploads') or 0
            acc_rate = (row.get('accepted') / uploads) if uploads else 0.0
            buckets.append({'time': row['t'].isoformat(), 'uploads': uploads, 'avg_qc': round(
                row.get('avg_qc') or 0, 3), 'accept_rate': round(acc_rate, 3)})

        if params.smooth and params.smooth > 0:
            ema_series(buckets, 'accept_rate',
                       'ema_accept_rate', alpha=params.smooth)
            ema_series(buckets, 'avg_qc', 'ema_avg_qc', alpha=params.smooth)

        return {
            'window': {'start': params.start.isoformat(), 'end': params.end.isoformat(), 'tz': params.tz.key, 'granularity': params.granularity_resolved, 'smooth': params.smooth},
            'filters': {'min_confidence': params.min_confidence, 'user_id': params.user_id, 'device_model': params.device_model, 'platform': params.platform, 'species': params.species},
            'counts': {'total': total, 'accepted': accepted, 'rejected': rejected, 'accept_rate': round(accept_rate, 3)},
            'averages': {'avg_qc': round((window_avg.get('avg_qc') or 0), 3), 'accept_reject_ratio': round(accept_reject_ratio, 3) if accept_reject_ratio is not None else None},
            'histograms': {'blur': blur_bins, 'brightness': brightness_bins},
            'time_series': {'buckets': buckets},
        }

    payload = compute()
    return Response(payload, headers={'Cache-Control': f"public, max-age={int(os.environ.get('QC_SUMMARY_TTL', '60'))}"})


@api_view(['GET', 'OPTIONS'])
def debug_headers(request):
    """DEBUG-only helper: return the request headers the server received.

    This is intentionally only enabled when Django DEBUG=True. It helps
    debugging cross-origin and auth header issues from the browser.
    """
    if not getattr(settings, 'DEBUG', False):
        return Response({'detail': 'debug endpoint not available'}, status=status.HTTP_403_FORBIDDEN)

    # Collect HTTP_* headers and normalize names to common header form
    raw = {k: v for k, v in request.META.items() if k.startswith('HTTP_')}
    headers = {}
    for k, v in raw.items():
        name = k[5:].replace('_', '-').title()
        headers[name] = v

    # Also include content headers
    for extra in ('CONTENT_TYPE', 'CONTENT_LENGTH'):
        if extra in request.META:
            headers[extra.replace('_', '-').title()] = request.META[extra]

    return Response({'headers': headers})


class GameProfileView(APIView):
    """Return the authenticated user's GameProfile (points/level)."""
    # Use the global authentication classes from settings, which include Supabase JWT
    authentication_classes = [
        SupabaseJWTAuthentication,
        SessionAuthentication,
        BasicAuthentication,
    ]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            profile, _ = GameProfile.objects.get_or_create(user=user)
            serializer = GameProfileSerializer(profile)
            return Response(serializer.data)
        except Exception as e:
            logging.getLogger(__name__).exception(
                'gameprofile: failed to fetch')
            return Response({'detail': 'failed to fetch profile'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
