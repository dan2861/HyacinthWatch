from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from observations.models import Observation
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'List orphaned observations (missing pred.presence) older than configured delay. Use --enqueue to re-enqueue classify_presence.'

    def add_arguments(self, parser):
        parser.add_argument('--enqueue', action='store_true',
                            help='Enqueue classify_presence for found orphans')
        parser.add_argument('--limit', type=int, default=100,
                            help='Limit number of rows returned')

    def handle(self, *args, **options):
        delay_min = int(getattr(settings, 'ORPHAN_PRESENCE_DELAY_MINUTES', 10))
        cutoff = timezone.now() - timedelta(minutes=delay_min)
        qs = Observation.objects.filter(created_at__lt=cutoff, status__in=[
                                        'received', 'processing']).exclude(pred__has_key='presence')[:options['limit']]
        count = qs.count()
        self.stdout.write(
            f'Found {count} orphaned observations older than {delay_min} minutes')
        for o in qs:
            self.stdout.write(str(o.id) + ' ' +
                              (o.image_url or 'no_image_url'))
            if options['enqueue']:
                try:
                    # avoid importing tasks directly at module top-level
                    from observations.monitor import retry_orphaned_presence
                    # call the monitor once for this specific observation by reusing the logic
                    # simply increment the counter and call classify_presence synchronously
                    pred = o.pred or {}
                    pred['_presence_monitor_retries'] = int(
                        pred.get('_presence_monitor_retries', 0)) + 1
                    o.pred = pred
                    o.save(update_fields=['pred', 'updated_at'])
                    # use celery app if available
                    try:
                        from hyacinthwatch.celery import app as celery_app
                        celery_app.send_task(
                            'observations.tasks.classify_presence', args=(str(o.id),), countdown=60)
                        self.stdout.write(
                            f'Enqueued classify_presence for {o.id}')
                    except Exception:
                        # fallback: try task import
                        try:
                            from observations.tasks import classify_presence
                            classify_presence.apply_async(
                                args=(str(o.id),), countdown=60)
                            self.stdout.write(
                                f'Enqueued classify_presence (fallback) for {o.id}')
                        except Exception as e:
                            self.stderr.write(
                                f'Failed to enqueue classify_presence for {o.id}: {e}')
                except Exception as e:
                    logger.exception(
                        'list_orphans: error while enqueuing for %s', o.id)
                    self.stderr.write(f'Error for {o.id}: {e}')
        self.stdout.write('done')
