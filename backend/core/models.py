from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator


class User(AbstractUser):
    """Extended user model for HyacinthWatch"""
    ROLE_CHOICES = [
        ('citizen', 'Citizen Scientist'),
        ('researcher', 'Researcher'),
        ('admin', 'Administrator'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='citizen')
    organization = models.CharField(max_length=255, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.username} ({self.role})"


class Observation(models.Model):
    """Water hyacinth observation model"""
    STATUS_CHOICES = [
        ('pending', 'Pending QC'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('processing', 'Processing'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='observations')
    image = models.ImageField(upload_to='observations/%Y/%m/%d/')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location_name = models.CharField(max_length=255, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    coverage_estimate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        blank=True, 
        null=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Estimated coverage percentage (0-100%)"
    )
    water_body_type = models.CharField(max_length=100, blank=True, null=True)
    weather_conditions = models.CharField(max_length=255, blank=True, null=True)
    captured_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Observation {self.id} by {self.user.username} - {self.status}"


class QualityControlScore(models.Model):
    """Quality control scores for observations"""
    SCORE_CHOICES = [
        (1, 'Poor'),
        (2, 'Fair'),
        (3, 'Good'),
        (4, 'Very Good'),
        (5, 'Excellent'),
    ]
    
    observation = models.OneToOneField(
        Observation, 
        on_delete=models.CASCADE, 
        related_name='qc_score'
    )
    reviewer = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='reviewed_observations'
    )
    image_quality = models.IntegerField(
        choices=SCORE_CHOICES,
        help_text="Overall image quality and clarity"
    )
    species_visibility = models.IntegerField(
        choices=SCORE_CHOICES,
        help_text="How clearly water hyacinth is visible"
    )
    location_accuracy = models.IntegerField(
        choices=SCORE_CHOICES,
        help_text="Accuracy of location data"
    )
    metadata_completeness = models.IntegerField(
        choices=SCORE_CHOICES,
        help_text="Completeness of observation metadata"
    )
    overall_score = models.DecimalField(
        max_digits=3, 
        decimal_places=2,
        validators=[MinValueValidator(1.0), MaxValueValidator(5.0)]
    )
    comments = models.TextField(blank=True, null=True)
    automated_flags = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Calculate overall score as average of individual scores
        scores = [
            self.image_quality,
            self.species_visibility,
            self.location_accuracy,
            self.metadata_completeness
        ]
        self.overall_score = sum(scores) / len(scores)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"QC Score {self.overall_score} for Observation {self.observation.id}"


class SegmentationResult(models.Model):
    """AI segmentation results for water hyacinth coverage"""
    observation = models.OneToOneField(
        Observation,
        on_delete=models.CASCADE,
        related_name='segmentation'
    )
    segmented_image = models.ImageField(upload_to='segmentations/%Y/%m/%d/')
    coverage_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    confidence_score = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="AI model confidence (0-1)"
    )
    model_version = models.CharField(max_length=50)
    processing_metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Segmentation for Observation {self.observation.id} - {self.coverage_percentage}%"
