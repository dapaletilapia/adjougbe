"""Lecteur sécurisé : sommaire, manifeste de pages signées, images filigranées, progression."""
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.accounts.models import describe_user_agent
from apps.catalog.models import Section, Work
from apps.core.audit import client_ip
from apps.shop.models import Access
from apps.shop.services import grant_access

from .models import AbuseAlert, Bookmark, ReadingLog, ReadingProgress
from .rendering import SIZES, THEMES, paginate, render_page

PAGE_SALT = "adjougbe.reader.page"


class ReaderThrottle(UserRateThrottle):
    scope = "reader"


def user_access(user, work):
    if not user.is_authenticated:
        return None
    return Access.objects.filter(user=user, work=work, revoked_at__isnull=True).select_related("order").first()


def can_read(user, section) -> tuple[bool, str]:
    work = section.work
    if work.status == Work.Status.DRAFT and not (user.is_authenticated and user.is_staff_role):
        return False, "unavailable"
    if section.is_free_extract or work.access_mode == Work.AccessMode.PUBLIC:
        return True, "extract"
    if not user.is_authenticated:
        return False, "login_required"
    if user.is_staff_role:
        return True, "staff"
    if work.status == Work.Status.PREORDER:
        return False, "preorder"
    if user_access(user, work):
        return True, "owned"
    if work.access_mode == Work.AccessMode.FREE_ACCOUNT:
        return False, "claim"
    if work.access_mode == Work.AccessMode.FREE_FORM:
        return False, "form_required"
    return False, "purchase_required"


def _watermark(request, work):
    user = request.user
    if not user.is_authenticated:
        return "Extrait gratuit · adjougbe.ci", ("Extrait gratuit · © Adjougbe", "Reproduction interdite")
    acc = user_access(user, work)
    order_ref = acc.order.reference if acc and acc.order else (acc.source if acc else "aperçu")
    mark = f"{user.full_name} · {user.email} · {order_ref}"
    return mark, (f"{user.full_name} · {user.email}", f"{order_ref} · © Adjougbe")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def library(request):
    accesses = Access.objects.filter(user=request.user, revoked_at__isnull=True).select_related("work")
    progress = {p.work_id: p for p in ReadingProgress.objects.filter(user=request.user).select_related("section")}
    data = []
    for acc in accesses:
        w = acc.work
        total = w.sections.count()
        p = progress.get(w.pk)
        read = len(p.sections_read) if p else 0
        data.append({
            "work": {"id": w.pk, "slug": w.slug, "title": w.title, "subtitle": w.subtitle,
                     "cover": w.cover.url if w.cover else None, "cover_color": w.cover_color, "kind": w.kind,
                     "access_mode": w.access_mode, "sections_count": total,
                     "status": w.status, "unit_label": w.unit_label},
            "source": acc.source,
            "granted_at": acc.granted_at,
            "sections_total": total,
            "sections_read": read,
            "percent": round(100 * read / total) if total else 0,
            "resume": {"section": p.section_id, "number": p.section.number, "title": p.section.title, "page": p.page,
                       "updated_at": p.updated_at,
                       "device": (ReadingLog.objects.filter(user=request.user, work=w).values_list("device", flat=True).first() or "")}
            if p else None,
            "buyers_group_link": w.buyers_group_link if acc.source == Access.Source.PURCHASE else "",
        })
    return Response(data)


@api_view(["GET"])
def toc(request, slug):
    work = get_object_or_404(Work.objects.exclude(status=Work.Status.ARCHIVED), slug=slug)
    sections = list(work.sections.all())
    progress = None
    bookmarks = []
    if request.user.is_authenticated:
        p = ReadingProgress.objects.filter(user=request.user, work=work).first()
        if p:
            progress = {"section": p.section_id, "page": p.page, "sections_read": p.sections_read}
        bookmarks = [{"id": b.pk, "section": b.section_id, "page": b.page, "note": b.note, "created_at": b.created_at}
                     for b in Bookmark.objects.filter(user=request.user, section__work=work)]
    items = []
    for s in sections:
        ok, reason = can_read(request.user, s)
        items.append({"id": s.pk, "number": s.number, "title": s.title, "readable": ok,
                      "reason": reason, "free": s.is_free_extract})
    _, reason = can_read(request.user, sections[-1]) if sections else (False, "empty")
    return Response({
        "work": {"id": work.pk, "slug": work.slug, "title": work.title, "unit_label": work.unit_label,
                 "price_xof": work.current_price_xof, "kind": work.kind, "cover_color": work.cover_color,
                 "access_mode": work.access_mode, "edition": work.edition,
                 "access_form": work.access_form.slug if work.access_form else None},
        "full_access": reason in ("owned", "staff", "extract"),
        "reason": reason,
        "sections": items,
        "progress": progress,
        "bookmarks": bookmarks,
        "sizes": list(SIZES.keys()),
        "themes": list(THEMES.keys()),
    })


