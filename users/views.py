from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, viewsets
from django.db.models import Sum, F, DecimalField, Count
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta

from .models import CustomUser, Product, MagasinProfile, Sale, EmployerProfile, AdminProfile
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
            user = serializer.save()
            return Response({"message": "Inscription réussie", "id": user.id})
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
        data = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "is_confirmed": user.is_confirmed,
        }
        if user.role == "admin":
            try:
                p = user.admin_profile
                data["company_name"] = p.company_name
            except AdminProfile.DoesNotExist:
                pass
        elif user.role == "magasin":
            try:
                p = user.magasin_profile
                data["shop_name"] = p.shop_name
                data["magasin_id"] = p.id
            except Exception:
                pass
        elif user.role == "employer":
            try:
                p = user.employer_profile
                data["position"] = p.position
                if p.magasin:
                    data["magasin_id"] = p.magasin.id
                    data["shop_name"] = p.magasin.shop_name
            except Exception:
                pass
        return Response(data)

    def patch(self, request):
        user = request.user
        full_name = request.data.get("full_name")
        phone = request.data.get("phone")
        if full_name:
            user.full_name = full_name
        if phone is not None:
            user.phone = phone
        user.save()
        return Response({"message": "Profil mis à jour"})

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
        base_qs = Sale.objects.select_related('product', 'magasin', 'seller')
        if user.role == "admin":
            return base_qs
        elif user.role == "magasin":
            magasin = MagasinProfile.objects.get(user=user)
            return base_qs.filter(product__magasin=magasin)
        elif user.role == "employer":
            return base_qs.filter(product__magasin__employers__user=user)
        return Sale.objects.none()
    def perform_create(self, serializer):
        product = serializer.validated_data.get('product')
        sale = serializer.save(seller=self.request.user, magasin=product.magasin)
        # Deduct the sold quantity from the product's stock
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
        base_qs = Product.objects.select_related('magasin')
        if user.role == "admin":
            return base_qs
        elif user.role == "magasin":
            magasin = MagasinProfile.objects.get(user=user)
            return base_qs.filter(magasin=magasin)
        elif user.role == "employer":
            return base_qs.filter(magasin__employers__user=user)
        return Product.objects.none()
    def perform_create(self, serializer):
        user = self.request.user
        magasin = None
        if user.role == "magasin":
            magasin = MagasinProfile.objects.get(user=user)
        elif user.role == "admin":
            magasin_id = self.request.data.get("magasin")
            if magasin_id:
                try:
                    magasin = MagasinProfile.objects.get(id=magasin_id)
                except MagasinProfile.DoesNotExist:
                    pass
        elif user.role == "employer":
            try:
                employer = EmployerProfile.objects.get(user=user)
                magasin = employer.magasin
            except EmployerProfile.DoesNotExist:
                pass
        serializer.save(magasin=magasin)
    def update(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Seul admin peut modifier"}, status=403)
        return super().update(request, *args, **kwargs)
    def destroy(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Seul admin peut supprimer"}, status=403)
        return super().destroy(request, *args, **kwargs)

# =========================
# USERS BY MAGASIN VIEW
# =========================
class UsersByMagasinView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        response_data = []

        # Admin can see all magasins
        if user.role == "admin":
            magasins = MagasinProfile.objects.all()
        # Magasin can see only their own magasin
        elif user.role == "magasin":
            magasins = MagasinProfile.objects.filter(user=user)
        # Employer can see only their own magasin
        elif user.role == "employer":
            try:
                employer_profile = EmployerProfile.objects.get(user=user)
                if employer_profile.magasin:
                    magasins = MagasinProfile.objects.filter(id=employer_profile.magasin.id)
                else:
                    return Response([])
            except EmployerProfile.DoesNotExist:
                return Response({"error": "Employer profile not found"}, status=404)
        else:
            return Response({"error": "Role not supported"}, status=403)

        for mag in magasins:
            manager_data = {
                "id": mag.user.id,
                "full_name": mag.user.full_name,
                "email": mag.user.email,
                "is_confirmed": mag.user.is_confirmed,
                "role": mag.user.role,
            } if mag.user else None

            employers_qs = EmployerProfile.objects.filter(magasin=mag)
            employers_list = []
            for emp in employers_qs:
                employers_list.append({
                    "id": emp.user.id,
                    "full_name": emp.user.full_name,
                    "email": emp.user.email,
                    "is_confirmed": emp.user.is_confirmed,
                    "position": emp.position,
                    "role": emp.user.role,
                })

            response_data.append({
                "magasin_id": mag.id,
                "shop_name": mag.shop_name,
                "manager": manager_data,
                "employers": employers_list
            })

        return Response(response_data)


class MagasinStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == "admin":
            magasins = MagasinProfile.objects.all()
        elif user.role == "magasin":
            magasins = MagasinProfile.objects.filter(user=user)
        elif user.role == "employer":
            try:
                employer_profile = EmployerProfile.objects.get(user=user)
                if employer_profile.magasin:
                    magasins = MagasinProfile.objects.filter(id=employer_profile.magasin.id)
                else:
                    return Response([])
            except EmployerProfile.DoesNotExist:
                return Response({"error": "Employer profile not found"}, status=404)
        else:
            return Response({"error": "Role not supported"}, status=403)

        response_data = []

        for mag in magasins:
            products_qs = Product.objects.filter(magasin=mag)
            sales_qs = Sale.objects.filter(magasin=mag)

            total_products = products_qs.count()
            total_stock_value = products_qs.aggregate(
                total=Coalesce(Sum(F('initial_quantity') * F('unit_price'), output_field=DecimalField()), 0)
            )['total']
            total_sold_value = sales_qs.aggregate(
                total=Coalesce(Sum('total_price'), 0)
            )['total']

            response_data.append({
                "magasin_id": mag.id,
                "shop_name": mag.shop_name,
                "total_products": total_products,
                "total_stock_value": total_stock_value,
                "total_sold_value": total_sold_value,
            })

        return Response(response_data)


# =========================
# DASHBOARD VIEW
# =========================
class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        role = user.role
        today = timezone.now().date()

        if role == "admin":
            # KPIs
            total_revenue = Sale.objects.aggregate(total=Sum('total_price'))['total'] or 0
            total_profit = Sale.objects.aggregate(total=Sum(F('sale_price') * F('quantity') - F('product__unit_price') * F('quantity'), output_field=DecimalField()))['total'] or 0
            total_stock_value = Product.objects.aggregate(total=Sum(F('initial_quantity') * F('unit_price'), output_field=DecimalField()))['total'] or 0
            total_magasins = MagasinProfile.objects.count()
            total_employers = EmployerProfile.objects.count()
            total_products = Product.objects.count()
            total_sales = Sale.objects.count()
            sales_today = Sale.objects.filter(sold_at__date=today).count()
            profit_today = Sale.objects.filter(sold_at__date=today).aggregate(total=Sum(F('sale_price') * F('quantity') - F('product__unit_price') * F('quantity'), output_field=DecimalField()))['total'] or 0
            low_stock_count = Product.objects.filter(initial_quantity__lte=F('alert_threshold')).count()
            expired_count = Product.objects.filter(expiry_date__lt=today).count()
            expiring_soon_count = Product.objects.filter(expiry_date__range=[today, today + timedelta(days=30)]).count()

            # Lists
            top_products = Sale.objects.values('product__name', 'product__magasin__shop_name').annotate(
                qty_sold=Sum('quantity'),
                profit=Sum(F('sale_price') * F('quantity') - F('product__unit_price') * F('quantity'), output_field=DecimalField())
            ).order_by('-qty_sold')[:5]

            bottom_products = Product.objects.values('name', 'initial_quantity').annotate(
                qty_sold=Coalesce(Sum('sales__quantity'), 0)
            ).order_by('qty_sold')[:5]

            low_stock_list = Product.objects.filter(initial_quantity__lte=F('alert_threshold')).values(
                'name', 'initial_quantity', 'alert_threshold', 'magasin__shop_name'
            )[:5]

            expired_list = Product.objects.filter(expiry_date__lt=today).values(
                'name', 'expiry_date', 'magasin__shop_name'
            )[:5]

            expiring_soon_list = Product.objects.filter(expiry_date__range=[today, today + timedelta(days=30)]).values(
                'name', 'expiry_date', 'magasin__shop_name'
            )[:5]

            recent_sales_qs = Sale.objects.select_related('product', 'magasin', 'seller').order_by('-sold_at')[:5]
            recent_sales = []
            for sale in recent_sales_qs:
                recent_sales.append({
                    "product_name": sale.product.name,
                    "quantity": sale.quantity,
                    "sale_price": sale.sale_price,
                    "total_price": sale.total_price,
                    "seller_name": sale.seller.full_name if sale.seller else None,
                    "shop_name": sale.magasin.shop_name if sale.magasin else None,
                    "sold_at": sale.sold_at
                })

            best_employees = Sale.objects.values('seller__full_name').annotate(
                sales_count=Count('id'),
                total_amount=Sum('total_price'),
                profit=Sum(F('sale_price') * F('quantity') - F('product__unit_price') * F('quantity'), output_field=DecimalField())
            ).order_by('-total_amount')[:5]

            best_shops = Sale.objects.values('magasin__shop_name').annotate(
                total_amount=Sum('total_price'),
                profit=Sum(F('sale_price') * F('quantity') - F('product__unit_price') * F('quantity'), output_field=DecimalField()),
                sales_count=Count('id'),
                total_stock=Coalesce(Sum('product__initial_quantity'), 0)
            ).order_by('-total_amount')[:5]

            return Response({
                "role": role,
                "kpis": {
                    "total_revenue": total_revenue,
                    "total_profit": total_profit,
                    "total_stock_value": total_stock_value,
                    "total_magasins": total_magasins,
                    "total_employers": total_employers,
                    "total_products": total_products,
                    "total_sales": total_sales,
                    "sales_today": sales_today,
                    "profit_today": profit_today,
                    "low_stock_count": low_stock_count,
                    "expired_count": expired_count,
                    "expiring_soon_count": expiring_soon_count
                },
                "lists": {
                    "top_products": top_products,
                    "bottom_products": bottom_products,
                    "low_stock_products": low_stock_list,
                    "expired_products": expired_list,
                    "expiring_soon_products": expiring_soon_list,
                    "recent_sales": recent_sales,
                    "best_employees": best_employees,
                    "best_shops": best_shops
                }
            })

        elif role == "magasin":
            try:
                magasin = MagasinProfile.objects.get(user=user)
            except MagasinProfile.DoesNotExist:
                return Response({"error": "Magasin profile not found"}, status=404)

            # KPIs (without exposing company wide unit_price)
            sales_today = Sale.objects.filter(magasin=magasin, sold_at__date=today).count()
            profit_today = Sale.objects.filter(magasin=magasin, sold_at__date=today).aggregate(total=Sum(F('sale_price') * F('quantity') - F('product__unit_price') * F('quantity'), output_field=DecimalField()))['total'] or 0
            stock_value = Product.objects.filter(magasin=magasin).aggregate(total=Sum(F('initial_quantity') * F('unit_price'), output_field=DecimalField()))['total'] or 0
            total_products = Product.objects.filter(magasin=magasin).count()
            total_sales = Sale.objects.filter(magasin=magasin).count()
            low_stock_count = Product.objects.filter(magasin=magasin, initial_quantity__lte=F('alert_threshold')).count()
            expired_count = Product.objects.filter(magasin=magasin, expiry_date__lt=today).count()

            # Lists (never showing individual unit_price)
            top_products = Sale.objects.filter(magasin=magasin).values('product__name').annotate(
                qty_sold=Sum('quantity')
            ).order_by('-qty_sold')[:5]

            bottom_products = Product.objects.filter(magasin=magasin).values('name', 'initial_quantity').annotate(
                qty_sold=Coalesce(Sum('sales__quantity'), 0)
            ).order_by('qty_sold')[:5]

            low_stock_list = Product.objects.filter(magasin=magasin, initial_quantity__lte=F('alert_threshold')).values(
                'name', 'initial_quantity'
            )[:5]

            recent_sales_qs = Sale.objects.filter(magasin=magasin).select_related('product', 'seller').order_by('-sold_at')[:5]
            recent_sales = []
            for sale in recent_sales_qs:
                recent_sales.append({
                    "product_name": sale.product.name,
                    "quantity": sale.quantity,
                    "total_price": sale.total_price,
                    "seller_name": sale.seller.full_name if sale.seller else None,
                    "sold_at": sale.sold_at
                })

            best_sellers = Sale.objects.filter(magasin=magasin).values('seller__full_name').annotate(
                sales_count=Count('id'),
                total_amount=Sum('total_price')
            ).order_by('-total_amount')[:5]

            return Response({
                "role": role,
                "kpis": {
                    "sales_today": sales_today,
                    "profit_today": profit_today,
                    "stock_value": stock_value,
                    "total_products": total_products,
                    "total_sales": total_sales,
                    "low_stock_count": low_stock_count,
                    "expired_count": expired_count
                },
                "lists": {
                    "top_products": top_products,
                    "bottom_products": bottom_products,
                    "low_stock_products": low_stock_list,
                    "recent_sales": recent_sales,
                    "best_sellers": best_sellers
                }
            })

        elif role == "employer":
            try:
                employer_profile = EmployerProfile.objects.get(user=user)
                magasin = employer_profile.magasin
            except EmployerProfile.DoesNotExist:
                return Response({"error": "Employer profile not found"}, status=404)

            # KPIs
            my_sales_today = Sale.objects.filter(seller=user, sold_at__date=today).count()
            total_amount_sold = Sale.objects.filter(seller=user).aggregate(total=Sum('total_price'))['total'] or 0
            products_sold_count = Sale.objects.filter(seller=user).aggregate(total=Sum('quantity'))['total'] or 0
            clients_count = Sale.objects.filter(seller=user).count()

            # Lists
            recent_sales_qs = Sale.objects.filter(seller=user).select_related('product').order_by('-sold_at')[:5]
            recent_sales = []
            for sale in recent_sales_qs:
                recent_sales.append({
                    "product_name": sale.product.name,
                    "quantity": sale.quantity,
                    "total_price": sale.total_price,
                    "sold_at": sale.sold_at
                })

            return Response({
                "role": role,
                "kpis": {
                    "my_sales_today": my_sales_today,
                    "total_amount_sold": total_amount_sold,
                    "products_sold_count": products_sold_count,
                    "clients_count": clients_count
                },
                "lists": {
                    "recent_sales": recent_sales
                }
            })

        else:
            return Response({"error": "Role not supported"}, status=403)


# =========================
# API ENDPOINTS LIST VIEW
# =========================
class ApiEndpointsListView(APIView):
    permission_classes = []  # Publicly accessible endpoint exploration

    def get(self, request):
        endpoints = [
            {
                "path": "/api/users/login/",
                "method": "POST",
                "auth_required": False,
                "roles_allowed": ["Any"],
                "description": "Authentifie un utilisateur et retourne les tokens JWT (access & refresh)."
            },
            {
                "path": "/api/users/refresh/",
                "method": "POST",
                "auth_required": False,
                "roles_allowed": ["Any"],
                "description": "Rafraîchit le token d'accès JWT expiré."
            },
            {
                "path": "/api/users/register/",
                "method": "POST",
                "auth_required": False,
                "roles_allowed": ["Any"],
                "description": "Inscrit un nouvel utilisateur (admin créé automatiquement, magasin/employé en attente)."
            },
            {
                "path": "/api/users/me/",
                "method": "GET",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "Retourne le profil complet et les informations de l'utilisateur connecté."
            },
            {
                "path": "/api/users/approve/<user_id>/",
                "method": "PUT",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin"],
                "description": "Approuve et active un compte utilisateur en attente de validation."
            },
            {
                "path": "/api/users/role/<user_id>/",
                "method": "PUT",
                "auth_required": True,
                "roles_allowed": ["admin"],
                "description": "Modifie le rôle d'un utilisateur existant."
            },
            {
                "path": "/api/users/products/",
                "method": "GET, POST",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "GET: Liste les produits (prix d'achat masqué pour magasin/employé). POST: Crée un nouveau produit."
            },
            {
                "path": "/api/users/products/<id>/",
                "method": "GET, PUT, PATCH, DELETE",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "Consulte, modifie ou supprime un produit spécifique (Modifications/Suppression réservées aux admins)."
            },
            {
                "path": "/api/users/sales/",
                "method": "GET, POST",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "GET: Historique des ventes de produits (filtré par magasin). POST: Enregistre une nouvelle transaction de vente."
            },
            {
                "path": "/api/users/sales/totals/",
                "method": "GET",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "Calcule la somme globale des unit_price et shell_price de tous les produits."
            },
            {
                "path": "/api/users/sales/profit/",
                "method": "GET",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "Calcule le bénéfice réel total (somme de (sale_price - unit_price) * quantity)."
            },
            {
                "path": "/api/users/magasins/users/",
                "method": "GET",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "Retourne la liste de tous les utilisateurs (managers et employés) regroupés par magasin."
            },
            {
                "path": "/api/users/dashboard/",
                "method": "GET",
                "auth_required": True,
                "roles_allowed": ["admin", "magasin", "employer"],
                "description": "Tableau de bord analytique dynamique adapté en temps réel au profil de l'utilisateur."
            },
            {
                "path": "/api/users/endpoints/",
                "method": "GET",
                "auth_required": False,
                "roles_allowed": ["Any"],
                "description": "Liste l'ensemble des endpoints disponibles avec leurs descriptions et permissions."
            }
        ]
        return Response(endpoints)


# =========================
# CHANGE PASSWORD VIEW
# =========================
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        if not old_password or not new_password:
            return Response({"detail": "Champs requis manquants"}, status=400)
        if not user.check_password(old_password):
            return Response({"detail": "Mot de passe actuel incorrect"}, status=400)
        if len(new_password) < 6:
            return Response({"detail": "Le mot de passe doit contenir au moins 6 caractères"}, status=400)
        user.set_password(new_password)
        user.save()
        return Response({"message": "Mot de passe changé avec succès"})


# =========================
# PENDING USERS VIEW
# =========================
class PendingUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ["admin", "magasin"]:
            return Response({"error": "Permission refusée"}, status=403)

        if user.role == "admin":
            pending_qs = CustomUser.objects.filter(is_confirmed=False)
        else:
            try:
                magasin = MagasinProfile.objects.get(user=user)
                employer_ids = EmployerProfile.objects.filter(magasin=magasin).values_list("user_id", flat=True)
                pending_qs = CustomUser.objects.filter(is_confirmed=False, id__in=employer_ids)
            except MagasinProfile.DoesNotExist:
                return Response({"error": "Magasin introuvable"}, status=404)

        data = []
        for u in pending_qs:
            item = {
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at,
            }
            if u.role == "employer":
                try:
                    ep = u.employer_profile
                    item["position"] = ep.position
                    if ep.magasin:
                        item["shop_name"] = ep.magasin.shop_name
                except Exception:
                    pass
            elif u.role == "magasin":
                try:
                    mp = u.magasin_profile
                    item["shop_name"] = mp.shop_name
                except Exception:
                    pass
            data.append(item)

        return Response(data)


# =========================
# DELETE USER VIEW
# =========================
class DeleteUserView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id):
        if request.user.role not in ["admin", "magasin"]:
            return Response({"error": "Permission refusée"}, status=403)
        try:
            user = CustomUser.objects.get(id=user_id)
            if user.id == request.user.id:
                return Response({"error": "Vous ne pouvez pas vous supprimer vous-même"}, status=400)
            user.delete()
            return Response({"message": "Utilisateur supprimé"})
        except CustomUser.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)


# =========================
# REJECT USER VIEW
# =========================
class RejectUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, user_id):
        if request.user.role not in ["admin", "magasin"]:
            return Response({"error": "Permission refusée"}, status=403)
        try:
            user = CustomUser.objects.get(id=user_id)
            user.delete()
            return Response({"message": "Utilisateur rejeté et supprimé"})
        except CustomUser.DoesNotExist:
            return Response({"error": "Utilisateur introuvable"}, status=404)