from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers

from .models import DeviceSession, User

PREFERENCE_CHOICES = ["leadership", "resilience", "ecriture", "entraide", "humour", "societe", "formations", "papos", "evenements"]


class UserSerializer(serializers.ModelSerializer):
    is_staff_role = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "phone", "country", "city", "birth_date", "role", "is_staff_role",
            "email_verified", "newsletter_consent", "preferences", "otp_enabled", "date_joined",
            "is_superuser", "deletion_requested_at",
        ]
        read_only_fields = ["id", "email", "role", "email_verified", "otp_enabled", "date_joined",
                            "is_superuser", "deletion_requested_at"]

    def validate_preferences(self, value):
        return [v for v in value if v in PREFERENCE_CHOICES]


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    country = serializers.CharField(max_length=80, required=False, allow_blank=True)
    city = serializers.CharField(max_length=80, required=False, allow_blank=True)
    accept_terms = serializers.BooleanField()
    newsletter_consent = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse.")
        return value

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("Vous devez accepter les CGU et la politique de confidentialité.")
        return value

    def validate(self, attrs):
        validate_password(attrs["password"], User(email=attrs["email"], full_name=attrs["full_name"]))
        return attrs

    def create(self, data):
        data.pop("accept_terms")
        return User.objects.create_user(terms_accepted_at=timezone.now(), **data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField()


class DeviceSerializer(serializers.ModelSerializer):
    current = serializers.SerializerMethodField()

    class Meta:
        model = DeviceSession
        fields = ["id", "label", "ip_address", "created_at", "last_seen_at", "current"]

    def get_current(self, obj):
        request = self.context.get("request")
        return bool(request and request.session.session_key == obj.session_key)
