from rest_framework import serializers
from .models import Observation
from .models import GameProfile


class ObservationSerializer(serializers.ModelSerializer):
    # Include predictions (presence, segmentation) for frontend display
    pred = serializers.JSONField(read_only=True)
    # Add method fields for calculated values
    points_earned = serializers.SerializerMethodField()
    qc_feedback = serializers.SerializerMethodField()
    mask_url = serializers.SerializerMethodField()

    class Meta:
        model = Observation
        fields = [
            'user',
            'id', 'image', 'image_url', 'captured_at', 'lat', 'lon', 'location_accuracy_m',
            'device_info', 'notes', 'status', 'qc', 'qc_score', 'pred', 'created_at', 'updated_at',
            'points_earned', 'qc_feedback', 'mask_url'
        ]
        read_only_fields = ['id', 'status', 'qc',
                            'qc_score', 'created_at', 'updated_at', 'user', 'pred']

    def get_points_earned(self, obj):
        """Calculate total points earned for this observation based on actual gamification logic."""
        if not obj.user:
            return None
        try:
            from .gamification import score_from_qc, score_from_seg
            points = 0

            # Presence points (only if score >= threshold)
            presence = (obj.pred or {}).get('presence', {})
            presence_label = presence.get('label')
            presence_score = presence.get('score')

            # Presence points: 5 if present and score >= 0.5, 0 otherwise
            if presence_label == 'present' and presence_score is not None and presence_score >= 0.5:
                points += 5

            # Segmentation points (only if presence is confirmed and cover > 0)
            seg = (obj.pred or {}).get('seg', {})
            if seg:
                cover_pct = float(seg.get('cover_pct') or 0.0)
                # Only award segmentation points if presence is confirmed AND there's actual cover
                if (presence_label == 'present' and
                    presence_score is not None and
                    presence_score >= 0.5 and
                        cover_pct > 0.0):
                    seg_points = score_from_seg(seg)
                    points += seg_points

            # QC points (optional, if gamification awards QC points)
            # Note: Currently QC points may not be awarded, but calculate them for display
            # if obj.qc:
            #     qc_points = score_from_qc(obj.qc)
            #     points += qc_points

            return points if points > 0 else None
        except Exception:
            return None

    def get_qc_feedback(self, obj):
        """Generate QC feedback message (accepted/rejected with reason)."""
        # Check presence label first - if absent, reject regardless of QC
        presence = (obj.pred or {}).get('presence', {})
        presence_label = presence.get('label')
        presence_score = presence.get('score')
        
        # If presence classifier says 'absent', always reject
        if presence_label == 'absent' and obj.status == 'done':
            import logging
            logger = logging.getLogger(__name__)
            score_str = f'{(presence_score * 100):.0f}' if presence_score is not None else '0'
            return {
                'accepted': False,
                'reason': 'no hyacinth detected',
                'score': obj.qc_score or 0.0,
                'message': f'Rejected: no hyacinth detected (confidence: {score_str}%)'
            }
        
        # Try to get qc_score - check both obj.qc_score and obj.qc dict
        qc_score = obj.qc_score
        if qc_score is None and obj.qc:
            qc_score = obj.qc.get('score')

        # If no qc_score at all, we can't generate feedback
        # But log for debugging
        if qc_score is None:
            import logging
            logger = logging.getLogger(__name__)
            if hasattr(obj, 'id'):
                logger.debug(
                    'get_qc_feedback: No qc_score for obs %s (qc=%s, qc_score=%s)',
                    obj.id, bool(obj.qc), obj.qc_score)
            return None

        # Determine acceptance based on QC score and status
        # Status 'done' + good QC = accepted; otherwise may be processing or rejected
        qc_threshold = 0.5  # Minimum QC score for acceptance
        accepted = obj.status == 'done' and qc_score >= qc_threshold

        # Get QC metrics if available (obj.qc might be None but we have qc_score)
        blur_var = 0
        brightness = 0
        if obj.qc:
            blur_var = obj.qc.get('blur_var', 0)
            brightness = obj.qc.get('brightness', 0)

        reasons = []
        if qc_score < qc_threshold:
            # Only add specific reasons if we have obj.qc data
            if obj.qc:
                if blur_var < 20:
                    reasons.append("blurry")
                if brightness < 50:
                    reasons.append("dark")
                if brightness > 200:
                    reasons.append("overexposed")
            # Fallback reason if no specific metrics available
            if not reasons:
                reasons.append("poor quality")

        # If status is still processing, show processing message
        if obj.status == 'processing' or obj.status == 'received':
            reason_text = "processing..."
            accepted = None  # Not yet determined
        else:
            reason_text = ", ".join(reasons) if reasons else "clear photo"

        if accepted is None:
            message = f"Processing: {reason_text}"
        else:
            message = f"{'Accepted' if accepted else 'Rejected'}: {reason_text}"

        return {
            'accepted': accepted,
            'reason': reason_text,
            'score': qc_score,
            'message': message
        }

    def get_mask_url(self, obj):
        """Get signed URL for segmentation mask if available."""
        try:
            if not obj.pred:
                import logging
                logger = logging.getLogger(__name__)
                if hasattr(obj, 'id'):
                    logger.debug('get_mask_url: No pred for obs %s', obj.id)
                return None

            seg = obj.pred.get('seg', {})
            if not seg:
                import logging
                logger = logging.getLogger(__name__)
                if hasattr(obj, 'id'):
                    logger.debug('get_mask_url: No seg in pred for obs %s (pred keys: %s)',
                                 obj.id, list(obj.pred.keys()) if obj.pred else None)
                return None

            mask_url_path = seg.get('mask_url')
            if not mask_url_path:
                import logging
                logger = logging.getLogger(__name__)
                if hasattr(obj, 'id'):
                    logger.debug('get_mask_url: No mask_url in seg for obs %s (seg keys: %s)',
                                 obj.id, list(seg.keys()) if seg else None)
                return None

            # If it's a supabase:// URL, convert to signed URL
            if mask_url_path.startswith('supabase://'):
                try:
                    from utils.storage import signed_url as storage_signed_url
                    _, rest = mask_url_path.split('://', 1)
                    if '/' not in rest:
                        return None
                    bucket, path = rest.split('/', 1)
                    signed_url = storage_signed_url(
                        bucket, path, expires_sec=600)
                    if signed_url:
                        return signed_url
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(
                        'Failed to create signed URL for mask: %s', e)
                    # If signed URL creation fails, return None (can't use supabase:// directly)
                    return None

            # If it's already a full URL, return it
            if mask_url_path.startswith('http://') or mask_url_path.startswith('https://'):
                return mask_url_path

            # Otherwise return None (don't return incomplete paths)
            return None
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning('get_mask_url error: %s', e)
            return None


class GameProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = GameProfile
        fields = ['user', 'points', 'level', 'last_updated']
        read_only_fields = ['user', 'points', 'level', 'last_updated']
