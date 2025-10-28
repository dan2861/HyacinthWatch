from django.core.management.base import BaseCommand
from django.db import transaction
from observations.models import Observation
import logging


class Command(BaseCommand):
    help = "Purge masks and images for observations with presence='absent'."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Do not delete, only report')
        parser.add_argument('--limit', type=int, default=100,
                            help='Max observations to process')
        parser.add_argument('--delete-remote', action='store_true',
                            help='Also delete remote objects via storage client')

    def handle(self, *args, **options):
        dry = options['dry_run']
        limit = options['limit']
        delete_remote = options['delete_remote']
        logger = logging.getLogger('observations.management.purge_absent')

        qs = Observation.objects.all().order_by('created_at')
        processed = 0

        for obs in qs:
            if processed >= limit:
                break
            pred = obs.pred or {}
            presence = None
            try:
                presence = pred.get('presence') if isinstance(
                    pred, dict) else None
            except Exception:
                presence = None
            if not presence or presence.get('label') != 'absent':
                continue

            self.stdout.write(f"Found absent observation {obs.id}")

            # Delete mask if present
            seg = pred.get('seg') if isinstance(pred, dict) else None
            mask_url = seg.get('mask_url') if isinstance(seg, dict) else None
            if mask_url:
                self.stdout.write(f"  mask_url={mask_url}")
                if not dry and delete_remote:
                    from utils.storage import delete_object
                    try:
                        if mask_url.startswith('supabase://'):
                            _, rest = mask_url.split('://', 1)
                            bucket, path = rest.split('/', 1)
                            ok = delete_object(bucket, path)
                            self.stdout.write(f"    deleted mask remote: {ok}")
                    except Exception as e:
                        logger.exception(
                            'failed to delete mask %s: %s', mask_url, e)

            # Delete image remote if configured
            image_url = getattr(obs, 'image_url', None)
            if image_url:
                self.stdout.write(f"  image_url={image_url}")
                if not dry and delete_remote:
                    from utils.storage import delete_object
                    try:
                        if image_url.startswith('supabase://'):
                            _, rest = image_url.split('://', 1)
                            bucket, path = rest.split('/', 1)
                            ok = delete_object(bucket, path)
                            self.stdout.write(
                                f"    deleted image remote: {ok}")
                    except Exception as e:
                        logger.exception(
                            'failed to delete image %s: %s', image_url, e)

            # Delete local file if present
            try:
                if not dry and getattr(obs, 'image', None):
                    # obs.image.delete will remove the file from the storage backend
                    # when using Django's FileField storage. Use save=False to avoid
                    # immediate DB save; we'll update fields below in a transaction.
                    obs.image.delete(save=False)
                    self.stdout.write('    deleted local image file')
            except Exception as e:
                logger.exception(
                    'failed to delete local image for %s: %s', obs.id, e)

            # Update DB record: clear seg and image_url to avoid referencing deleted files
            if dry:
                self.stdout.write(
                    '    (dry-run) would update DB record: remove seg and clear image_url')
            else:
                try:
                    with transaction.atomic():
                        pred = obs.pred or {}
                        if isinstance(pred, dict):
                            pred.pop('seg', None)
                            pred['seg_removed'] = True
                            obs.pred = pred
                        obs.image_url = None
                        obs.save(update_fields=[
                                 'pred', 'image_url', 'updated_at'])
                        self.stdout.write('    updated DB record')
                except Exception as e:
                    logger.exception(
                        'failed to update DB for %s: %s', obs.id, e)

            processed += 1

        self.stdout.write(f'Processed {processed} observations')
