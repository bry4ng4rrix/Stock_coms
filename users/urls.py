from django.urls import path

from .views import (RegisterView,ApproveUserView,Myprofile)

from rest_framework_simplejwt.views import (TokenRefreshView)
from rest_framework_simplejwt.views import TokenViewBase
from .authentication import CustomTokenObtainPairSerializer
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet

router = DefaultRouter()

router.register(
    r"products",
    ProductViewSet,
    basename="products"
)


class CustomLoginView(TokenViewBase):

    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [

    # AUTH
    path("login/",CustomLoginView.as_view()),
    path("refresh/",TokenRefreshView.as_view()),

    # REGISTER
    path("register/",RegisterView.as_view()),

    # MY PROFILE
    path("me/",Myprofile.as_view()),

    # APPROVE
    path("approve/<int:user_id>/",ApproveUserView.as_view()),

] + router.urls
