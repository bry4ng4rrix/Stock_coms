from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, viewsets
from django.db.models import Sum, F, DecimalField

from .models import CustomUser, Product, MagasinProfile, Sale
from .serializers import RegisterSerializer, ProductSerializer, SaleSerializer
from .permissions import IsAdmin
from rest_framework_simplejwt.views import TokenViewBase
from .authentication import CustomTokenObtainPairSerializer

# =========================
# AUTH LOGIN
# =========================
class CustomLoginView(TokenViewBase):
    serializer_class = CustomTokenObtainPairSerializer

# =========================
# REGISTER
# =========================
class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Inscription réussie"})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# =========================
# APPROVE USER
# =========================
class ApproveUserView(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request, user_id):
        current_user = request.user
        if current_user.role not in ["admin", "magasin"]:
            return Response({"error": "Permission refusée"}, status=403)
        try:
            user = CustomUser.objects.get(id=user_id)
            user.is_confirmed = True
            user.save()
            return Response({"message": "Utilisateur approuvé"})
        except CustomUser.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)

# =========================
# MY PROFILE
# =========================
class Myprofile(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_confirmed": user.is_confirmed,
        })

# =========================
# ROLE MANAGEMENT
# =========================
class RoleManagementView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    def put(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id)
            new_role = request.data.get("role")
            if new_role not in ["admin", "magasin", "employer"]:
                return Response({"error": "Rôle invalide. Les rôles valides sont: admin, magasin, employer"}, status=status.HTTP_400_BAD_REQUEST)
            old_role = user.role
            user.role = new_role
            user.save()
            return Response({
                "message": f"Rôle modifié de {old_role} à {new_role}",
                "user_id": user.id,
                "email": user.email,
                "new_role": user.role,
            })
        except CustomUser.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=status.HTTP_404_NOT_FOUND)

# =========================
# TOTALS VIEW
# =========================
class TotalsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        total_unit = Product.objects.aggregate(total=Sum('unit_price'))['total'] or 0
        total_shell = Product.objects.aggregate(total=Sum('shell_price'))['total'] or 0
        return Response({
            'total_unit_price': total_unit,
            'total_shell_price': total_shell,
        })

# =========================
# PROFIT VIEW
# =========================
class ProfitView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        revenue = Sale.objects.aggregate(
            total=Sum(F('sale_price') * F('quantity'), output_field=DecimalField())
        )['total'] or 0
        cost = Sale.objects.aggregate(
            total=Sum(F('product__unit_price') * F('quantity'), output_field=DecimalField())
        )['total'] or 0
        profit = revenue - cost
        return Response({'profit': profit})

# =========================
# SALE VIEWSET
# =========================
class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Sale.objects.all()
        elif user.role == "magasin":
            magasin = MagasinProfile.objects.get(user=user)
            return Sale.objects.filter(product__magasin=magasin)
        elif user.role == "employer":
            return Sale.objects.filter(product__magasin__employers__user=user)
        return Sale.objects.none()
    def perform_create(self, serializer):
        sale = serializer.save()
        # Deduct the sold quantity from the product's stock
        product = sale.product
        product.initial_quantity -= sale.quantity
        product.save()

# =========================
# PRODUCT VIEWSET
# =========================
class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return Product.objects.all()
        elif user.role == "magasin":
            magasin = MagasinProfile.objects.get(user=user)
            return Product.objects.filter(magasin=magasin)
        elif user.role == "employer":
            return Product.objects.filter(magasin__employers__user=user)
        return Product.objects.none()
    def perform_create(self, serializer):
        user = self.request.user
        magasin = None
        if user.role == "magasin":
            magasin = MagasinProfile.objects.get(user=user)
        elif user.role == "admin":
            magasin_id = self.request.data.get("magasin")
            magasin = MagasinProfile.objects.get(id=magasin_id)
        serializer.save(magasin=magasin)
    def update(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Seul admin peut modifier"}, status=403)
        return super().update(request, *args, **kwargs)
    def destroy(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Seul admin peut supprimer"}, status=403)
        return super().destroy(request, *args, **kwargs)