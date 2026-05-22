from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, viewsets
from rest_framework.decorators import action
from django.db.models import Sum, F, DecimalField, Count
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta

from .models import CustomUser, Product, MagasinProfile, Sale, EmployerProfile, AdminProfile, Movement
from .serializers import RegisterSerializer, ProductSerializer, SaleSerializer, MovementSerializer, NotificationSerializer
from .permissions import IsAdmin
from rest_framework_simplejwt.views import TokenViewBase
from .authentication import CustomTokenObtainPairSerializer
from .models import Notification


def _sale_purchase_price(sale):
    purchase_price = sale.purchase_price
    if purchase_price is None or purchase_price == 0:
        product = sale.product
        purchase_price = getattr(product, "purchase_price", None) or getattr(product, "unit_price", 0) or 0
    return purchase_price


def _sale_totals(sales_qs):
    total_revenue = 0
    total_cost = 0
    total_profit = 0
    total_quantity = 0

    for sale in sales_qs.select_related("product"):
        quantity = sale.quantity or 0
        sale_price = sale.sale_price or 0
        purchase_price = _sale_purchase_price(sale)

        total_revenue += sale_price * quantity
        total_cost += purchase_price * quantity
        total_profit += (sale_price - purchase_price) * quantity
        total_quantity += quantity

    return total_revenue, total_cost, total_profit, total_quantity

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
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        revenue, cost, profit, _ = _sale_totals(Sale.objects.all())
        return Response({
            'total_revenue': revenue,
            'total_cost': cost,
            'total_profit': profit,
        })


# =========================
# ADMIN MAGASIN PROFIT VIEW
# =========================
class AdminMagasinProfitView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        magasins = MagasinProfile.objects.filter(admin=request.user)

        data = []
        for magasin in magasins:
            sales_qs = Sale.objects.filter(magasin=magasin)
            total_revenue, total_cost, total_profit, total_quantity = _sale_totals(sales_qs)

            data.append({
                'magasin_id': magasin.id,
                'shop_name': magasin.shop_name,
                'total_quantity_sold': total_quantity,
                'total_revenue': total_revenue,
                'total_cost': total_cost,
                'total_profit': total_profit,
            })

        return Response({'profit_by_magasins': data})


class AdminMagasinOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        week_start = timezone.now() - timedelta(days=7)
        magasins = MagasinProfile.objects.filter(admin=request.user).select_related("user")

        response_data = []

        for magasin in magasins:
            products_qs = Product.objects.filter(magasin=magasin)
            sales_qs = Sale.objects.filter(magasin=magasin)

            total_stock_value = products_qs.aggregate(
                total=Coalesce(
                    Sum(F("initial_quantity") * F("purchase_price"), output_field=DecimalField()),
                    0,
                    output_field=DecimalField(),
                )
            )["total"]

            _, _, total_profit, _ = _sale_totals(sales_qs)

            response_data.append({
                "magasin_id": magasin.id,
                "shop_name": magasin.shop_name,
                "total_stock_value": total_stock_value,
                "total_profit": total_profit,
                "number_of_products": products_qs.count(),
                "number_of_sales_week": sales_qs.filter(sold_at__gte=week_start).count(),
                "number_of_employees": EmployerProfile.objects.filter(magasin=magasin).count(),
            })

        return Response({"magasins": response_data})


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
        validated = serializer.validated_data
        if validated.get('is_paid', True) and not validated.get('payment_date'):
            serializer.validated_data['payment_date'] = timezone.now()
        if not validated.get('is_paid', True) and not validated.get('payment_due_date'):
            serializer.validated_data['payment_due_date'] = (timezone.now().date() + timedelta(days=7))
        product = validated.get('product')
        old_qty = product.initial_quantity or 0
        sale = serializer.save(seller=self.request.user, magasin=product.magasin)
        product.initial_quantity -= sale.quantity
        product.total_profit += sale.total_profit
        product.save()
        Movement.objects.create(
            product=product,
            product_name=product.name,
            magasin=product.magasin,
            changed_by=self.request.user,
            previous_quantity=old_qty,
            new_quantity=product.initial_quantity,
            change=-sale.quantity,
            note=f"Vente par {self.request.user.full_name}"
        )


class MovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MovementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Movement.objects.select_related('product', 'magasin', 'changed_by')
        if user.role == 'admin':
            return qs
        elif user.role == 'magasin':
            try:
                magasin = MagasinProfile.objects.get(user=user)
                return qs.filter(magasin=magasin)
            except MagasinProfile.DoesNotExist:
                return Movement.objects.none()
        elif user.role == 'employer':
            try:
                employer = EmployerProfile.objects.get(user=user)
                if employer.magasin:
                    return qs.filter(magasin=employer.magasin)
            except EmployerProfile.DoesNotExist:
                pass
        return Movement.objects.none()


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
        product = serializer.save(magasin=magasin)
        Movement.objects.create(
            product=product,
            product_name=product.name,
            magasin=magasin,
            changed_by=user,
            previous_quantity=0,
            new_quantity=product.initial_quantity,
            change=product.initial_quantity,
            previous_unit_price=None,
            new_unit_price=product.unit_price,
            previous_shell_price=None,
            new_shell_price=product.shell_price,
            note=f"Nouveau produit créé par {user.full_name}"
        )
    def update(self, request, *args, **kwargs):
        user = request.user
        instance = self.get_object()
        old_qty = int(instance.initial_quantity or 0)
        old_unit_price = instance.unit_price
        old_shell_price = instance.shell_price
        old_name = instance.name
        old_reference = instance.reference
        old_brand = instance.brand
        old_category = instance.category
        old_description = instance.description
        old_expiry_date = instance.expiry_date

        if user.role == "admin":
            response = super().update(request, *args, **kwargs)
            new_instance = self.get_object()
            new_qty = int(new_instance.initial_quantity or 0)
            changed_fields = []
            movement_data = {
                'product': new_instance,
                'product_name': new_instance.name,
                'magasin': new_instance.magasin,
                'changed_by': user,
                'previous_quantity': old_qty,
                'new_quantity': new_qty,
                'change': new_qty - old_qty,
            }

            if 'initial_quantity' in request.data and new_qty != old_qty:
                changed_fields.append(f"stock {new_qty - old_qty:+d}")
            if 'unit_price' in request.data and float(new_instance.unit_price) != float(old_unit_price):
                movement_data['previous_unit_price'] = old_unit_price
                movement_data['new_unit_price'] = new_instance.unit_price
                changed_fields.append(f"prix unitaire {old_unit_price}→{new_instance.unit_price}")
            if 'shell_price' in request.data and float(new_instance.shell_price) != float(old_shell_price):
                movement_data['previous_shell_price'] = old_shell_price
                movement_data['new_shell_price'] = new_instance.shell_price
                changed_fields.append(f"prix caisse {old_shell_price}→{new_instance.shell_price}")
            if 'name' in request.data and new_instance.name != old_name:
                changed_fields.append("nom")
            if 'reference' in request.data and new_instance.reference != old_reference:
                changed_fields.append("référence")
            if 'brand' in request.data and new_instance.brand != old_brand:
                changed_fields.append("marque")
            if 'category' in request.data and new_instance.category != old_category:
                changed_fields.append("catégorie")
            if 'description' in request.data and new_instance.description != old_description:
                changed_fields.append("description")
            if 'expiry_date' in request.data and new_instance.expiry_date != old_expiry_date:
                changed_fields.append("date d'expiration")

            if changed_fields:
                movement_data['note'] = f"Mise à jour produit par {user.full_name} : {', '.join(changed_fields)}"
                Movement.objects.create(**movement_data)
                Notification.objects.create(
                    notif_type='product',
                    message=f"Mise à jour produit: {new_instance.name} ({', '.join(changed_fields)}) par {user.full_name}",
                    magasin=new_instance.magasin,
                    product=new_instance,
                    user=user
                )
            return response

        if user.role == "magasin":
            try:
                magasin = MagasinProfile.objects.get(user=user)
            except MagasinProfile.DoesNotExist:
                return Response({"error": "Magasin introuvable"}, status=404)

            if instance.magasin is None or instance.magasin.id != magasin.id:
                return Response({"error": "Seul admin peut modifier"}, status=403)

            blocked_fields = [
                'unit_price',
                'shell_price',
                'name',
                'reference',
                'brand',
                'category',
                'description',
                'expiry_date',
            ]
            if any(field in request.data for field in blocked_fields):
                return Response({"error": "Seuls les admins peuvent modifier les détails ou les prix du produit."}, status=403)

            if 'initial_quantity' not in request.data:
                return Response({"error": "Seul admin peut modifier"}, status=403)

            try:
                new_qty = int(request.data.get('initial_quantity'))
            except Exception:
                return Response({"error": "Quantité invalide"}, status=400)

            if new_qty < old_qty:
                return Response({"error": "Seul admin peut modifier"}, status=403)

            instance.initial_quantity = new_qty
            instance.save()

            Movement.objects.create(
                product=instance,
                product_name=instance.name,
                magasin=magasin,
                changed_by=user,
                previous_quantity=old_qty,
                new_quantity=new_qty,
                change=new_qty - old_qty,
                note=f"Ajout manuel par {user.full_name}"
            )
            Notification.objects.create(
                notif_type='product',
                message=f"Entrée de stock: {instance.name} +{new_qty - old_qty} unités par {user.full_name}",
                magasin=magasin,
                product=instance,
                user=user
            )

            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        return Response({"error": "Seul admin peut modifier"}, status=403)
    def destroy(self, request, *args, **kwargs):
        if request.user.role != "admin":
            return Response({"error": "Seul admin peut supprimer"}, status=403)
        instance = self.get_object()
        Movement.objects.create(
            product=instance,
            product_name=instance.name,
            magasin=instance.magasin,
            changed_by=request.user,
            previous_quantity=instance.initial_quantity or 0,
            new_quantity=0,
            change=-(instance.initial_quantity or 0),
            note=f"Suppression produit par {request.user.full_name}"
        )
        Notification.objects.create(
            notif_type='product',
            message=f"Suppression de produit: {instance.name} par {request.user.full_name}",
            magasin=instance.magasin,
            product=instance,
            user=request.user
        )
        return super().destroy(request, *args, **kwargs)


