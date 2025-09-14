from rest_framework import serializers
from backend.core.models import User, Observation, QualityControlScore, SegmentationResult


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'organization', 'bio', 'location', 'date_joined')
        read_only_fields = ('id', 'date_joined')


class ObservationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    qc_score = serializers.SerializerMethodField()
    segmentation = serializers.SerializerMethodField()

    class Meta:
        model = Observation
        fields = '__all__'
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')

    def get_qc_score(self, obj):
        if hasattr(obj, 'qc_score'):
            return QualityControlScoreSerializer(obj.qc_score).data
        return None

    def get_segmentation(self, obj):
        if hasattr(obj, 'segmentation'):
            return SegmentationResultSerializer(obj.segmentation).data
        return None

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class ObservationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Observation
        fields = ('image', 'latitude', 'longitude', 'location_name', 'notes', 
                 'coverage_estimate', 'water_body_type', 'weather_conditions', 'captured_at')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class QualityControlScoreSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)

    class Meta:
        model = QualityControlScore
        fields = '__all__'
        read_only_fields = ('id', 'reviewer', 'overall_score', 'created_at', 'updated_at')

    def create(self, validated_data):
        validated_data['reviewer'] = self.context['request'].user
        return super().create(validated_data)


class SegmentationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = SegmentationResult
        fields = '__all__'
        read_only_fields = ('id', 'created_at')