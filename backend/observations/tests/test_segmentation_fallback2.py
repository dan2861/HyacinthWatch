import io
import tempfile

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile

from observations.models import Observation


class SegmentationFallback2Test(TestCase):
    """Same as the original fallback test but in a fresh file to avoid
    interference from prior edits during debugging.
    """

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_fallback_mask_uploads_and_updates_pred(self):
        img = SimpleUploadedFile(
            'img.png', self._make_png_bytes(), content_type='image/png')
        obs = Observation.objects.create(captured_at='2025-10-26T00:00:00Z')
        obs.image.save('img.png', img)
        obs.save()

        obs.pred = obs.pred or {}
        obs.pred['presence'] = {'label': 'present', 'score': 1.0}
        obs.save()

        # Force model loader to raise so fallback path is used
        import workers.model_loader as ml

        ml_orig = getattr(ml, 'load_segmenter', None)

        def _raise(v):
            raise RuntimeError('force fallback')

        ml.load_segmenter = lambda version: (_raise(version))

        # Ensure masks bucket is set so the task attempts an upload
        import os
        os.environ.setdefault('STORAGE_BUCKET_MASKS', 'masks')

        # Patch storage.upload_bytes to capture upload
        import utils.storage as storage

        storage_orig = storage.upload_bytes
        uploaded = {}

        def fake_upload(bucket, path, data, content_type=None):
            uploaded['bucket'] = bucket
            uploaded['path'] = path
            uploaded['bytes'] = data
            return f'supabase://{bucket}/{path}'

        storage.upload_bytes = fake_upload

        try:
            from workers.tasks import segment_and_cover
            segment_and_cover(str(obs.id))
            obs.refresh_from_db()
            self.assertIn('seg', obs.pred)
            seg = obs.pred['seg']
            self.assertIn('cover_pct', seg)
            self.assertTrue(seg.get('mask_url', '').startswith('supabase://'))
            self.assertEqual(uploaded.get('bucket'), getattr(
                storage, 'STORAGE_BUCKET_MASKS', 'masks'))
        finally:
            storage.upload_bytes = storage_orig
            if ml_orig is not None:
                ml.load_segmenter = ml_orig

    def _make_png_bytes(self):
        from PIL import Image
        b = io.BytesIO()
        img = Image.new('RGB', (16, 16), color=(255, 0, 0))
        img.save(b, format='PNG')
        return b.getvalue()
