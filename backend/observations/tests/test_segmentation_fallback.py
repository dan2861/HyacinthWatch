import io
import tempfile
import types

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile

from observations.models import Observation


class SegmentationFallbackTest(TestCase):
    """Integration-style test that runs `segment_and_cover` in-process but
    forces the fallback mask path and mocks uploads to avoid network calls.
    This test is intended to run in the worker container where ML deps are
    available. It ensures a mask is produced and the Observation.pred is
    updated even when model artifacts are missing.
    """

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_fallback_mask_uploads_and_updates_pred(self):
        # Create a small RGB PNG and attach to an Observation.image
        img = SimpleUploadedFile(
            'img.png', self._make_png_bytes(), content_type='image/png')
        obs = Observation.objects.create(captured_at='2025-10-26T00:00:00Z')
        obs.image.save('img.png', img)
        obs.save()

        # Force a 'present' presence so the segmenter runs
        obs.pred = obs.pred or {}
        obs.pred['presence'] = {'label': 'present', 'score': 1.0}
        obs.save()

        # Monkeypatch load_segmenter so it always raises -> fallback path
        import workers.model_loader as ml

        def _raise(v):
            raise RuntimeError('force fallback')

        ml_orig = getattr(ml, 'load_segmenter', None)
        ml.load_segmenter = lambda version: (_raise(version))

        # Capture the upload call
        import utils.storage as storage

        uploaded = {}

        def fake_upload(bucket, path, data, content_type=None):
            uploaded['bucket'] = bucket
            uploaded['path'] = path
            uploaded['bytes'] = data
            return f'supabase://{bucket}/{path}'

        storage_orig = storage.upload_bytes
        storage.upload_bytes = fake_upload

        try:
            # Import the task and run it synchronously (worker container run)
            from workers.tasks import segment_and_cover
            segment_and_cover(str(obs.id))

            obs.refresh_from_db()
            self.assertIn('seg', obs.pred)
            seg = obs.pred['seg']
            self.assertIn('cover_pct', seg)
            # Because our fake_upload returns a supabase:// path, the mask_url should exist
            self.assertTrue(seg.get('mask_url', '').startswith('supabase://'))
            self.assertEqual(uploaded.get('bucket'), storage.STORAGE_BUCKET_MASKS if hasattr(
                storage, 'STORAGE_BUCKET_MASKS') else 'masks')
        finally:
            # restore
            if ml_orig is not None:
                ml.load_segmenter = ml_orig
            storage.upload_bytes = storage_orig

    def _make_png_bytes(self):
        # Minimal 16x16 red PNG
        from PIL import Image
        b = io.BytesIO()
        img = Image.new('RGB', (16, 16), color=(255, 0, 0))
        img.save(b, format='PNG')
        return b.getvalue()