@api_view(["GET"])
@throttle_classes([ReaderThrottle])
def manifest(request, pk):
    """Liste des pages d'une section sous forme d'adresses signées à durée courte."""
    section = get_object_or_404(Section.objects.select_related("work"), pk=pk)
    ok, reason = can_read(request.user, section)
    if not ok:
        return Response({"detail": reason}, status=403)
    size = request.query_params.get("size", "m")
    theme = request.query_params.get("theme", "light")
    size = size if size in SIZES else "m"
    theme = theme if theme in THEMES else "light"
    count = len(paginate(section, size))
    uid = request.user.pk if request.user.is_authenticated else 0
    skey = (request.session.session_key or "") if request.user.is_authenticated else ""
    pages = [
        "/api/reader/page/" + signing.dumps(
            {"s": section.pk, "p": i, "z": size, "t": theme, "u": uid, "k": skey}, salt=PAGE_SALT, compress=True) + "/"
        for i in range(count)
    ]
    neighbours = Section.objects.filter(work=section.work)
    prev_s = neighbours.filter(number__lt=section.number).order_by("-number").first()
    next_s = neighbours.filter(number__gt=section.number).order_by("number").first()
    return Response({
        "section": {"id": section.pk, "number": section.number, "title": section.title},
        "pages": pages,
        "ttl": settings.READER_URL_TTL_SECONDS,
        "prev": prev_s.pk if prev_s else None,
        "next": next_s.pk if next_s else None,
    })


def _flag_mass_reading(user):
    since = timezone.now() - timedelta(hours=1)
    count = ReadingLog.objects.filter(user=user, created_at__gte=since).count()
    from apps.core.models import SiteSettings
    threshold = SiteSettings.load().reader_alert_threshold
    if count < threshold:
        return False
    if not AbuseAlert.objects.filter(user=user, kind=AbuseAlert.Kind.MASS_READING, created_at__gte=since).exists():
        AbuseAlert.objects.create(user=user, kind=AbuseAlert.Kind.MASS_READING,
                                  detail=f"{count} pages en 1 h (seuil : {threshold} pages/heure)")
    return True


def page_image(request, token):
    """Image d'une page. Vérifie signature, expiration, session et droits à chaque appel."""
    try:
        data = signing.loads(token, salt=PAGE_SALT, max_age=settings.READER_URL_TTL_SECONDS)
    except signing.SignatureExpired:
        return HttpResponse("Lien expiré", status=410)
    except signing.BadSignature:
        return HttpResponse(status=403)
    user = request.user
    uid = user.pk if user.is_authenticated else 0
    if data["u"] != uid or (uid and data["k"] != request.session.session_key):
        return HttpResponse(status=403)
    section = Section.objects.select_related("work").filter(pk=data["s"]).first()
    if not section:
        return HttpResponse(status=404)
    ok, _ = can_read(user, section)
    if not ok:
        return HttpResponse(status=403)
    if user.is_authenticated:
        if _flag_mass_reading(user):
            return HttpResponse("Trop de pages consultées. Réessayez plus tard.", status=429)
        ReadingLog.objects.create(user=user, work=section.work, section=section, page=data["p"],
                                  device=describe_user_agent(request.META.get("HTTP_USER_AGENT", "")),
                                  ip_address=client_ip(request))
    mark, footer = _watermark(request, section.work)
    body = render_page(section, data["p"], data["z"], data["t"], mark, footer)
    resp = HttpResponse(body, content_type="image/webp")
    resp["Cache-Control"] = "no-store, private"
    resp["X-Robots-Tag"] = "noindex"
    resp["Content-Disposition"] = "inline"
    return resp


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_progress(request):
    section = get_object_or_404(Section.objects.select_related("work"), pk=request.data.get("section"))
    ok, _ = can_read(request.user, section)
    if not ok:
        return Response(status=403)
    p, _ = ReadingProgress.objects.get_or_create(user=request.user, work=section.work,
                                                 defaults={"section": section})
    p.section = section
    p.page = int(request.data.get("page", 0))
    if request.data.get("completed") and section.pk not in p.sections_read:
        p.sections_read = [*p.sections_read, section.pk]
    p.save()
    return Response({"ok": True, "sections_read": p.sections_read})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def bookmarks(request):
    if request.method == "POST":
        section = get_object_or_404(Section, pk=request.data.get("section"))
        b = Bookmark.objects.create(user=request.user, section=section, page=int(request.data.get("page", 0)),
                                    note=str(request.data.get("note", ""))[:500])
        return Response({"id": b.pk, "section": b.section_id, "page": b.page, "note": b.note}, status=201)
    qs = Bookmark.objects.filter(user=request.user).select_related("section__work")
    return Response([{"id": b.pk, "section": b.section_id, "page": b.page, "note": b.note,
                      "work": b.section.work.slug, "number": b.section.number} for b in qs])


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def bookmark_delete(request, pk):
    Bookmark.objects.filter(user=request.user, pk=pk).delete()
    return Response(status=204)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def claim(request, slug):
    """Mode « gratuit avec compte » : ajoute l'œuvre à la bibliothèque."""
    work = get_object_or_404(Work, slug=slug, access_mode=Work.AccessMode.FREE_ACCOUNT,
                             status=Work.Status.PUBLISHED)
    grant_access(request.user, work, Access.Source.FREE_ACCOUNT)
    return Response({"ok": True})
