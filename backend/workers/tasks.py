from celery import shared_task
import os
import io
import logging

from .model_loader import load_presence, load_segmenter

try:
    from utils.storage import download_bytes, upload_png
except Exception:
    download_bytes = None
    upload_png = None


@shared_task
def classify_presence(obs_id: str):
    logger = logging.getLogger(__name__)
    try:
        from observations.models import Observation
        from PIL import Image
        import numpy as np
        import torch
    except Exception as e:
        logger.exception('classify_presence: imports failed: %s', e)
        return

    try:
        obs = Observation.objects.get(id=obs_id)
    except Observation.DoesNotExist:
        logger.warning('classify_presence: obs not found %s', obs_id)
        return

    # Import storage helpers locally so the task doesn't rely on the
    # module-level import state. Celery worker child processes may have
    # failed the import at startup; importing here ensures we see the
    # current environment when attempting network operations.
    try:
        from utils import storage as _storage
        local_download = getattr(_storage, 'download_bytes', None)
    except Exception:
        _storage = None
        local_download = None

    version = os.environ.get('PRESENCE_MODEL_VERSION', '1.0.0')
    model, meta = load_presence(version)
    # Allow override of threshold via environment variable for testing/tuning
    # Default to meta threshold (0.5) or fall back to 0.5 if not in meta
    base_thr = float(meta.get('threshold', 0.5))
    # If PRESENCE_THRESHOLD env var is set, use it instead of meta threshold
    env_thr = os.environ.get('PRESENCE_THRESHOLD')
    thr = float(env_thr) if env_thr is not None else base_thr
    logger.info('classify_presence: Using threshold=%.3f (meta=%.3f, env=%s) for obs_id=%s',
                thr, base_thr, env_thr or 'not set', obs_id)

    # obtain image bytes
    raw = None
    if local_download and getattr(obs, 'image_url', None):
        try:
            # image_url expected supabase://bucket/path
            uri = obs.image_url
            if uri.startswith('supabase://'):
                _, rest = uri.split('://', 1)
                bucket, path = rest.split('/', 1)
                raw = local_download(bucket, path)
                if isinstance(raw, dict):
                    raw = raw.get('data') or raw.get(
                        'body') or raw.get('content')
        except Exception:
            logger.exception(
                'classify_presence: failed to download bytes for %s', obs_id)

    # fallback: use local image file
    if not raw and getattr(obs, 'image', None):
        try:
            local_path = getattr(obs.image, 'path', None)
            if local_path:
                with open(local_path, 'rb') as fh:
                    raw = fh.read()
        except Exception:
            logger.exception(
                'classify_presence: failed to read local image for %s', obs_id)

    if not raw:
        logger.warning('classify_presence: no image for %s', obs_id)
        obs.status = 'error'
        obs.save(update_fields=['status', 'updated_at'])
        return

    img = Image.open(io.BytesIO(raw)).convert('RGB')
    img = img.resize(tuple(meta['input_size']))
    x = torch.tensor(np.array(img) / 255.0).permute(2, 0, 1).unsqueeze(0)
    mean, std = meta['normalize']['mean'], meta['normalize']['std']
    for c in range(3):
        x[:, c] = (x[:, c] - mean[c]) / std[c]
    # If we have a real model, move tensors to the model device and match
    # the dtype to the model parameters. Otherwise fall back to CPU.
    try:
        if model is not None:
            first_param = next(model.parameters())
            device = first_param.device
            param_dtype = first_param.dtype
        else:
            device = torch.device('cpu')
            param_dtype = None
    except Exception:
        device = torch.device('cpu')
        param_dtype = None

    # Move to device and, if we know the model dtype, cast to it so the
    # model and input tensors match (prevents dtype mismatch runtime errors).
    if param_dtype is not None:
        x = x.to(device=device, dtype=param_dtype)
    else:
        x = x.to(device)

    with torch.no_grad():
        score = torch.sigmoid(model(x)).item()
    label = 'present' if score >= thr else 'absent'

    logger.info('classify_presence: obs_id=%s, score=%.4f, threshold=%.4f, label=%s',
                obs_id, score, thr, label)

    obs.pred = obs.pred or {}
    obs.pred['presence'] = {'score': score,
                            'label': label, 'model_v': meta.get('version'), 'threshold_used': thr}
    obs.status = 'processing' if label == 'present' else 'done'
    obs.save(update_fields=['pred', 'status', 'updated_at'])

    # Award gamification points for presence
    # Only award if score is above threshold to avoid false positives
    try:
        from observations.gamification import award_for_presence
        try:
            # Reload observation with user relationship to ensure gamification has access to user
            try:
                obs_for_award = Observation.objects.select_related(
                    'user').get(id=obs_id)
            except Observation.DoesNotExist:
                obs_for_award = obs
            # Only award points if score is actually above threshold (not just label='present')
            # This helps catch cases where label might be incorrectly set
            if score >= thr:
                logger.info('Awarding presence points: obs_id=%s, label=%s, score=%.3f, threshold=%.3f',
                            obs_id, label, score, thr)
                award_for_presence(obs_for_award, label)
            else:
                logger.info('Skipping presence points (below threshold): obs_id=%s, label=%s, score=%.3f, threshold=%.3f',
                            obs_id, label, score, thr)
        except Exception:
            logger.exception(
                'classify_presence: failed to award presence points for %s', obs_id)
    except Exception:
        # if gamification module missing just skip
        pass

    # Enqueue segmentation regardless of presence label. Some workflows
    # should always run segmentation to ensure masks are produced even when
    # the presence classifier is uncertain or missing.
    try:
        from .model_loader import load_segmenter
        from .tasks import segment_and_cover as seg_task
    except Exception:
        # in worker module context the import path may differ; try local import
        try:
            from observations.tasks import segment_and_cover as seg_task
        except Exception:
            seg_task = None
    if seg_task:
        try:
            seg_task.delay(str(obs.id))
        except Exception:
            try:
                seg_task(str(obs.id))
            except Exception:
                logger.exception(
                    'classify_presence (worker): failed to run segment_and_cover synchronously for %s', obs_id)
    # If presence is 'absent', schedule a purge task to remove mask and image files
    # Note: previously we enqueued an automatic purge task when the presence
    # classifier labeled 'absent'. That behaviour was removed to avoid
    # automatic destructive deletions. Purging remains available via the
    # management command `purge_absent` or manual invocation.


