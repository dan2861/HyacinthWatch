from django.shortcuts import render
from rest_framework import viewsets
from observations.models import Observation
from .serializers import ObservationSerializer


class ObservationViewSet(viewsets.ModelViewSet):
    queryset = Observation.objects.order_by("-created_at")
    serializer_class = ObservationSerializer
