from django.contrib import admin
from .models import Observation

# Register your models here.


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ('id', 'captured_at', 'lat', 'lon', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('id', 'device_info', 'notes')
