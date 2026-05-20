from rest_framework import serializers
from .models import (
    CustomUser,
    AdminProfile,
    MagasinProfile,
    EmployerProfile,
    Product,
    Sale,
)

class RegisterSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(required=False)
    shop_name = serializers.CharField(required=False)
    position = serializers.CharField(required=False)
    admin_email = serializers.EmailField(required=False)

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "full_name",
            "email",
            "password",
            "phone",
            "role",
            "company_name",
            "shop_name",
            "position",
            "admin_email",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        role = validated_data.get("role")
        username = validated_data.pop("username", validated_data.get("email"))
        admin_email = validated_data.pop("admin_email", None)
        company_name = validated_data.pop("company_name", None)
        shop_name = validated_data.pop("shop_name", None)
        position = validated_data.pop("position", None)
        password = validated_data.pop("password")

        if role == "admin":
            user = CustomUser.objects.create(username=username, is_confirmed=True, **validated_data)
            user.set_password(password)
            user.save()
            AdminProfile.objects.create(user=user, company_name=company_name)
            return user
        elif role == "magasin":
            try:
                admin = CustomUser.objects.get(email=admin_email, role="admin")
            except CustomUser.DoesNotExist:
                raise serializers.ValidationError({"admin_email": "Administrateur introuvable avec cet email."})
            user = CustomUser.objects.create(username=username, is_confirmed=False, **validated_data)
            user.set_password(password)
            user.save()
            MagasinProfile.objects.create(user=user, admin=admin, shop_name=shop_name)
            return user
        elif role == "employer":
            admin = CustomUser.objects.filter(email=admin_email, role="admin").first()
            magasin = None
            if not admin:
                magasin_user = CustomUser.objects.filter(email=admin_email, role="magasin").first()
                if magasin_user:
                    magasin = MagasinProfile.objects.get(user=magasin_user)
            if not admin and not magasin:
                raise serializers.ValidationError({"admin_email": "Responsable (administrateur ou gérant) introuvable avec cet email."})
            user = CustomUser.objects.create(username=username, is_confirmed=False, **validated_data)
            user.set_password(password)
            user.save()
            EmployerProfile.objects.create(user=user, admin=admin, magasin=magasin, position=position)
            return user
        raise serializers.ValidationError("Role invalide")

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = "__all__"

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get("request")
        # Hide purchase price (unit_price) to magasin and employer roles
        if request and request.user and getattr(request.user, "role", None) != "admin":
            representation.pop("unit_price", None)
        return representation

class SaleSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source="seller.full_name", read_only=True)
    shop_name = serializers.CharField(source="magasin.shop_name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "product",
            "product_name",
            "magasin",
            "shop_name",
            "seller",
            "seller_name",
            "quantity",
            "sale_price",
            "total_price",
            "sold_at",
        ]

    def validate(self, attrs):
        product = attrs.get("product")
        quantity = attrs.get("quantity")
        if product and quantity:
            if product.initial_quantity < quantity:
                raise serializers.ValidationError(
                    {"quantity": f"Quantité en stock insuffisante. Stock disponible : {product.initial_quantity}."}
                )
        return attrs