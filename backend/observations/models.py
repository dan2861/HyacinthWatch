from django.db import models


class Observation(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    photo = models.ImageField(upload_to="observations/")
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    location_accuracy_m = models.FloatField(null=True, blank=True)
    # received|processed|rejected
    status = models.CharField(max_length=32, default="received")
