"""Task shim for observations package.

This file exposes the task functions expected by the Django views by importing
the real implementations from the worker module (which lives in
`workers/tasks.py`). When Celery is not configured or the worker module is
unavailable, the shim provides light-weight fallbacks so the API can still
call the functions synchronously (useful for local development).
"""

import logging

logger = logging.getLogger(__name__)


def _import_worker_tasks():
    """Try to import the real task implementations from workers.tasks.

    Returns a dict with any of the names found.
    """
    try:
        # workers is a sibling package at workspace root: backend/workers
        from workers import tasks as _wt

        return {
            'classify_presence': getattr(_wt, 'classify_presence', None),
            'segment_and_cover': getattr(_wt, 'segment_and_cover', None),
            'run_qc_and_segmentation': getattr(_wt, 'run_qc_and_segmentation', None),
        }
    except Exception as e:
        logger.debug(
            'observations.tasks: unable to import workers.tasks: %s', e)
        return {'classify_presence': None, 'segment_and_cover': None, 'run_qc_and_segmentation': None}


_workers = _import_worker_tasks()


def classify_presence(obs_id: str):
    """Enqueue or run presence classification.

    Preferred: call the Celery task if available (worker exposes .delay).
    Fallback: call the underlying function synchronously.
    """
    f = _workers.get('classify_presence')
    if f is None:
        logger.warning(
            'classify_presence: worker implementation not available')
        return None
    # If the imported object is a Celery task, it will have a .delay attribute.
    if hasattr(f, 'delay'):
        try:
            return f.delay(str(obs_id))
        except Exception:
            logger.exception(
                'classify_presence: .delay failed, falling back to sync call')
    try:
        return f(str(obs_id))
    except Exception:
        logger.exception(
            'classify_presence: synchronous call failed for %s', obs_id)
        return None


def segment_and_cover(obs_id: str):
    """Enqueue or run segmentation/cover generation.

    See notes in classify_presence() regarding .delay vs sync fallback.
    """
    f = _workers.get('segment_and_cover')
    if f is None:
        logger.warning(
            'segment_and_cover: worker implementation not available')
        return None
    if hasattr(f, 'delay'):
        try:
            return f.delay(str(obs_id))
        except Exception:
            logger.exception(
                'segment_and_cover: .delay failed, falling back to sync call')
    try:
        return f(str(obs_id))
    except Exception:
        logger.exception(
            'segment_and_cover: synchronous call failed for %s', obs_id)
        return None


def run_qc_and_segmentation(obs_id: str):
    """Enqueue or run QC and segmentation wrapper.

    Historically this name was used by the API to schedule quick QC; the
    worker-side implementation may live in the worker package. Re-export the
    worker implementation when available, otherwise no-op or call sync.
    """
    f = _workers.get('run_qc_and_segmentation')
    if f is None:
        logger.warning(
            'run_qc_and_segmentation: worker implementation not available')
        return None
    if hasattr(f, 'delay'):
        try:
            return f.delay(str(obs_id))
        except Exception:
            logger.exception(
                'run_qc_and_segmentation: .delay failed, falling back to sync call')
    try:
        return f(str(obs_id))
    except Exception:
        logger.exception(
            'run_qc_and_segmentation: synchronous call failed for %s', obs_id)
        return None
