try:
    from celery import shared_task
except Exception:
    def shared_task(*args, **kwargs):
        def _dec(fn):
            return fn
        return _dec

import logging
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from .models import Observation

# Import the Celery app so we can send tasks by name without importing the
# possibly-heavy or mutated task module directly.
try:
    from hyacinthwatch.celery import app as celery_app
except Exception:
    celery_app = None


@shared_task
def retry_orphaned_presence():
    """Find observations older than ORPHAN_PRESENCE_DELAY_MINUTES that still
    lack a `pred.presence` result and re-enqueue presence classification.

    This writes a small retry counter into `obs.pred['_presence_monitor_retries']`
    and will give up after ORPHAN_PRESENCE_MAX_RETRIES (moves the observation to
    status 'error' and marks it as 'gave_up' in pred).
    """
    logger = logging.getLogger(__name__)
    delay_min = int(getattr(settings, 'ORPHAN_PRESENCE_DELAY_MINUTES', 10))
    max_retries = int(getattr(settings, 'ORPHAN_PRESENCE_MAX_RETRIES', 3))
    cutoff = timezone.now() - timedelta(minutes=delay_min)

    qs = Observation.objects.filter(
        created_at__lt=cutoff,
        status__in=['received', 'processing']
    ).exclude(pred__has_key='presence')

    count = qs.count()
    logger.info(
        'retry_orphaned_presence: found %d candidate orphaned observations', count)

    enqueued = 0
    for obs in qs:
        pred = obs.pred or {}
        try:
            retries = int(pred.get('_presence_monitor_retries', 0))
        except Exception:
            retries = 0

        if retries >= max_retries:
            pred['_presence_monitor_status'] = 'gave_up'
            obs.pred = pred
            obs.status = 'error'
            try:
                obs.save(update_fields=['pred', 'status', 'updated_at'])
            except Exception:
                logger.exception(
                    'retry_orphaned_presence: failed to mark gave_up for %s', obs.id)
            logger.info(
                'retry_orphaned_presence: gave up on %s after %d retries', obs.id, retries)
            continue

        pred['_presence_monitor_retries'] = retries + 1
        obs.pred = pred
        try:
            obs.save(update_fields=['pred', 'updated_at'])
        except Exception:
            logger.exception(
                'retry_orphaned_presence: failed to save retry counter for %s', obs.id)

            # compute a countdown using exponential backoff (capped). This avoids
            # immediate reprocessing storms and spaces out retries per-observation.
            try:
                # backoff: min(60 * 2**retries, 3600) seconds
                countdown = min(60 * (2 ** retries), 3600)
            except Exception:
                countdown = 60

            # send the classify_presence task by name via Celery app (avoids importing tasks)
            if celery_app is not None:
                try:
                    celery_app.send_task(
                        'observations.tasks.classify_presence', args=(str(obs.id),), countdown=countdown)
                    enqueued += 1
                    logger.info(
                        'retry_orphaned_presence: sent classify_presence for %s (attempt %d) countdown=%s',
                        obs.id, retries + 1, countdown)
                except Exception:
                    logger.exception(
                        'retry_orphaned_presence: failed to send classify_presence for %s', obs.id)
            else:
                # attempt local import as a fallback
                try:
                    from .tasks import classify_presence
                    try:
                        classify_presence.apply_async(
                            args=(str(obs.id),), countdown=countdown)
                        enqueued += 1
                        logger.info(
                            'retry_orphaned_presence: enqueued classify_presence (fallback) for %s countdown=%s', obs.id, countdown)
                    except Exception:
                        # synchronous fallback (no countdown)
                        classify_presence(str(obs.id))
                        enqueued += 1
                        logger.info(
                            'retry_orphaned_presence: ran classify_presence sync (fallback) for %s', obs.id)
                except Exception:
                    logger.exception(
                        'retry_orphaned_presence: no way to invoke classify_presence for %s', obs.id)

    return {'candidates': count, 'enqueued': enqueued}
