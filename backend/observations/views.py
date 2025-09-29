from django.shortcuts import render
import json
from datetime import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Observation
from .serializer import ObservationSerializer

# Create your views here.
ISO_FORMATS = [
    '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%S.%f',
    '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%dT%H:%M:%S'
]


def parse_iso(dt: str):
    if not dt:
        return None
    for fmt in ISO_FORMATS:
        try:
            return datetime.strptime(dt, fmt)
        except Exception:
            pass
    try:
        return datetime.fromisoformat(dt.replace('Z', '+00:00'))
    except Exception:
        return None


class ObservationListCreate(APIView):
    def get(self, request):
        qs = Observation.objects.order_by('-created_at')[:50]
        data = ObservationSerializer(qs, many=True, context={
                                     'request': request}).data
        return Response({'results': data})

    def post(self, request):
        # Extract uploaded file
        file = request.FILES.get('image')
        if not file:
            return Response({'detail': 'image is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Extract metadata
        raw = request.data.get('metadata', '{}')
        try:
            meta = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            return Response({'detail': 'metadata must be valid JSON string'}, status=status.HTTP_400_BAD_REQUEST)

        # Extract and format datetime
        dt = parse_iso(meta.get('captured_at'))
        if dt is None:
            return Response({'detail': 'captured_at (ISO8601) is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Create observation
        obs = Observation.objects.create(
            id=meta.get('id') or None,  # accept client UUID if provided
            image=file,
            captured_at=dt,
            lat=meta.get('lat'),
            lon=meta.get('lon'),
            location_accuracy_m=meta.get('location_accuracy_m'),
            device_info=meta.get('device_info'),
            notes=meta.get('notes'),
            status='received',
        )

        serializer = ObservationSerializer(obs, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)
