from rest_framework import serializers
from .models import Observation
from .models import GameProfile


class ObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = [
            'user',
            'id', 'image', 'image_url', 'captured_at', 'lat', 'lon', 'location_accuracy_m',
            'device_info', 'notes', 'status', 'qc', 'qc_score', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'qc',
                            'qc_score', 'created_at', 'updated_at', 'user']


class GameProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = GameProfile
        fields = ['user', 'points', 'level', 'last_updated']
        read_only_fields = ['user', 'points', 'level', 'last_updated']
