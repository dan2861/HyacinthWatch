from rest_framework import serializers
from .models import Observation


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = [
            'id', 'image', 'captured_at', 'lat', 'lon', 'location_accuracy_m',
            'device_info', 'notes', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']
