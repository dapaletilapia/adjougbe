import io

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from .models import SiteSettings


@api_view(["GET"])
def public_settings(request):
    s = SiteSettings.load()
    return Response({
        "site_name": s.site_name, "tagline": s.tagline, "whatsapp_number": s.whatsapp_number,
        "contact_email": s.contact_email, "eur_rate": float(s.eur_rate),
        "payment_methods": s.enabled_payment_methods, "maintenance_mode": s.maintenance_mode,
        "maintenance_message": s.maintenance_message, "social_links": s.social_links,
    })


@api_view(["GET"])
def page(request, key):
    s = SiteSettings.load()
    fields = {"cgu": "terms_html", "confidentialite": "privacy_html", "mentions-legales": "legal_html",
              "a-propos": "about_html"}
    if key not in fields:
        return Response(status=404)
    return Response({"key": key, "html": getattr(s, fields[key])})


@api_view(["GET"])
def expertise(request):
    from .models import ExpertiseArea
    rows = ExpertiseArea.objects.filter(is_published=True).values("id", "title", "description", "icon")
    return Response(list(rows))


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def search(request):
    """Recherche globale (maquette 16b) : œuvres, articles, formations."""
    import re

    from django.db.models import Q

    from apps.blog.models import Post
    from apps.catalog.models import Work
    from apps.trainings.models import Training
    q = request.query_params.get("q", "").strip()[:80]
    if len(q) < 2:
        return Response({"q": q, "works": [], "posts": [], "trainings": []})
    works = Work.objects.filter(status__in=["published", "preorder"]).filter(
        Q(title__icontains=q) | Q(summary__icontains=q) | Q(subtitle__icontains=q))[:10]
    # Le corps des articles réservés aux membres n'est cherché (ni cité) que pour un lecteur connecté.
    body_match = Q(body__icontains=q) if request.user.is_authenticated else Q(body__icontains=q, members_only=False)
    posts = Post.objects.published().filter(
        Q(title__icontains=q) | Q(excerpt__icontains=q) | Q(quote__icontains=q) | body_match).select_related("category")[:20]
    trainings = Training.objects.filter(is_published=True).filter(
        Q(title__icontains=q) | Q(summary__icontains=q) | Q(theme__icontains=q))[:10]

    def snippet(text):
        text = re.sub(r"<[^>]+>", " ", text or "")
        i = text.lower().find(q.lower())
        if i < 0:
            return text[:140]
        return ("…" if i > 50 else "") + text[max(0, i - 50):i + 90].strip() + "…"

    from django.utils import timezone
    now = timezone.now()
    return Response({
        "q": q,
        "works": [{"slug": w.slug, "title": w.title, "subtitle": w.subtitle, "cover_color": w.cover_color, "kind": w.kind,
                   "access_mode": w.access_mode, "price_xof": w.current_price_xof, "sections_count": w.sections.count(),
                   "snippet": snippet(w.summary)} for w in works],
        "posts": [{"slug": p.slug, "title": p.title, "kind": p.kind, "quote": p.quote,
                   "category": p.category.name if p.category else p.get_kind_display(),
                   "cover": p.cover.url if p.cover else None, "snippet": snippet(p.quote or p.excerpt or ("" if p.members_only and not request.user.is_authenticated else p.body))} for p in posts],
        "trainings": [{"slug": t.slug, "title": t.title, "format": t.get_format_display(),
                       "next": (lambda s: {"starts_at": s.starts_at, "seats_left": s.seats_left} if s else None)(
                           t.sessions.filter(starts_at__gte=now, is_cancelled=False).first())} for t in trainings],
    })


def media_file(request, path):
    """Sert un fichier public stocké en base (mode Vercel). Mis en cache par le CDN."""
    from django.http import Http404, HttpResponse

    from apps.core.models import StoredFile
    obj = StoredFile.objects.filter(name=path, is_private=False).first()
    if obj is None:
        raise Http404
    resp = HttpResponse(bytes(obj.content), content_type=obj.content_type or "application/octet-stream")
    resp["Cache-Control"] = "public, max-age=86400, s-maxage=31536000"
    resp["X-Content-Type-Options"] = "nosniff"
    resp["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"
    return resp


@api_view(["POST", "GET"])
@authentication_classes([])
@permission_classes([])
def cron_scheduled(request):
    """Tâches planifiées (relances, rappels) déclenchées par un ordonnanceur externe.

    Protégé par CRON_SECRET (en-tête Authorization: Bearer …). Désactivé si la variable est vide.
    """
    import hmac

    from django.conf import settings
    from django.core.management import call_command
    secret = settings.CRON_SECRET
    given = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not secret or not hmac.compare_digest(given, secret):
        return Response(status=404)
    out = io.StringIO()
    call_command("run_scheduled", stdout=out)
    return Response({"ok": True, "log": out.getvalue()[-2000:]})
