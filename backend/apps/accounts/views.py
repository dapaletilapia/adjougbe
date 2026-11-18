import base64
import io
import json
import urllib.parse
import urllib.request

import pyotp
import qrcode
import qrcode.image.svg
from django.conf import settings
from django.contrib.auth import authenticate, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.http import JsonResponse
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.core.audit import log_action

from . import services
from .models import DeviceSession, User
from .serializers import (DeviceSerializer, LoginSerializer, PasswordResetConfirmSerializer, RegisterSerializer,
                          UserSerializer)


class AuthThrottle(ScopedRateThrottle):
    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def me_payload(request):
    if not request.user.is_authenticated:
        return {"user": None}
    data = UserSerializer(request.user).data
    data["otp_verified"] = bool(request.session.get("otp_verified"))
    return {"user": data}


@ensure_csrf_cookie
def csrf(request):
    """Pose le cookie CSRF pour l'application React."""
    return JsonResponse({"ok": True})


@api_view(["GET"])
def me(request):
    return Response(me_payload(request))


@api_view(["POST"])
@throttle_classes([AuthThrottle])
def register(request):
    ser = RegisterSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    user = ser.save()
    if user.newsletter_consent:
        from apps.newsletter.models import Subscriber
        Subscriber.subscribe(user.email, source="inscription", user=user)
    services.send_verification_email(user)
    services.send_welcome(user)
    services.open_session(request, user)
    return Response(me_payload(request), status=status.HTTP_201_CREATED)


@api_view(["POST"])
@throttle_classes([AuthThrottle])
def login_view(request):
    ser = LoginSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    email = ser.validated_data["email"].lower()
    user = User.objects.filter(email=email).first()
    if user and user.is_locked:
        return Response({"detail": "Trop de tentatives. Réessayez dans quelques minutes."}, status=429)
    if user and user.is_blocked:
        return Response({"detail": "Ce compte est suspendu. Contactez le support."}, status=403)
    auth = authenticate(request, email=email, password=ser.validated_data["password"])
    if auth is None:
        if user:
            services.register_failed_login(user)
        return Response({"detail": "E-mail ou mot de passe incorrect."}, status=400)
    closed = services.open_session(request, auth)
    payload = me_payload(request)
    payload["otp_required"] = auth.is_staff_role
    payload["closed_devices"] = closed  # limite d'appareils : sessions fermées par cette connexion
    return Response(payload)


@api_view(["POST"])
def logout_view(request):
    if request.user.is_authenticated:
        DeviceSession.objects.filter(session_key=request.session.session_key).delete()
    logout(request)
    return Response({"user": None})


@api_view(["POST"])
def verify_email(request):
    user = services.check_verification_token(request.data.get("token", ""))
    if not user:
        return Response({"detail": "Lien invalide ou expiré."}, status=400)
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([AuthThrottle])
def resend_verification(request):
    if not request.user.email_verified:
        services.send_verification_email(request.user)
    return Response({"ok": True})


@api_view(["POST"])
@throttle_classes([AuthThrottle])
def password_reset(request):
    user = User.objects.filter(email=str(request.data.get("email", "")).lower(), is_active=True).first()
    if user:
        services.send_password_reset(user)
    # Même réponse dans tous les cas : on ne révèle pas l'existence d'un compte.
    return Response({"ok": True})


@api_view(["POST"])
@throttle_classes([AuthThrottle])
def password_reset_confirm(request):
    ser = PasswordResetConfirmSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(ser.validated_data["uid"])))
    except (User.DoesNotExist, ValueError, TypeError):
        user = None
    if not user or not default_token_generator.check_token(user, ser.validated_data["token"]):
        return Response({"detail": "Lien invalide ou expiré."}, status=400)
    validate_password(ser.validated_data["password"], user)
    user.set_password(ser.validated_data["password"])
    user.locked_until = None
    user.save()
    # Toutes les sessions existantes sont fermées.
    for dev in user.devices.all():
        services.close_device(dev)
    return Response({"ok": True})


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    if request.method == "PATCH":
        ser = UserSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        from apps.newsletter.models import Subscriber
        if request.user.newsletter_consent:
            Subscriber.subscribe(request.user.email, source="profil", user=request.user)
        else:
            Subscriber.objects.filter(email=request.user.email).update(is_active=False)
    return Response(me_payload(request))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    if not request.user.check_password(request.data.get("current_password", "")):
        return Response({"detail": "Mot de passe actuel incorrect."}, status=400)
    validate_password(request.data.get("new_password", ""), request.user)
    request.user.set_password(request.data["new_password"])
    request.user.save()
    services.open_session(request, request.user)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def devices(request):
    return Response(DeviceSerializer(request.user.devices.all(), many=True, context={"request": request}).data)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def device_delete(request, pk):
    dev = request.user.devices.filter(pk=pk).first()
    if dev:
        services.close_device(dev)
    return Response(status=204)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def export_data(request):
    """Droit d'accès : export de toutes les données personnelles."""
    u = request.user
    data = {
        "profil": UserSerializer(u).data,
        "commandes": [
            {"reference": o.reference, "montant": str(o.total), "statut": o.status, "date": o.created_at.isoformat(),
             "articles": [i.label for i in o.items.all()]}
            for o in u.orders.prefetch_related("items")
        ],
        "inscriptions_formations": [
            {"formation": e.session.training.title, "session": str(e.session.starts_at), "statut": e.status}
            for e in u.enrollments.select_related("session__training")
        ],
        "reponses_formulaires": [{"formulaire": r.form.title, "date": r.created_at.isoformat(), "donnees": r.data}
                                 for r in u.form_responses.select_related("form")],
        "appareils": DeviceSerializer(u.devices.all(), many=True).data,
    }
    resp = Response(data)
    resp["Content-Disposition"] = 'attachment; filename="mes-donnees-adjougbe.json"'
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Droit à l'effacement : anonymise le compte, conserve les pièces comptables."""
    u = request.user
    if not u.check_password(request.data.get("password", "")) and u.has_usable_password():
        return Response({"detail": "Mot de passe incorrect."}, status=400)
    with transaction.atomic():
        from apps.newsletter.models import Subscriber
        Subscriber.objects.filter(email=u.email).delete()
        u.form_responses.all().delete()
        for dev in u.devices.all():
            services.close_device(dev)
        u.email = f"supprime-{u.pk}@anonyme.invalid"
        u.full_name = "Compte supprimé"
        u.phone = u.city = ""
        u.birth_date = None
        u.preferences = []
        u.google_sub = ""
        u.is_active = False
        u.set_unusable_password()
        u.save()
    logout(request)
    return Response({"ok": True})


