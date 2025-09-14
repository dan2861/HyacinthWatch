from rest_framework import serializers
from observations.models import Observation


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = ["id", "created_at", "photo", "lat",
                  "lon", "location_accuracy_m", "status"]
