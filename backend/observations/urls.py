from django.urls import path
from .views import ObservationListCreate, ObservationSignedUrl, ObservationRefCreate

urlpatterns = [
    path('v1/observations', ObservationListCreate.as_view(), name='observations'),
    path('v1/observations/ref', ObservationRefCreate.as_view(), name='observations-ref'),
    path('v1/observations/<uuid:obs_id>/signed_url', ObservationSignedUrl.as_view(), name='observation-signed-url'),
]