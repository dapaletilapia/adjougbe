from rest_framework.permissions import BasePermission

# Rôles fins (section 20) : chaque rôle limité à son périmètre.
ROLE_SCOPES = {
    "admin": {"*"},
    "editor": {"blog", "comments", "newsletter", "pages", "dashboard"},
    "accountant": {"orders", "finance", "dashboard"},
    "assistant": {"trainings", "forms", "users_read", "dashboard"},
}


def has_scope(user, scope: str) -> bool:
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    scopes = ROLE_SCOPES.get(user.role, set())
    return "*" in scopes or scope in scopes


class BackofficePermission(BasePermission):
    """Accès back-office : rôle à privilèges + 2FA validée dans la session.

    La vue déclare `backoffice_scope` pour restreindre le périmètre.
    """

    message = "Accès réservé à l'administration (double authentification requise)."

    def has_permission(self, request, view):
        user = request.user
        if not user.is_authenticated or not user.is_staff_role:
            return False
        if not request.session.get("otp_verified"):
            return False
        scope = getattr(view, "backoffice_scope", "dashboard")
        return has_scope(user, scope)


class IsVerifiedEmail(BasePermission):
    message = "Vérifiez votre adresse e-mail avant votre premier achat."

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.email_verified
