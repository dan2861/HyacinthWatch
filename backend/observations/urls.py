from django.urls import path
from .views import ObservationListCreate

urlpatterns = [
    path('v1/observations', ObservationListCreate.as_view(), name='observations'),
]