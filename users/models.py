from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth.base_user import BaseUserManager


# =====================================================
# CUSTOM USER MANAGER
# =====================================================

class CustomUserManager(BaseUserManager):

    def create_user(self,email,password=None,**extra_fields):

        if not email:
            raise ValueError("L'email est obligatoire")

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            username=email,
            **extra_fields
        )

        user.set_password(password)

        user.save(using=self._db)

        return user

    def create_superuser(self,email,password=None,**extra_fields):

        extra_fields.setdefault("is_staff", True)

        extra_fields.setdefault("is_superuser", True)

        extra_fields.setdefault("is_active", True)

        extra_fields.setdefault("is_confirmed", True)

        extra_fields.setdefault("role", "admin")

        user = self.create_user(
            email,
            password,
            **extra_fields
        )

        return user


# =====================================================
# CUSTOM USER
# =====================================================

class CustomUser(AbstractUser):

    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("magasin", "Magasin"),
        ("employer", "Employer"),
    )

    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20,blank=True,null=True)
    role = models.CharField(max_length=20,choices=ROLE_CHOICES,default="employer")
    is_confirmed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True )
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = CustomUserManager()
    def save(self, *args, **kwargs):

        # Admin accès Django Admin
        if self.role == "admin":
            self.is_staff = True

        # Magasin / Employer
        else:
            self.is_staff = False

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} ({self.role})"


# =====================================================
# ADMIN PROFILE
# =====================================================

class AdminProfile(models.Model):

    user = models.OneToOneField(CustomUser,on_delete=models.CASCADE,related_name="admin_profile",limit_choices_to={"role": "admin"})
    company_name = models.CharField(max_length=255)
    logo = models.ImageField(upload_to="company_logo/",blank=True,null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        verbose_name = "Admin Profile"
        verbose_name_plural = "Admin Profiles"

    def __str__(self):
        return self.company_name


# =====================================================
# MAGASIN PROFILE
# =====================================================

class MagasinProfile(models.Model):

    user = models.OneToOneField(CustomUser,on_delete=models.CASCADE,related_name="magasin_profile",limit_choices_to={"role": "magasin"})
    admin = models.ForeignKey(CustomUser,on_delete=models.CASCADE,related_name="magasins",limit_choices_to={"role": "admin"})
    shop_name = models.CharField(max_length=255)
    shop_logo = models.ImageField(upload_to="shop_logo/",blank=True,null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Magasin Profile"
        verbose_name_plural = "Magasin Profiles"

    def __str__(self):
        return self.shop_name


# =====================================================
# EMPLOYER PROFILE
# =====================================================

class EmployerProfile(models.Model):

    user = models.OneToOneField(CustomUser,on_delete=models.CASCADE,related_name="employer_profile",limit_choices_to={"role": "employer"})
    magasin = models.ForeignKey(MagasinProfile,on_delete=models.CASCADE,related_name="employers",null=True,blank=True)
    admin = models.ForeignKey(CustomUser,on_delete=models.CASCADE,related_name="admin_employers",limit_choices_to={"role": "admin"},null=True,blank=True)
    position = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Employer Profile"
        verbose_name_plural = "Employer Profiles"

    def __str__(self):
        return f"{self.user.full_name} - {self.position}"




class Product(models.Model):

    # =====================================
    # IDENTIFICATION
    # =====================================

    name = models.CharField(max_length=255)
    reference = models.CharField(max_length=100,unique=True)
    brand = models.CharField(max_length=255,blank=True,null=True)   
    category = models.CharField(max_length=255)
    description = models.TextField(blank=True,null=True)

    # =====================================
    # PRIX
    # =====================================

    unit_price = models.DecimalField(max_digits=10,decimal_places=2)
    shell_price = models.DecimalField(max_digits=10,decimal_places=2)
    
    # =====================================
    # STOCK
    # =====================================

    initial_quantity = models.IntegerField()
    alert_threshold = models.IntegerField()

    # =====================================
    # DATES
    # =====================================

    expiry_date = models.DateField(blank=True,null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # =====================================
    # RELATION MAGASIN
    # =====================================

    magasin = models.ForeignKey(
        "MagasinProfile",
        on_delete=models.CASCADE,
        related_name="products",
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = "Product"
        verbose_name_plural = "Products"


    # =====================================
    # IMAGES (1 à 3)
    # =====================================

    image1 = models.ImageField(upload_to="products/",blank=True,null=True)
    image2 = models.ImageField(upload_to="products/",blank=True,null=True)
    image3 = models.ImageField(upload_to="products/",blank=True,null=True)
    qr_code = models.ImageField(upload_to="products/",blank=True,null=True)
    def __str__(self):
        return self.name


class Sale(models.Model):
    """Model representing a sale transaction for a product."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="sales")
    quantity = models.PositiveIntegerField()
    sale_price = models.DecimalField(max_digits=10, decimal_places=2)  # price per unit at sale (shell_price)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, editable=False)
    sold_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # Ensure total_price reflects quantity * sale_price
        self.total_price = self.quantity * self.sale_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Sale of {self.product.name} x {self.quantity}"