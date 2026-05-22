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
    AdminMagasinProfitView,
    SaleViewSet,
    MovementViewSet,
    AdminMagasinOverviewView,
    UsersByMagasinView,
    MagasinStatsView,
    DashboardView,
    ApiEndpointsListView,
    PendingUsersView,
    DeleteUserView,
    RejectUserView,
    ChangePasswordView,
    NotificationViewSet,
    MagasinViewSet,
)

from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenViewBase
from .authentication import CustomTokenObtainPairSerializer
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# Register product and sale viewsets
router.register(r"products", ProductViewSet, basename="products")
router.register(r"sales", SaleViewSet, basename="sales")
router.register(r"movements", MovementViewSet, basename="movements")
router.register(r"notifications", NotificationViewSet, basename="notifications")
router.register(r"magasins", MagasinViewSet, basename="magasins")

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
    # Totals and profit (prepended with sales/)
    path("sales/totals/", TotalsView.as_view()),
    path("sales/profit/", ProfitView.as_view()),
    path("sales/profit-by-magasins/", AdminMagasinProfitView.as_view()),
    # List of users grouped by magasin
    path("magasins/users/", UsersByMagasinView.as_view()),
    # Store statistics by magasin
    path("magasins/stats/", MagasinStatsView.as_view()),
    # Overview détaillée des magasins pour l'admin
    path("magasins/overview/", AdminMagasinOverviewView.as_view()),
    # Dashboard stats
    path("dashboard/", DashboardView.as_view()),
    # Pending users (awaiting approval)
    path("change-password/", ChangePasswordView.as_view()),
    path("pending/", PendingUsersView.as_view()),
    # Delete user
    path("delete/<int:user_id>/", DeleteUserView.as_view()),
    # Reject user
    path("reject/<int:user_id>/", RejectUserView.as_view()),
    # Explore endpoints
    path("endpoints/", ApiEndpointsListView.as_view()),
] + router.urls
