import hashlib
import re
from urllib.parse import urlparse

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.core.audit import client_ip

from .models import DailyVisitor, PageView

BOTS = re.compile(r"bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|curl|python", re.I)
SOURCES = [  # (source, motifs du domaine d'origine)
    ("whatsapp", ("whatsapp", "wa.me")), ("facebook", ("facebook", "fb.", "messenger")),
    ("instagram", ("instagram",)), ("tiktok", ("tiktok",)), ("x", ("twitter", "t.co", "x.com")),
    ("linkedin", ("linkedin", "lnkd")), ("telegram", ("telegram", "t.me")),
    ("google", ("google",)), ("bing", ("bing",)), ("youtube", ("youtube", "youtu.be")),
]
# Seules les pages publiques du site sont comptées (liste fermée : pas d'adresses inventées en base).
PUBLIC = re.compile(r"^/(|boutique|panier|cadeau|bibliotheque|a-propos|recherche|cgu|confidentialite|mentions-legales"
                    r"|connexion|inscription|formations|blog|livres/[\w-]{1,120}|formations/[\w-]{1,120}|blog/[\w-]{1,120}"
                    r"|attestation/[\w-]{1,40})/?$")


def source_of(referrer: str, own_host: str) -> str:
    host = (urlparse(referrer).hostname or "").lower() if referrer else ""
    if not host or host == own_host:
        return "direct"
    for name, marks in SOURCES:
        if any(m in host for m in marks):
            return name
    return "autre"


def device_of(ua: str) -> str:
    if re.search(r"ipad|tablet|kindle|silk|(android(?!.*mobile))", ua, re.I):
        return DailyVisitor.Device.TABLET
    if re.search(r"mobi|iphone|android|opera mini", ua, re.I):
        return DailyVisitor.Device.MOBILE
    return DailyVisitor.Device.DESKTOP


def _exists(path: str) -> bool:
    """Pages de contenu (livre, article, formation) : seulement si le contenu existe, sinon chaque adresse
    inventée créerait une ligne en base."""
    parts = path.strip("/").split("/")
    if len(parts) != 2:
        return True
    from apps.blog.models import Post
    from apps.catalog.models import Work
    from apps.trainings.models import Training
    model = {"livres": Work, "blog": Post, "formations": Training}.get(parts[0])
    return model is None or model.objects.filter(slug=parts[1]).exists()


class HitThrottle(AnonRateThrottle):
    rate = "120/min"


@api_view(["POST"])
@authentication_classes([])  # pas de session : ni cookie lu, ni CSRF à fournir
@permission_classes([])
@throttle_classes([HitThrottle])
def hit(request):
    """Une page vue (appelé par le site à chaque changement de page)."""
    data = request.data if isinstance(request.data, dict) else {}  # corps JSON inattendu (liste, texte) : ignoré
    ua = request.META.get("HTTP_USER_AGENT", "")[:400]
    path = str(data.get("path", ""))[:200].split("?")[0].split("#")[0]
    if len(path) > 1:
        path = path.rstrip("/")
    if not ua or BOTS.search(ua) or not PUBLIC.match(path) or request.META.get("HTTP_DNT") == "1" or not _exists(path):
        return Response(status=204)
    today = timezone.localdate()
    key = hashlib.sha256(f"{settings.SECRET_KEY}|{today}|{client_ip(request)}|{ua}".encode()).hexdigest()[:32]
    own_host = request.get_host().split(":")[0].lower()
    with transaction.atomic():
        updated = PageView.objects.filter(day=today, path=path).update(views=F("views") + 1)
        if not updated:
            try:
                with transaction.atomic():
                    PageView.objects.create(day=today, path=path, views=1)
            except IntegrityError:  # créé entre-temps par une requête concurrente
                PageView.objects.filter(day=today, path=path).update(views=F("views") + 1)
        if not DailyVisitor.objects.filter(day=today, key=key).update(pages=F("pages") + 1):
            try:
                with transaction.atomic():
                    DailyVisitor.objects.create(day=today, key=key, landing=path, device=device_of(ua),
                                                source=source_of(str(data.get("referrer", ""))[:500], own_host))
            except IntegrityError:
                pass
    return Response(status=204)
