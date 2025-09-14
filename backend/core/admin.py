from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Observation, QualityControlScore, SegmentationResult


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'organization', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff', 'date_joined')
    search_fields = ('username', 'email', 'organization')
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('HyacinthWatch Profile', {
            'fields': ('role', 'organization', 'bio', 'location')
        }),
    )


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'status', 'latitude', 'longitude', 'coverage_estimate', 'captured_at', 'created_at')
    list_filter = ('status', 'water_body_type', 'created_at', 'captured_at')
    search_fields = ('user__username', 'location_name', 'notes')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'


@admin.register(QualityControlScore)
class QualityControlScoreAdmin(admin.ModelAdmin):
    list_display = ('observation', 'reviewer', 'overall_score', 'image_quality', 'species_visibility', 'created_at')
    list_filter = ('overall_score', 'image_quality', 'species_visibility', 'created_at')
    search_fields = ('observation__id', 'reviewer__username', 'comments')
    readonly_fields = ('overall_score', 'created_at', 'updated_at')


@admin.register(SegmentationResult)
class SegmentationResultAdmin(admin.ModelAdmin):
    list_display = ('observation', 'coverage_percentage', 'confidence_score', 'model_version', 'created_at')
    list_filter = ('model_version', 'created_at')
    search_fields = ('observation__id',)
    readonly_fields = ('created_at',)
