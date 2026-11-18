"""Logique de session : limite d'appareils, blocage après échecs, e-mails de compte."""
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.core import signing
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.core.audit import client_ip
from apps.core.emails import front, send

from .models import DeviceSession, User, describe_user_agent

EMAIL_VERIFY_SALT = "adjougbe.email-verify"


def generate_backup_codes(user: User, n: int = 8) -> list[str]:
    """Codes de secours à usage unique, affichés une seule fois ; seules les empreintes sont stockées."""
    import secrets

    from django.contrib.auth.hashers import make_password
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    codes = ["".join(secrets.choice(alphabet) for _ in range(8)) for _ in range(n)]
    user.otp_backup_codes = [make_password(c) for c in codes]
    user.save(update_fields=["otp_backup_codes"])
    return [f"{c[:4]}-{c[4:]}" for c in codes]


def consume_backup_code(user: User, code: str) -> bool:
    from django.contrib.auth.hashers import check_password
    for h in user.otp_backup_codes:
        if check_password(code, h):
            user.otp_backup_codes = [x for x in user.otp_backup_codes if x != h]
            user.save(update_fields=["otp_backup_codes"])
            return True
    return False


def register_failed_login(user: User):
    user.failed_login_count += 1
    if user.failed_login_count >= settings.LOGIN_MAX_ATTEMPTS:
        user.locked_until = timezone.now() + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
        user.failed_login_count = 0
    user.save(update_fields=["failed_login_count", "locked_until"])


def open_session(request, user: User):
    """Connecte l'utilisateur et applique la limite d'appareils simultanés.

    Au-delà de la limite, les sessions les plus anciennes sont fermées.
    """
    previous_key = request.session.session_key
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")  # renouvelle la clé de session
    if previous_key and previous_key != request.session.session_key:
        DeviceSession.objects.filter(session_key=previous_key).delete()
    request.session["last_activity"] = timezone.now().timestamp()
    request.session.save()
    ua = request.META.get("HTTP_USER_AGENT", "")[:300]
    DeviceSession.objects.update_or_create(
        session_key=request.session.session_key,
        defaults={"user": user, "user_agent": ua, "label": describe_user_agent(ua), "ip_address": client_ip(request)},
    )
    user.failed_login_count = 0
    user.locked_until = None
    user.last_seen_at = timezone.now()
    user.save(update_fields=["failed_login_count", "locked_until", "last_seen_at"])
    from apps.core.models import SiteSettings
    limit = SiteSettings.load().max_devices_per_account if not user.is_staff_role else 5
    extra = list(user.devices.order_by("-last_seen_at")[limit:])
    closed = [{"label": d.label, "last_seen_at": d.last_seen_at.isoformat()} for d in extra]
    for dev in extra:
        close_device(dev)
    return closed


def close_device(device: DeviceSession):
    Session.objects.filter(session_key=device.session_key).delete()
    device.delete()


def send_verification_email(user: User):
    token = signing.dumps({"uid": user.pk, "email": user.email}, salt=EMAIL_VERIFY_SALT)
    send(
        user.email,
        "Confirmez votre adresse e-mail — Adjougbe",
        f"Bonjour {user.full_name},\n\nConfirmez votre adresse pour pouvoir acheter et lire :\n"
        f"{front('/verifier-email?token=' + token)}\n\nCe lien est valable 3 jours.\n\nAdjougbe — Possumus",
    )


def check_verification_token(token: str) -> User | None:
    try:
        data = signing.loads(token, salt=EMAIL_VERIFY_SALT, max_age=60 * 60 * 24 * 3)
    except signing.BadSignature:
        return None
    return User.objects.filter(pk=data["uid"], email=data["email"]).first()


def send_password_reset(user: User):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    send(
        user.email,
        "Réinitialisation de votre mot de passe — Adjougbe",
        f"Bonjour {user.full_name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n"
        f"{front(f'/mot-de-passe/nouveau?uid={uid}&token={token}')}\n\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    )


def send_welcome(user: User):
    send(
        user.email,
        "Bienvenue chez Adjougbe",
        f"Bonjour {user.full_name},\n\nBienvenue ! Découvrez la punchline du jour et un extrait offert :\n"
        f"{front('/')}\n\nAdjougbe — Possumus",
    )
