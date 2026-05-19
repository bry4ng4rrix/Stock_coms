from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status ,viewsets


from .models import CustomUser ,Product, MagasinProfile
from .serializers import RegisterSerializer ,ProductSerializer


# =========================
# REGISTER
# =========================

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Inscription réussie"
            })
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


# =========================
# APPROVE USER
# =========================

class ApproveUserView(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request, user_id):
        current_user = request.user
        if current_user.role not in ["admin", "magasin"]:
            return Response({
                "error": "Permission refusée"
            }, status=403)
        try:
            user = CustomUser.objects.get(id=user_id)
            user.is_confirmed = True
            user.save()
            return Response({
                "message": "Utilisateur approuvé"
            })
        except CustomUser.DoesNotExist:
            return Response({
                "error": "Utilisateur introuvable"
            }, status=404)


class Myprofile(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        
        user = request.user
        
        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_confirmed": user.is_confirmed
        })



class ProductViewSet(viewsets.ModelViewSet):

    serializer_class = ProductSerializer

    permission_classes = [IsAuthenticated]

    # ============================
    # LISTE PRODUITS
    # ============================
    def get_queryset(self):

        user = self.request.user

        if user.role == "admin":

            return Product.objects.all()

        elif user.role == "magasin":

            magasin = MagasinProfile.objects.get(user=user)

            return Product.objects.filter(magasin=magasin)

        elif user.role == "employer":

            return Product.objects.filter(
                magasin__employers__user=user
            )

        return Product.objects.none()

    # ============================
    # CREATE
    # ============================
    def perform_create(self, serializer):

        user = self.request.user

        magasin = None

        if user.role == "magasin":

            magasin = MagasinProfile.objects.get(user=user)

        elif user.role == "admin":

            magasin_id = self.request.data.get("magasin")

            magasin = MagasinProfile.objects.get(id=magasin_id)

        serializer.save(magasin=magasin)

    # ============================
    # UPDATE / DELETE PERMISSION
    # ============================
    def update(self, request, *args, **kwargs):

        if request.user.role != "admin":

            return Response(
                {"error": "Seul admin peut modifier"},
                status=403
            )

        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):

        if request.user.role != "admin":

            return Response(
                {"error": "Seul admin peut supprimer"},
                status=403
            )

        return super().destroy(request, *args, **kwargs)