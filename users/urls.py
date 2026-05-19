from django.urls import path

# Import view classes and viewsets
from .views import (
    RegisterView,
    ApproveUserView,
    Myprofile,
    RoleManagementView,
    ProductViewSet,
    TotalsView,
    ProfitView,
    SaleViewSet,
)

from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenViewBase
from .authentication import CustomTokenObtainPairSerializer
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# Register product and sale viewsets
router.register(r"products", ProductViewSet, basename="products")
router.register(r"sales", SaleViewSet, basename="sales")

class CustomLoginView(TokenViewBase):
    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [
    # Auth
    path("login/", CustomLoginView.as_view()),
    path("refresh/", TokenRefreshView.as_view()),
    # Register
    path("register/", RegisterView.as_view()),
    # My profile
    path("me/", Myprofile.as_view()),
    # Approve user
    path("approve/<int:user_id>/", ApproveUserView.as_view()),
    # Role management
    path("role/<int:user_id>/", RoleManagementView.as_view()),
    # Totals and profit
    path("totals/", TotalsView.as_view()),
    path("profit/", ProfitView.as_view()),
] + router.urls