@shared_task
def segment_and_cover(obs_id: str):
    logger = logging.getLogger(__name__)
    try:
        from observations.models import Observation
        from PIL import Image
        import numpy as np
        import torch
    except Exception as e:
        logger.exception('segment_and_cover: imports failed: %s', e)
        return

    try:
        obs = Observation.objects.get(id=obs_id)
    except Observation.DoesNotExist:
        logger.warning('segment_and_cover: obs not found %s', obs_id)
        return

    # NOTE: segmentation will proceed regardless of presence results.
    # The prior behaviour gated segmentation on the presence classifier and
    # could reschedule or skip segmentation; revert to always performing
    # segmentation so uploads get masks regardless of presence.

    version = os.environ.get('SEGMENTATION_MODEL_VERSION', '1.0.0')
    # Try to load the segmentation model from Supabase. If the model is
    # unavailable (404) or required ML packages are missing, fall back to a
    # lightweight thresholding fallback so that the pipeline can continue and
    # produce a usable mask for downstream consumers and tests.
    try:
        model, meta = load_segmenter(version)
    except Exception as e:
        logger.warning(
            'segment_and_cover: failed to load segmenter v%s: %s; using fallback threshold mask', version, e)
        model = None
        # provide minimal meta required by downstream code including
        # normalization parameters so downstream preprocessing works.
        meta = {
            'input_size': [320, 320],
            'logit_threshold': 0.5,
            'version': f'fallback-{version}',
            'normalize': {'mean': [0.485, 0.456, 0.406], 'std': [0.229, 0.224, 0.225]}
        }

    raw = None
    # Import storage helpers locally so the task doesn't rely on the module-
    # level import state (Celery processes may have tried to import earlier
    # and failed). This makes the task more robust and ensures we see the
    # current environment when attempting network operations.
    try:
        from utils import storage as _storage
        local_download = getattr(_storage, 'download_bytes', None)
        local_upload = getattr(_storage, 'upload_png', None)
    except Exception:
        _storage = None
        local_download = None
        local_upload = None

    # Diagnostic log to help debug occasional "no image" cases where the
    # helper exists but returns empty results. This logs whether the
    # download helper is present and the exact image_url we will try.
    try:
        logger.info('segment_and_cover: download_bytes=%s image_url=%r', bool(
            local_download), getattr(obs, 'image_url', None))
    except Exception:
        pass

    if local_download and getattr(obs, 'image_url', None):
        try:
            uri = obs.image_url
            if uri.startswith('supabase://'):
                _, rest = uri.split('://', 1)
                bucket, path = rest.split('/', 1)
                raw = local_download(bucket, path)
                if isinstance(raw, dict):
                    raw = raw.get('data') or raw.get(
                        'body') or raw.get('content')
        except Exception:
            logger.exception(
                'segment_and_cover: download failed for %s', obs_id)

    if not raw and getattr(obs, 'image', None):
        try:
            local_path = getattr(obs.image, 'path', None)
            if local_path:
                with open(local_path, 'rb') as fh:
                    raw = fh.read()
        except Exception:
            logger.exception(
                'segment_and_cover: failed to read local image for %s', obs_id)

    if not raw:
        logger.warning('segment_and_cover: no image for %s', obs_id)
        obs.status = 'error'
        obs.save(update_fields=['status', 'updated_at'])
        return

    img = Image.open(io.BytesIO(raw)).convert('RGB')
    img = img.resize(tuple(meta['input_size']))
    x = torch.tensor(np.array(img) / 255.0,
                     dtype=torch.float32).permute(2, 0, 1).unsqueeze(0)
    mean, std = meta['normalize']['mean'], meta['normalize']['std']
    for c in range(3):
        x[:, c] = (x[:, c] - mean[c]) / std[c]
    # If we have a real model, move tensors to the model device. Otherwise
    # fall back to CPU for the lightweight threshold-based mask.
    try:
        if model is not None:
            device = next(model.parameters()).device
            # Ensure model is in float32 format to match input tensor dtype
            try:
                model = model.float()
            except Exception:
                pass
        else:
            device = torch.device('cpu')
    except Exception:
        device = torch.device('cpu')
    x = x.to(device)

    if model is not None:
        with torch.no_grad():
            logits = model(x)
            probs = torch.sigmoid(logits)
            mask = (probs >= meta.get('logit_threshold', 0.5)).float()[
                0, 0].cpu().numpy().astype('uint8') * 255
    else:
        # Simple fallback: convert to grayscale and threshold to produce a binary mask.
        try:
            import numpy as _np
            arr = _np.array(img.convert('L').resize(tuple(meta['input_size'])))
            thr = int(255 * meta.get('logit_threshold', 0.5))
            mask = (_np.where(arr >= thr, 255, 0)).astype('uint8')
        except Exception:
            logger.exception(
                'segment_and_cover: fallback mask generation failed; marking error')
            obs.status = 'error'
            obs.save(update_fields=['status', 'updated_at'])
            return

    buf = io.BytesIO()
    Image.fromarray(mask).save(buf, format='PNG')

    # prefer the locally-resolved upload helper (imported above) since the
    # module-level import may have failed in some Celery worker processes
    # earlier. local_upload will be None if no helper is available.
    # Attempt to upload mask if a masks bucket is configured. Be defensive
    # so a missing upload helper or upload failure doesn't prevent us from
    # recording the computed cover percentage in the Observation record.
    url = None
    bucket = os.environ.get('STORAGE_BUCKET_MASKS')
    if bucket:
        owner = getattr(getattr(obs, 'user', None), 'id', None) or 'anon'
        mask_path = f"{owner}/{obs.id}.png"
        upload_func = local_upload or getattr(_storage, 'upload_bytes', None)
        if upload_func:
            try:
                try:
                    upload_func(bucket, mask_path, buf.getvalue())
                except TypeError:
                    upload_func(bucket, mask_path, buf.getvalue(), 'image/png')
                url = f"supabase://{bucket}/{mask_path}"
                try:
                    func_name = getattr(upload_func, '__name__', None) or type(
                        upload_func).__name__
                except Exception:
                    func_name = str(upload_func)
                logger.info(
                    'segment_and_cover: uploaded mask via %s to %s', func_name, url)
            except Exception:
                logger.exception(
                    'segment_and_cover: upload failed for %s', obs_id)

    # Reload fresh record to avoid clobbering concurrent updates (e.g. presence)
    # IMPORTANT: Check presence label BEFORE saving segmentation to ensure we have latest presence data
    try:
        fresh = Observation.objects.get(id=obs_id)
        pred = fresh.pred or {}
        # Check presence label now, before we modify pred
        presence_data = pred.get('presence', {})
        presence_label = presence_data.get('label') if presence_data else None
        presence_score = presence_data.get('score') if presence_data else None
    except Exception:
        pred = obs.pred or {}
        presence_data = pred.get('presence', {})
        presence_label = presence_data.get('label') if presence_data else None
        presence_score = presence_data.get('score') if presence_data else None

    seg_entry = {'cover_pct': float(
        mask.mean() / 255 * 100), 'model_v': meta.get('version')}
    if url:
        seg_entry['mask_url'] = url

    pred['seg'] = seg_entry
    pred.pop('_presence_retry', None)
    try:
        fresh.pred = pred
        fresh.status = 'done'
        fresh.save(update_fields=['pred', 'status', 'updated_at'])
    except Exception:
        obs.pred = pred
        obs.status = 'done'
        obs.save(update_fields=['pred', 'status', 'updated_at'])

    # Award gamification points for segmentation
    # Only award points if the image contains hyacinth (presence is 'present')
    # We check presence_label that we captured BEFORE saving, to ensure we have the latest data
    try:
        from observations.gamification import award_for_segmentation
        try:
            # Reload observation with user relationship to ensure gamification has access to user
            try:
                obs_for_award = Observation.objects.select_related(
                    'user').get(id=obs_id)
            except Observation.DoesNotExist:
                obs_for_award = obs

            # Only award segmentation points for images that contain hyacinth
            # Require both label='present' AND score above threshold (default 0.5)
            # to avoid false positives from the classifier
            # Also require presence_score to not be None (presence must be classified)
            if presence_label == 'present' and presence_score is not None and presence_score >= 0.5:
                logger.info('Awarding segmentation points for present image: obs_id=%s, presence_label=%s, presence_score=%.3f, cover_pct=%.1f%%',
                            obs_id, presence_label, presence_score, seg_entry.get('cover_pct'))
                # award based on the seg entry we just stored
                award_for_segmentation(obs_for_award, seg_entry)
            else:
                logger.warning('Skipping segmentation points (not hyacinth or insufficient score): obs_id=%s, presence_label=%s, presence_score=%s, cover_pct=%.1f%%',
                               obs_id, presence_label, presence_score, seg_entry.get('cover_pct'))
        except Exception:
            logger.exception(
                'segment_and_cover: failed to award segmentation points for %s', obs_id)
    except Exception:
        pass
    else:
        # store mask inline as base64 (not ideal) or skip
        try:
            fresh = Observation.objects.get(id=obs_id)
            pred = fresh.pred or {}
        except Exception:
            pred = obs.pred or {}

        pred['seg'] = {'cover_pct': float(
            mask.mean() / 255 * 100), 'model_v': meta.get('version')}
        pred.pop('_presence_retry', None)
        try:
            fresh.pred = pred
            fresh.status = 'done'
            fresh.save(update_fields=['pred', 'status', 'updated_at'])
        except Exception:
            obs.pred = pred
            obs.status = 'done'
            obs.save(update_fields=['pred', 'status', 'updated_at'])


# purge_observation_files removed: automatic purge has been disabled per request.
