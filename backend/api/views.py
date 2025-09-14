from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import authenticate
from django.db.models import Q
from backend.core.models import User, Observation, QualityControlScore, SegmentationResult
from .serializers import (
    UserSerializer, ObservationSerializer, ObservationCreateSerializer,
    QualityControlScoreSerializer, SegmentationResultSerializer
)


class ObservationListCreateView(generics.ListCreateAPIView):
    """List all observations or create a new observation"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ObservationCreateSerializer
        return ObservationSerializer
    
    def get_queryset(self):
        queryset = Observation.objects.all()
        
        # Filter by user's own observations if not researcher/admin
        user = self.request.user
        if user.role == 'citizen':
            queryset = queryset.filter(user=user)
        
        # Query parameters for filtering
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
            
        location = self.request.query_params.get('location')
        if location:
            queryset = queryset.filter(
                Q(location_name__icontains=location) |
                Q(notes__icontains=location)
            )
            
        return queryset.select_related('user').prefetch_related('qc_score', 'segmentation')


class ObservationDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete an observation"""
    serializer_class = ObservationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'citizen':
            return Observation.objects.filter(user=user)
        return Observation.objects.all()


class QualityControlListCreateView(generics.ListCreateAPIView):
    """List QC scores or create a new QC score"""
    serializer_class = QualityControlScoreSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        # Only researchers and admins can view/create QC scores
        user = self.request.user
        if user.role not in ['researcher', 'admin']:
            return QualityControlScore.objects.none()
        return QualityControlScore.objects.all()


class UserProfileView(generics.RetrieveUpdateAPIView):
    """Retrieve or update user profile"""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def observation_stats(request):
    """Get observation statistics"""
    user = request.user
    
    if user.role == 'citizen':
        queryset = Observation.objects.filter(user=user)
    else:
        queryset = Observation.objects.all()
    
    stats = {
        'total_observations': queryset.count(),
        'pending_qc': queryset.filter(status='pending').count(),
        'approved': queryset.filter(status='approved').count(),
        'rejected': queryset.filter(status='rejected').count(),
        'processing': queryset.filter(status='processing').count(),
    }
    
    return Response(stats)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def trigger_processing(request, observation_id):
    """Trigger QC and segmentation processing for an observation"""
    try:
        observation = Observation.objects.get(id=observation_id)
        
        # Check permissions
        user = request.user
        if user.role == 'citizen' and observation.user != user:
            return Response(
                {'error': 'Permission denied'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update status to processing
        observation.status = 'processing'
        observation.save()
        
        # Here we would trigger the Celery tasks
        # from backend.workers.tasks import process_observation_qc, process_segmentation
        # process_observation_qc.delay(observation.id)
        # process_segmentation.delay(observation.id)
        
        return Response({'message': 'Processing triggered successfully'})
        
    except Observation.DoesNotExist:
        return Response(
            {'error': 'Observation not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
