from typing import Optional
import logging

from django.contrib.auth import get_user_model

from .models import GameProfile

logger = logging.getLogger(__name__)


def _get_or_create_profile(user):
    if user is None:
        return None
    try:
        profile, _ = GameProfile.objects.get_or_create(user=user)
        return profile
    except Exception:
        logger.exception(
            'gamification: failed to get or create GameProfile for user %s', getattr(user, 'id', None))
        return None


def award_points(user, points: int, reason: Optional[str] = None):
    """Award points to the user's GameProfile. Returns new total or None."""
    profile = _get_or_create_profile(user)
    if profile is None:
        return None
    try:
        profile.add_points(int(points))
        logger.info('awarded %s points to user=%s reason=%s',
                    points, user.id, reason)
        return profile.points
    except Exception:
        logger.exception(
            'gamification: failed to award points to user %s', getattr(user, 'id', None))
        return None


def score_from_qc(qc: dict) -> int:
    """Compute points from a QC dict. Expect qc_score between 0..1 or specific metrics.
    Returns an integer points value.
    """
    if not qc:
        return 0
    try:
        # prefer a qc_score field 0..1
        s = qc.get('qc_score') or qc.get('score') or qc.get('qc_score_raw')
        if s is None:
            # fallback to brightness/blur combination if present
            brightness = float(qc.get('brightness') or 0)
            blur = float(qc.get('blur_var') or 0)
            # map to 0..1 roughly
            s = min(1.0, max(0.0, (brightness / 255.0) * (1.0 / (1.0 + blur))))
        s = float(s)
        return int(s * 20)  # up to 20 points
    except Exception:
        return 0


def score_from_seg(seg: dict) -> int:
    """Compute points from segmentation entry (cover_pct)."""
    if not seg:
        return 0
    try:
        cover = float(seg.get('cover_pct') or 0.0)
        # give 1 point per 10% cover, up to 10 points
        pts = int(min(10, cover // 10))
        # bonus if mask comes from a non-fallback model
        mv = seg.get('model_v') or ''
        if mv and 'fallback' not in mv:
            pts += 2
        return pts
    except Exception:
        return 0


def award_for_presence(obs, label: str):
    """Award based on presence label. Returns points awarded."""
    user = getattr(obs, 'user', None)
    if not user:
        return 0
    points = 5 if label == 'present' else 1
    return award_points(user, points, reason=f'presence:{label}')


def award_for_segmentation(obs, seg: dict):
    user = getattr(obs, 'user', None)
    if not user:
        return 0
    pts = score_from_seg(seg)
    return award_points(user, pts, reason=f'segmentation:{seg.get("model_v") if isinstance(seg, dict) else seg}')


def award_for_qc(obs, qc: dict):
    user = getattr(obs, 'user', None)
    if not user:
        return 0
    pts = score_from_qc(qc)
    return award_points(user, pts, reason='qc')