@api_view(["POST"])
@throttle_classes([AuthThrottle])
def google_login(request):
    """Connexion / inscription via Google (jeton d'identité vérifié côté serveur)."""
    if not settings.GOOGLE_CLIENT_ID:
        return Response({"detail": "Connexion Google non configurée."}, status=501)
    credential = request.data.get("credential", "")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=8) as r:  # noqa: S310 — URL fixe Google
            info = json.loads(r.read())
    except Exception:
        return Response({"detail": "Jeton Google invalide."}, status=400)
    if info.get("aud") != settings.GOOGLE_CLIENT_ID or info.get("email_verified") not in ("true", True):
        return Response({"detail": "Jeton Google invalide."}, status=400)
    email = info["email"].lower()
    user = User.objects.filter(google_sub=info["sub"]).first() or User.objects.filter(email=email).first()
    created = False
    if not user:
        if not request.data.get("accept_terms"):
            return Response({"detail": "terms_required", "email": email}, status=409)
        from django.utils import timezone
        user = User.objects.create_user(email=email, full_name=info.get("name") or email.split("@")[0],
                                        terms_accepted_at=timezone.now())
        user.set_unusable_password()
        created = True
    if user.is_blocked:
        return Response({"detail": "Ce compte est suspendu."}, status=403)
    user.google_sub = info["sub"]
    user.email_verified = True
    user.save()
    if created:
        services.send_welcome(user)
    services.open_session(request, user)
    payload = me_payload(request)
    payload["otp_required"] = user.is_staff_role
    return Response(payload)


# --- Double authentification (TOTP) ------------------------------------------

def _qr_svg(uri: str) -> str:
    img = qrcode.make(uri, image_factory=qrcode.image.svg.SvgPathImage, box_size=8)
    buf = io.BytesIO()
    img.save(buf)
    return "data:image/svg+xml;base64," + base64.b64encode(buf.getvalue()).decode()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def otp_setup(request):
    u = request.user
    if u.otp_enabled:
        return Response({"detail": "La double authentification est déjà active."}, status=400)
    u.otp_secret = pyotp.random_base32()
    u.save(update_fields=["otp_secret"])
    uri = pyotp.TOTP(u.otp_secret).provisioning_uri(name=u.email, issuer_name="Adjougbe")
    return Response({"secret": u.otp_secret, "uri": uri, "qr": _qr_svg(uri)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([AuthThrottle])
def otp_verify(request):
    u = request.user
    if not u.otp_secret:
        return Response({"detail": "Configurez d'abord la double authentification."}, status=400)
    code = str(request.data.get("code", "")).replace(" ", "").replace("-", "").upper()
    used_backup = False
    if not pyotp.TOTP(u.otp_secret).verify(code, valid_window=1):
        used_backup = u.otp_enabled and services.consume_backup_code(u, code)
        if not used_backup:
            services.register_failed_login(u)
            return Response({"detail": "Code incorrect."}, status=400)
    backup_codes = None
    if not u.otp_enabled:
        u.otp_enabled = True
        u.save(update_fields=["otp_enabled"])
        backup_codes = services.generate_backup_codes(u)
    services.open_session(request, u)  # nouvelle clé de session après la 2FA
    request.session["otp_verified"] = True
    ua = request.META.get("HTTP_USER_AGENT", "")
    from .models import describe_user_agent
    log_action(request, "otp_login", u, f"{describe_user_agent(ua)}{' · code de secours' if used_backup else ''}")
    payload = me_payload(request)
    if backup_codes:
        payload["backup_codes"] = backup_codes
    return Response(payload)