# =========================
# NOTIFICATION VIEWSET
# =========================
class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Notification.objects.select_related('magasin','product','sale','user')
        if user.role == 'admin':
            return qs
        elif user.role == 'magasin':
            try:
                magasin = MagasinProfile.objects.get(user=user)
                return qs.filter(magasin=magasin)
            except MagasinProfile.DoesNotExist:
                return Notification.objects.none()
        elif user.role == 'employer':
            try:
                employer = EmployerProfile.objects.filter(user=user).first()
                if employer and employer.magasin:
                    return qs.filter(magasin=employer.magasin)
            except Exception:
                pass
            return Notification.objects.none()

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """Marque toutes les notifications visibles comme lues."""
        self.get_queryset().update(is_read=True)
        return Response({"message": "Toutes les notifications marquées comme lues."})

    @action(detail=False, methods=['post'], url_path='delete-all')
    def delete_all(self, request):
        """Supprime toutes les notifications visibles."""
        self.get_queryset().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """Supprime une sélection spécifique de notifications."""
        ids = request.data.get('ids', [])
        self.get_queryset().filter(id__in=ids).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='bulk-read')
    def bulk_read(self, request):
        """Marque une sélection spécifique comme lue."""
        ids = request.data.get('ids', [])
        self.get_queryset().filter(id__in=ids).update(is_read=True)
        return Response({"message": "Notifications marquées comme lues."})

    def partial_update(self, request, *args, **kwargs):
        # allow marking as read
        instance = self.get_object()
        is_read = request.data.get('is_read', None)
        if is_read is not None:
            instance.is_read = bool(is_read)
            instance.save()
            return Response(self.get_serializer(instance).data)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        # allow deletion if admin or if related to user's magasin
        instance = self.get_object()
        user = request.user
        if user.role == 'admin':
            return super().destroy(request, *args, **kwargs)
        if user.role in ['magasin','employer']:
            try:
                magasin = MagasinProfile.objects.get(user=user) if user.role == 'magasin' else EmployerProfile.objects.get(user=user).magasin
            except Exception:
                magasin = None
            if instance.magasin and magasin and instance.magasin.id == magasin.id:
                return super().destroy(request, *args, **kwargs)
        return Response({"error": "Permission refusée"}, status=403)

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
                total=Coalesce(Sum(F('initial_quantity') * F('purchase_price'), output_field=DecimalField()), 0, output_field=DecimalField())
            )['total']
            total_sold_value = sales_qs.aggregate(
                total=Coalesce(Sum('total_price', output_field=DecimalField()), 0, output_field=DecimalField())
            )['total']
            # compute profit = sum of total_profit from each sale
            profit = sales_qs.aggregate(total=Coalesce(Sum('total_profit', output_field=DecimalField()), 0, output_field=DecimalField()))['total']

            response_data.append({
                "magasin_id": mag.id,
                "shop_name": mag.shop_name,
                "total_products": total_products,
                "total_stock_value": total_stock_value,
                "total_sold_value": total_sold_value,
                "profit": profit,
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
            total_revenue, _, total_profit, _ = _sale_totals(Sale.objects.all())
            total_stock_value = Product.objects.aggregate(total=Sum(F('initial_quantity') * F('purchase_price'), output_field=DecimalField()))['total'] or 0
            total_magasins = MagasinProfile.objects.count()
            total_employers = EmployerProfile.objects.count()
            total_products = Product.objects.count()
            total_sales = Sale.objects.count()
            sales_today = Sale.objects.filter(sold_at__date=today).count()
            _, _, profit_today, _ = _sale_totals(Sale.objects.filter(sold_at__date=today))
            low_stock_count = Product.objects.filter(initial_quantity__lte=F('alert_threshold')).count()
            expired_count = Product.objects.filter(expiry_date__lt=today).count()
            expiring_soon_count = Product.objects.filter(expiry_date__range=[today, today + timedelta(days=30)]).count()

            # Lists
            top_products = Sale.objects.values('product__name', 'product__magasin__shop_name').annotate(
                qty_sold=Sum('quantity'),
                profit=Sum('total_profit')
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
                profit=Sum('total_profit')
            ).order_by('-total_amount')[:5]

            best_shops = Sale.objects.values('magasin__shop_name').annotate(
                total_amount=Sum('total_price'),
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

            # KPIs (without exposing company wide purchase_price)
            sales_today = Sale.objects.filter(magasin=magasin, sold_at__date=today).count()
            _, _, profit_today, _ = _sale_totals(Sale.objects.filter(magasin=magasin, sold_at__date=today))
            total_revenue, _, total_profit, _ = _sale_totals(Sale.objects.filter(magasin=magasin))
            stock_value = Product.objects.filter(magasin=magasin).aggregate(total=Sum(F('initial_quantity') * F('purchase_price'), output_field=DecimalField()))['total'] or 0
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
                    "total_revenue": total_revenue,
                    "total_profit": total_profit,
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
                "roles_allowed": ["admin"],
                "description": "Calcule le bénéfice réel total (somme de (sale_price - unit_price) * quantity) pour l'administrateur."
            },
            {
                "path": "/api/users/sales/profit-by-magasins/",
                "method": "GET",
                "auth_required": True,
                "roles_allowed": ["admin"],
                "description": "Liste le bénéfice total, le chiffre d'affaires et le coût pour chaque magasin appartenant à l'administrateur."
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
