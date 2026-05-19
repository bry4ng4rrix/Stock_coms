from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework import serializers


class CustomTokenObtainPairSerializer(
    TokenObtainPairSerializer
):

    def validate(self, attrs):

        data = super().validate(attrs)

        if not self.user.is_confirmed:

            raise serializers.ValidationError(
                "Compte non approuvé"
            )

        return data