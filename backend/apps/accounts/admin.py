from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import DeviceSession, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["email", "full_name", "role", "email_verified", "is_blocked", "date_joined"]
    list_filter = ["role", "email_verified", "is_blocked"]
    search_fields = ["email", "full_name", "phone"]
    fieldsets = [
        (None, {"fields": ["email", "password", "full_name", "phone", "country", "city", "birth_date"]}),
        ("Rôle", {"fields": ["role", "is_active", "is_staff", "is_superuser", "is_blocked"]}),
        ("Sécurité", {"fields": ["email_verified", "otp_enabled", "failed_login_count", "locked_until"]}),
        ("Préférences", {"fields": ["newsletter_consent", "preferences", "terms_accepted_at"]}),
    ]
    add_fieldsets = [(None, {"classes": ["wide"], "fields": ["email", "full_name", "password1", "password2"]})]


admin.site.register(DeviceSession)
