from rest_framework.routers import DefaultRouter
from .views import ObservationViewSet

router = DefaultRouter()
router.register(r"observations", ObservationViewSet, basename="observations")
urlpatterns = router.urls