class SegmentationFallbackTest(TestCase):
    """Integration-style test that runs `segment_and_cover` in-process but
    forces the fallback mask path and mocks uploads to avoid network calls.
    This test is intended to run in the worker container where ML deps are
    available. It ensures a mask is produced and the Observation.pred is
    updated even when model artifacts are missing.
    """

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_fallback_mask_uploads_and_updates_pred(self):
        # Create a small RGB PNG and attach to an Observation.image
        img = SimpleUploadedFile(
            'img.png', self._make_png_bytes(), content_type='image/png')
        obs = Observation.objects.create(captured_at='2025-10-26T00:00:00Z')
        obs.image.save('img.png', img)
        obs.save()

        # Force a 'present' presence so the segmenter runs
        obs.pred = obs.pred or {}
        obs.pred['presence'] = {'label': 'present', 'score': 1.0}
        obs.save()

        # Monkeypatch load_segmenter so it always raises -> fallback path
        import workers.model_loader as ml

        def _raise(v):
            raise RuntimeError('force fallback')

        ml_orig = getattr(ml, 'load_segmenter', None)
        ml.load_segmenter = lambda version: (_raise(version))

        # Capture the upload call
        import utils.storage as storage

        uploaded = {}

        def fake_upload(bucket, path, data, content_type=None):
            uploaded['bucket'] = bucket
            uploaded['path'] = path
            uploaded['bytes'] = data
            return f'supabase://{bucket}/{path}'

        storage_orig = storage.upload_bytes
        storage.upload_bytes = fake_upload

        try:
            # Import the task and run it synchronously (worker container run)
            from workers.tasks import segment_and_cover
            segment_and_cover(str(obs.id))

            obs.refresh_from_db()
            self.assertIn('seg', obs.pred)
            seg = obs.pred['seg']
            self.assertIn('cover_pct', seg)
            # Because our fake_upload returns a supabase:// path, the mask_url should exist
            self.assertTrue(seg.get('mask_url', '').startswith('supabase://'))
            self.assertEqual(uploaded.get('bucket'), storage.STORAGE_BUCKET_MASKS if hasattr(
                storage, 'STORAGE_BUCKET_MASKS') else 'masks')
        finally:
            # restore
            if ml_orig is not None:
                ml.load_segmenter = ml_orig
            storage.upload_bytes = storage_orig

    def _make_png_bytes(self):
        # Minimal 16x16 red PNG
        from PIL import Image
        b = io.BytesIO()
        img = Image.new('RGB', (16, 16), color=(255, 0, 0))
        img.save(b, format='PNG')
        return b.getvalue()


class SegmentationFallbackTest(TestCase):
    """Integration-style test that runs `segment_and_cover` in-process but
    forces the fallback mask path and mocks uploads to avoid network calls.
    This test is intended to run in the worker container where ML deps are
    available. It ensures a mask is produced and the Observation.pred is
    updated even when model artifacts are missing.
    """

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_fallback_mask_uploads_and_updates_pred(self):
        # Create a small RGB PNG and attach to an Observation.image
        img = SimpleUploadedFile(
            'img.png', self._make_png_bytes(), content_type='image/png')
        obs = Observation.objects.create(captured_at='2025-10-26T00:00:00Z')
        obs.image.save('img.png', img)
        obs.save()

    # Force a 'present' presence so the segmenter runs
    obs.pred = obs.pred or {}
    obs.pred['presence'] = {'label': 'present', 'score': 1.0}
    obs.save()

      # Monkeypatch load_segmenter so it always raises -> fallback path
      import workers.model_loader as ml

       def _raise(v):
            raise RuntimeError('force fallback')

        ml_orig = getattr(ml, 'load_segmenter', None)
        ml.load_segmenter = lambda version: (_raise(version))

        # Capture the upload call
        import utils.storage as storage

        uploaded = {}

        def fake_upload(bucket, path, data, content_type=None):
            uploaded['bucket'] = bucket
            uploaded['path'] = path
            uploaded['bytes'] = data
            return f'supabase://{bucket}/{path}'

        storage_orig = storage.upload_bytes
        storage.upload_bytes = fake_upload

        try:
            # Import the task and run it synchronously (worker container run)
            from workers.tasks import segment_and_cover
            segment_and_cover(str(obs.id))

            obs.refresh_from_db()
            self.assertIn('seg', obs.pred)
            seg = obs.pred['seg']
            self.assertIn('cover_pct', seg)
            # Because our fake_upload returns a supabase:// path, the mask_url should exist
            self.assertTrue(seg.get('mask_url', '').startswith('supabase://'))
            self.assertEqual(uploaded.get('bucket'), storage.STORAGE_BUCKET_MASKS if hasattr(
                storage, 'STORAGE_BUCKET_MASKS') else 'masks')
        finally:
            # restore
            if ml_orig is not None:
                ml.load_segmenter = ml_orig
            storage.upload_bytes = storage_orig

    def _make_png_bytes(self):
        # Minimal 16x16 red PNG
        from PIL import Image
        b = io.BytesIO()
        img = Image.new('RGB', (16, 16), color=(255, 0, 0))
        img.save(b, format='PNG')
        return b.getvalue()
