from django.urls import path
from .views import ObservationListCreate, ObservationSignedUrl, ObservationRefCreate
from .views import qc_summary, GameProfileView, debug_headers

urlpatterns = [
    path('v1/observations', ObservationListCreate.as_view(), name='observations'),
    path('v1/observations/ref', ObservationRefCreate.as_view(),
         name='observations-ref'),
    path('v1/observations/<uuid:obs_id>/signed_url',
         ObservationSignedUrl.as_view(), name='observation-signed-url'),
    path('v1/qc/summary', qc_summary, name='qc-summary'),
    path('v1/game/profile', GameProfileView.as_view(), name='game-profile'),
    path('v1/debug/headers', debug_headers, name='debug-headers'),
]
