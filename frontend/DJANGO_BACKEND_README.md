# Django Backend Integration Guide

Ce document détaille les modifications et configurations requises dans le backend Django pour intégrer avec le frontend Next.js.

## Table des matières

1. [Configuration Initiale](#configuration-initiale)
2. [Modèles Django Requis](#modèles-django-requis)
3. [Serializers](#serializers)
4. [Vues et ViewSets](#vues-et-viewsets)
5. [Authentification JWT](#authentification-jwt)
6. [URLs et Routing](#urls-et-routing)
7. [Permissions](#permissions)
8. [Endpoints API Complètement Documentés](#endpoints-api-complètement-documentés)

---

## Configuration Initiale

### 1. Installation des dépendances

```bash
pip install djangorestframework djangorestframework-simplejwt django-cors-headers
```

### 2. Settings.py - Configuration

```python
# settings.py

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    'rest_framework',
    'corsheaders',
    
    'users',  # Votre app utilisateurs
    'products',  # Votre app produits
    'sales',  # Votre app ventes
    'stores',  # Votre app magasins
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS Configuration pour Next.js
CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:8000',
    'https://votre-domaine.com',
]

CORS_ALLOW_CREDENTIALS = True

# JWT Configuration
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}
```

---

## Modèles Django Requis

### 1. Modèle User (Extension)

```python
# users/models.py

from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Administrator'),
        ('store_manager', 'Store Manager'),
        ('employee', 'Employee'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    is_approved = models.BooleanField(default=False)
    store = models.ForeignKey('stores.Store', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.username} ({self.role})"
```

### 2. Modèle Store

```python
# stores/models.py

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Store(models.Model):
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    manager = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_store')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'stores'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
```

### 3. Modèle Product

```python
# products/models.py

from django.db import models
from django.contrib.auth import get_user_model
from stores.models import Store

User = get_user_model()

class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    sku = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=100)
    quantity = models.IntegerField(default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)  # Prix de vente unitaire
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)   # Coût unitaire
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='products')
    supplier = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'products'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', '-created_at']),
            models.Index(fields=['sku']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.sku})"
```

### 4. Modèle Sale

```python
# sales/models.py

from django.db import models
from django.contrib.auth import get_user_model
from products.models import Product
from stores.models import Store

User = get_user_model()

class Sale(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sales')
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    employee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='sales')
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'sales'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['store', '-created_at']),
            models.Index(fields=['employee', '-created_at']),
        ]
    
    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Sale {self.id} - {self.product.name}"
```

### 5. Modèle Supplier

```python
# suppliers/models.py

from django.db import models

class Supplier(models.Model):
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'suppliers'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
```

---

## Serializers

### 1. UserSerializer

```python
# users/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'role', 'is_approved', 'store_id', 'created_at']
        read_only_fields = ['id', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'first_name', 'last_name', 'role']
    
    def create(self, validated_data):
        validated_data['password'] = make_password(validated_data['password'])
        user = User.objects.create(**validated_data)
        user.is_approved = False  # Account needs admin approval by default
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
```

### 2. ProductSerializer

```python
# products/serializers.py

from rest_framework import serializers
from products.models import Product

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'sku', 'category', 'quantity', 
                  'unit_price', 'unit_cost', 'store_id', 'supplier_id', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
```

### 3. SaleSerializer

```python
# sales/serializers.py

from rest_framework import serializers
from sales.models import Sale

class SaleSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.username', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    
    class Meta:
        model = Sale
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price', 'total_price', 
                  'employee', 'employee_name', 'store', 'store_name', 'created_at', 'notes']
        read_only_fields = ['id', 'total_price', 'created_at']
```

### 4. StoreSerializer

```python
# stores/serializers.py

from rest_framework import serializers
from stores.models import Store

class StoreSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.username', read_only=True)
    
    class Meta:
        model = Store
        fields = ['id', 'name', 'address', 'city', 'country', 'phone', 'email', 
                  'manager', 'manager_name', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
```

---

## Vues et ViewSets

### 1. AuthenticationViews

```python
# users/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from users.serializers import UserSerializer, RegisterSerializer, LoginSerializer

User = get_user_model()

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user account"""
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response(
            {'message': 'User registered successfully. Waiting for approval.'},
            status=status.HTTP_201_CREATED
        )
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Login with email and password, return JWT tokens"""
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    email = serializer.validated_data['email']
    password = serializer.validated_data['password']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'detail': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not user.check_password(password):
        return Response(
            {'detail': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not user.is_approved:
        return Response(
            {'detail': 'Account pending approval'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """Refresh JWT access token"""
    refresh = request.data.get('refresh')
    if not refresh:
        return Response(
            {'detail': 'Refresh token required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        token = RefreshToken(refresh)
        return Response({'access': str(token.access_token)})
    except Exception as e:
        return Response(
            {'detail': 'Invalid refresh token'},
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """Get current authenticated user"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)
```

### 2. ProductViewSet

```python
# products/views.py

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from products.models import Product
from products.serializers import ProductSerializer
from stores.models import Store

class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Product.objects.all()
        elif user.role in ['store_manager', 'employee']:
            return Product.objects.filter(store=user.store)
        return Product.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        store = user.store if user.role in ['store_manager', 'employee'] else None
        serializer.save(store=store)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search products by name or SKU"""
        query = request.query_params.get('q', '')
        products = self.get_queryset().filter(
            name__icontains=query
        ) | self.get_queryset().filter(
            sku__icontains=query
        )
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)
```

### 3. SaleViewSet

```python
# sales/views.py

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from sales.models import Sale
from products.models import Product
from sales.serializers import SaleSerializer
from django.db.models import Sum, F

class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Sale.objects.all()
        elif user.role in ['store_manager', 'employee']:
            return Sale.objects.filter(store=user.store)
        return Sale.objects.none()
    
    def perform_create(self, serializer):
        user = self.request.user
        product = serializer.validated_data['product']
        quantity = serializer.validated_data['quantity']
        
        # Decrement product stock
        product.quantity -= quantity
        product.save()
        
        # Save sale with current user and their store
        serializer.save(employee=user, store=user.store)
    
    @action(detail=False, methods=['get'])
    def revenue(self, request):
        """Get revenue summary"""
        sales = self.get_queryset()
        today_revenue = sales.filter(
            created_at__date=datetime.now().date()
        ).aggregate(total=Sum('total_price'))['total'] or 0
        
        return Response({
            'today': float(today_revenue),
            'total': float(sales.aggregate(Sum('total_price'))['total_price__sum'] or 0)
        })
```

---

## Authentification JWT

La configuration JWT utilise `djangorestframework-simplejwt`. Les tokens sont :

- **Access Token** : Utilisé pour authentifier les requêtes (durée: 1 heure)
- **Refresh Token** : Utilisé pour obtenir un nouveau access token (durée: 1 jour)

### Header d'autorisation

Toutes les requêtes authentifiées doivent inclure:

```
Authorization: Bearer {access_token}
```

---

## URLs et Routing

### urls.py principal

```python
# config/urls.py

from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from products.views import ProductViewSet
from sales.views import SaleViewSet
from stores.views import StoreViewSet
from users import views as user_views

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'stores', StoreViewSet, basename='store')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include([
        path('auth/', include([
            path('register/', user_views.register, name='register'),
            path('login/', user_views.login, name='login'),
            path('token/refresh/', user_views.refresh_token, name='token-refresh'),
            path('me/', user_views.get_current_user, name='current-user'),
        ])),
        path('', include(router.urls)),
    ])),
]
```

---

## Permissions

### Permission Classes Personnalisées

```python
# users/permissions.py

from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    """Only admin users can access"""
    def has_permission(self, request, view):
        return request.user and request.user.role == 'admin'


class IsStoreManager(BasePermission):
    """Only store managers"""
    def has_permission(self, request, view):
        return request.user and request.user.role == 'store_manager'


class IsStoreManagerOrAdmin(BasePermission):
    """Store manager or admin"""
    def has_permission(self, request, view):
        return request.user and request.user.role in ['store_manager', 'admin']


class OwnsStore(BasePermission):
    """User owns the store"""
    def has_object_permission(self, request, view, obj):
        return obj.manager == request.user
```

---

## Endpoints API Complètement Documentés

### Authentication

#### POST `/api/auth/register/`

Créer un nouveau compte utilisateur.

**Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "secure_password",
  "role": "employee|store_manager|admin"
}
```

**Response (201):**
```json
{
  "message": "User registered successfully. Waiting for approval."
}
```

---

#### POST `/api/auth/login/`

Se connecter avec email et mot de passe.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response (200):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "first_name": "First",
    "last_name": "Last",
    "role": "employee",
    "is_approved": true,
    "store_id": null,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

#### POST `/api/auth/token/refresh/`

Renouveler le access token.

**Body:**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### GET `/api/auth/me/`

Obtenir le profil utilisateur actuel.

**Auth:** Required

**Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username",
  "first_name": "First",
  "last_name": "Last",
  "role": "employee",
  "is_approved": true,
  "store_id": null,
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### Products

#### GET `/api/products/`

Lister les produits (filtrés selon le rôle).

**Query Params:**
- `store_id`: Filter by store
- `category`: Filter by category

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Product Name",
    "description": "Description",
    "sku": "SKU-001",
    "category": "Category",
    "quantity": 100,
    "unit_price": "19.99",
    "unit_cost": "10.00",
    "store_id": 1,
    "supplier_id": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

#### POST `/api/products/`

Créer un nouveau produit.

**Body:**
```json
{
  "name": "Product Name",
  "description": "Description",
  "sku": "SKU-001",
  "category": "Category",
  "quantity": 100,
  "unit_price": "19.99",
  "unit_cost": "10.00",
  "supplier_id": null
}
```

**Response (201):**
```json
{
  "id": 1,
  "name": "Product Name",
  "description": "Description",
  "sku": "SKU-001",
  "category": "Category",
  "quantity": 100,
  "unit_price": "19.99",
  "unit_cost": "10.00",
  "store_id": 1,
  "supplier_id": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

#### GET `/api/products/{id}/`

Obtenir les détails d'un produit.

**Response (200):**
```json
{
  "id": 1,
  "name": "Product Name",
  "description": "Description",
  "sku": "SKU-001",
  "category": "Category",
  "quantity": 100,
  "unit_price": "19.99",
  "unit_cost": "10.00",
  "store_id": 1,
  "supplier_id": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

#### PUT/PATCH `/api/products/{id}/`

Mettre à jour un produit.

**Body (PUT - complet):**
```json
{
  "name": "Updated Name",
  "description": "Updated Description",
  "sku": "SKU-001",
  "category": "Category",
  "quantity": 150,
  "unit_price": "24.99",
  "unit_cost": "12.00",
  "supplier_id": null
}
```

**Response (200):**
Product updated data

---

#### DELETE `/api/products/{id}/`

Supprimer un produit.

**Response (204):** No content

---

### Sales

#### POST `/api/sales/`

Enregistrer une nouvelle vente.

**Body:**
```json
{
  "product": 1,
  "quantity": 5,
  "unit_price": "25.00"
}
```

**Response (201):**
```json
{
  "id": 1,
  "product": 1,
  "product_name": "Product Name",
  "quantity": 5,
  "unit_price": "25.00",
  "total_price": "125.00",
  "employee": 2,
  "employee_name": "Employee Name",
  "store": 1,
  "store_name": "Store Name",
  "created_at": "2024-01-01T12:00:00Z",
  "notes": ""
}
```

---

#### GET `/api/sales/`

Lister les ventes (filtrées selon le rôle).

**Query Params:**
- `store_id`: Filter by store
- `date_range`: Filter by date range

**Response (200):**
```json
[
  {
    "id": 1,
    "product": 1,
    "product_name": "Product Name",
    "quantity": 5,
    "unit_price": "25.00",
    "total_price": "125.00",
    "employee": 2,
    "employee_name": "Employee Name",
    "store": 1,
    "store_name": "Store Name",
    "created_at": "2024-01-01T12:00:00Z",
    "notes": ""
  }
]
```

---

#### GET `/api/sales/revenue/`

Obtenir le résumé des revenus.

**Query Params:**
- `store_id`: Filter by store

**Response (200):**
```json
{
  "today": 1250.50,
  "this_week": 8500.00,
  "this_month": 35000.00,
  "all_time": 150000.00
}
```

---

### Stores

#### GET `/api/stores/`

Lister tous les magasins.

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Store Name",
    "address": "123 Street",
    "city": "City",
    "country": "Country",
    "phone": "123-456-7890",
    "email": "store@example.com",
    "manager": 1,
    "manager_name": "Manager Name",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

## Migration Commands

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser
```

---

## Testing

Utilisez Postman, Insomnia, ou cURL pour tester les endpoints.

### Exemple avec cURL:

```bash
# Register
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "password": "password123",
    "role": "employee"
  }'

# Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Get current user (with token)
curl -X GET http://localhost:8000/api/auth/me/ \
  -H "Authorization: Bearer {access_token}"
```

---

## Notes Importantes

1. **CORS**: Assurez-vous que le frontend URL est dans `CORS_ALLOWED_ORIGINS`
2. **SECRET_KEY**: Changez la clé secrète en production
3. **HTTPS**: Utilisez HTTPS en production
4. **Token Expiration**: Les access tokens expirent après 1 heure
5. **Approval Flow**: Les nouveaux utilisateurs doivent être approuvés par un admin

---

## Dépannage

### Erreur: "Authentication credentials were not provided"
- Assurez-vous d'ajouter le header `Authorization: Bearer {token}`
- Vérifiez que le token n'a pas expiré

### Erreur: "Account pending approval"
- L'utilisateur doit être approuvé par un admin
- Utilisez le Django admin ou une API endpoint d'approbation

### Erreur: CORS
- Vérifiez que l'URL du frontend est dans `CORS_ALLOWED_ORIGINS`
- Assurez-vous que `CORS_ALLOW_CREDENTIALS = True`

---

## Support

Pour toute question ou problème, consultez la documentation Django REST Framework:
https://www.django-rest-framework.org/
