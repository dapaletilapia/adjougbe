from django.conf import settings
from django.contrib.auth import logout
from django.utils import timezone

from .models import DeviceSession


class DeviceSessionMiddleware:
    """Déconnecte une session fermée (limite d'appareils) ou inactive trop longtemps."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            key = request.session.session_key
            now = timezone.now().timestamp()
            last = request.session.get("last_activity", now)
            known = DeviceSession.objects.filter(session_key=key, user=user)
            if user.is_blocked or not known.exists() or now - last > settings.SESSION_INACTIVITY_TIMEOUT:
                known.delete()
                logout(request)
            else:
                # On limite les écritures : une mise à jour par minute au plus.
                if now - last > 60:
                    request.session["last_activity"] = now
                    known.update(last_seen_at=timezone.now())
        return self.get_response(request)
