from django.db import models
import uuid


class Observation(models.Model):
    STATUS_CHOICES = [
        ('received', 'received'),
        ('processing', 'processing'),
        ('done', 'done'),
        ('error', 'error'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    image = models.ImageField(upload_to='observations/%Y/%m/%d/')

    captured_at = models.DateTimeField()
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

    def __str__(self):
        return f"{self.id} @ ({self.lat}, {self.lon})"
