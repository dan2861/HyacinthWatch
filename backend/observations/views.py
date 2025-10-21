from django.shortcuts import render
import json
from datetime import datetime, timezone
from django.utils.timezone import make_aware
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Observation
from .serializer import ObservationSerializer
from .qc import compute_qc
import os
import logging

try:
    from utils.storage import upload_bytes
    from utils.storage import signed_url as storage_signed_url
    from utils.storage import download_bytes
except Exception:
    upload_bytes = None
    logging.getLogger(__name__).info('utils.storage not available; skipping supabase uploads')
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
        obs = Observation.objects.create(
            id=meta.get('id') or None,  # accept client UUID if provided
            image=file,
            captured_at=dt,
            lat=meta.get('lat'),
            lon=meta.get('lon'),
            location_accuracy_m=meta.get('location_accuracy_m'),
            device_info=meta.get('device_info'),
            notes=meta.get('notes'),
            status='received',
        )

        # compute qc that now image is saved
        try:
            qc = compute_qc(obs.image.path)
            obs.qc = qc
            obs.qc_score = qc.get("score")
            obs.status = 'done'
            obs.save(update_fields=['qc', 'qc_score', 'status', 'updated_at'])
        except Exception as e:
            # Don't fail the request instead mark error if QC crashes
            obs.status = 'error'
            obs.save(update_fields=['status', 'updated_at'])

        # Try to upload to Supabase storage if helper available and env configured
        try:
            if upload_bytes and os.environ.get('SUPABASE_URL') and os.environ.get('STORAGE_BUCKET_OBS') and getattr(obs, 'image', None):
                # read local file bytes
                local_path = getattr(obs.image, 'path', None)
                if local_path and os.path.exists(local_path):
                    with open(local_path, 'rb') as fh:
                        data = fh.read()
                    ext = os.path.splitext(obs.image.name)[1].lstrip('.') or 'jpg'
                    path = f"{obs.id}.{ext}"
                    uri = upload_bytes(os.environ.get('STORAGE_BUCKET_OBS'), path, data, content_type=getattr(obs.image.file, 'content_type', 'image/jpeg'))
                    if uri:
                        obs.image_url = uri
                        obs.save(update_fields=['image_url', 'updated_at'])
        except Exception as e:
            logging.getLogger(__name__).warning('Supabase upload failed: %s', e)

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
                    logging.getLogger(__name__).warning('signed url creation failed: %s', e)
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
                    logging.getLogger(__name__).warning('signed url creation failed: %s', e)

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

            obs = Observation.objects.create(
                image_url=f"supabase://{bucket}/{path}",
                captured_at=captured_at or None,
                lat=data.get('lat'),
                lon=data.get('lon'),
                status='queued',
            )

            # Try immediate QC by downloading the object from Supabase (service role)
            did_qc = False
            try:
                if download_bytes:
                    raw = download_bytes(bucket, path)
                    # normalize various return shapes
                    if isinstance(raw, dict):
                        # supabase-py may return {'data': b'...'}
                        raw = raw.get('data') or raw.get('body') or raw.get('content')
                    if raw:
                        import tempfile, os
                        suffix = os.path.splitext(path)[1] or '.jpg'
                        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tf:
                            tf.write(raw)
                            tmpname = tf.name
                        try:
                            qc = compute_qc(tmpname)
                            obs.qc = qc
                            obs.qc_score = qc.get('score')
                            obs.status = 'done'
                            obs.save(update_fields=['qc', 'qc_score', 'status', 'updated_at'])
                            did_qc = True
                        finally:
                            try:
                                os.unlink(tmpname)
                            except Exception:
                                pass
            except Exception as e:
                logging.getLogger(__name__).warning('Immediate QC failed: %s', e)

            # If immediate QC not performed, enqueue worker if available
            if not did_qc:
                try:
                    from .tasks import run_qc_and_segmentation
                    run_qc_and_segmentation.delay(str(obs.id))
                except Exception:
                    pass

            serializer = ObservationSerializer(obs, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logging.getLogger(__name__).exception('failed to create observation ref')
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
