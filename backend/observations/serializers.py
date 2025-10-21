from rest_framework import serializers
from .models import Observation
from utils.storage import signed_url as storage_signed_url


class ObservationCreateSerializer(serializers.Serializer):
    bucket = serializers.CharField(max_length=128)
    path = serializers.CharField()
    captured_at = serializers.DateTimeField(required=False, allow_null=True)
    lat = serializers.FloatField(required=False, allow_null=True)
    lon = serializers.FloatField(required=False, allow_null=True)


class ObservationReadSerializer(serializers.ModelSerializer):
    signed_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Observation
        fields = (
            'id', 'image_url', 'captured_at', 'lat', 'lon', 'status', 'qc', 'qc_score', 'created_at', 'signed_image_url'
        )

    def get_signed_image_url(self, obj):
        try:
            if not obj.image_url:
                return None
            uri = obj.image_url
            if uri.startswith('supabase://'):
                _, rest = uri.split('://', 1)
                bucket, path = rest.split('/', 1)
                return storage_signed_url(bucket, path, 300)
        except Exception:
            return None
        return None
