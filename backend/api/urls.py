from django.urls import path
from . import views

urlpatterns = [
    path('observations/', views.ObservationListCreateView.as_view(), name='observation-list-create'),
    path('observations/<int:pk>/', views.ObservationDetailView.as_view(), name='observation-detail'),
    path('observations/<int:observation_id>/process/', views.trigger_processing, name='trigger-processing'),
    path('qc-scores/', views.QualityControlListCreateView.as_view(), name='qc-score-list-create'),
    path('profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('stats/', views.observation_stats, name='observation-stats'),
]