import re

from rest_framework.decorators import api_view, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import Subscriber


@api_view(["POST"])
@throttle_classes([AnonRateThrottle])
def subscribe(request):
    email = str(request.data.get("email", "")).strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return Response({"email": "Adresse e-mail invalide."}, status=400)
    if not request.data.get("consent"):
        return Response({"consent": "Votre consentement est nécessaire."}, status=400)
    prefs = [p for p in request.data.get("preferences", []) if isinstance(p, str)][:10]
    Subscriber.subscribe(email, source=str(request.data.get("source", "site"))[:60],
                         user=request.user if request.user.is_authenticated else None, preferences=prefs)
    return Response({"ok": True, "message": "Merci ! Vous recevrez la punchline du jour et nos nouvelles."})


@api_view(["POST"])
def unsubscribe(request):
    n = Subscriber.objects.filter(unsubscribe_token=request.data.get("token", "")).update(is_active=False)
    return Response({"ok": bool(n)})
