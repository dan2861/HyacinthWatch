from django.db import models
from django.utils import timezone
from django.conf import settings
import uuid


class Observation(models.Model):
    STATUS_CHOICES = [
        ('received', 'received'),
        ('processing', 'processing'),
        ('done', 'done'),
        ('error', 'error'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Optional link to the Django user who uploaded/owns this observation.
    # Nullable for backward compatibility with existing rows.
    user = models.ForeignKey(
        'auth.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='observations'
    )

    image = models.ImageField(upload_to='observations/%Y/%m/%d/')

    captured_at = models.DateTimeField(default=timezone.now)
    lat = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True)
    lon = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True)
    location_accuracy_m = models.FloatField(null=True, blank=True)

    device_info = models.TextField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default='received')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # {"blur_var": float, "brightness": float}
    qc = models.JSONField(null=True, blank=True)
    qc_score = models.FloatField(
        null=True, blank=True)     # optional roll-up 0..1
    # If using Supabase storage or external object storage, store the
    # canonical storage URL (e.g. supabase://bucket/path) or public URL here.
    image_url = models.URLField(null=True, blank=True)

    # Predictions produced by background tasks (presence/segmentation).
    # Structure example:
    # {"presence": {"score": 0.9, "label": "present", "model_v": "1.0.0"},
    #  "seg": {"mask_url": "supabase://masks/..", "cover_pct": 12.3, "model_v": "1.0.1"}}
    pred = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.id} @ ({self.lat}, {self.lon})"


class GameProfile(models.Model):
    """Simple gamification profile attached to a Django user.

    Stores accumulated points and a simple level. Created on-demand.
    """
    from django.conf import settings

    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(
        'auth.User', on_delete=models.CASCADE, related_name='game_profile')
    points = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    last_updated = models.DateTimeField(auto_now=True)

    def add_points(self, amount: int):
        try:
            self.points = (self.points or 0) + int(amount)
        except Exception:
            self.points = (self.points or 0) + 0
        # simple level-up rule: every 100 points increases level
        new_level = max(1, 1 + (self.points // 100))
        self.level = new_level
        self.save(update_fields=['points', 'level', 'last_updated'])

    def __str__(self):
        return f"GameProfile(user={self.user_id}, points={self.points}, level={self.level})"
