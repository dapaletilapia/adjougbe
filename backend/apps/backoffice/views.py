"""API du back-office. Toutes les vues exigent un rôle à privilèges + 2FA validée."""
import csv
import io
from datetime import timedelta

import openpyxl
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action, api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import User
from apps.accounts.services import close_device
from apps.blog.models import Category, Comment, Post
from apps.blog.serializers import AdminPostSerializer
from apps.catalog.models import Bundle, Review, Section, Work
from apps.core.audit import AuditedModelViewSetMixin, log_action
from apps.core.emails import send
from apps.core.models import AuditLog, Banner, ExpertiseArea, ReleaseNote, SiteSettings
from apps.core.permissions import BackofficePermission, has_scope
from apps.forms.models import Form, FormResponse
from apps.forms.serializers import AdminFormSerializer, FormResponseSerializer
from apps.newsletter.models import Campaign, Subscriber
from apps.reader.models import AbuseAlert, ReadingLog
from apps.shop.models import Access, Order, PromoCode
from apps.shop.services import grant_access
from apps.trainings.certificates import certificate_pdf
from apps.trainings.models import Enrollment, Training, TrainingSession
from apps.trainings.services import promote_waitlist

from . import serializers as s
from .importers import parse_upload


# --- Exports -----------------------------------------------------------------

def export_rows(filename: str, headers: list[str], rows: list[list], fmt: str = "csv") -> HttpResponse:
    if fmt == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(headers)
        for r in rows:
            ws.append([v if v is None or isinstance(v, (int, float)) else _safe_csv(v) for v in r])
        buf = io.BytesIO()
        wb.save(buf)
        resp = HttpResponse(buf.getvalue(),
                            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="{filename}.xlsx"'
        return resp
    buf = io.StringIO()
    buf.write("﻿")  # BOM pour Excel
    w = csv.writer(buf, delimiter=";")
    w.writerow(headers)
    for r in rows:
        w.writerow(["" if v is None else _safe_csv(v) for v in r])
    resp = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    return resp


def _safe_csv(v):
    """Neutralise l'injection de formules dans Excel."""
    v = ", ".join(map(str, v)) if isinstance(v, list) else str(v)
    return "'" + v if v[:1] in ("=", "+", "-", "@", "\t", "\r") else v


def _dt(v):
    return timezone.localtime(v).strftime("%d/%m/%Y %H:%M") if v else ""


class BO:
    """Mixin commun : permission back-office + périmètre."""

    permission_classes = [BackofficePermission]


class BOViewSet(BO, AuditedModelViewSetMixin, viewsets.ModelViewSet):
    pass


# --- Tableau de bord ---------------------------------------------------------

@api_view(["GET"])
@permission_classes([BackofficePermission])
def dashboard(request):
    now = timezone.localtime()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month = today.replace(day=1)
    prev_month = (month - timedelta(days=1)).replace(day=1)
    paid = Order.objects.filter(status=Order.Status.PAID)

    def total(qs):
        return qs.aggregate(t=Sum("total"))["t"] or 0

    rng = request.query_params.get("range", "30")
    if rng == "365":
        from django.db.models.functions import TruncMonth
        start = (month - timedelta(days=330)).replace(day=1)
        by_m = {r["m"].date() if hasattr(r["m"], "date") else r["m"]: r for r in paid.filter(paid_at__gte=start)
                .annotate(m=TruncMonth("paid_at")).values("m").annotate(total=Sum("total"), n=Count("id"))}
        series, cur = [], start
        for _ in range(12):
            r = by_m.get(cur.date(), {})
            series.append({"date": cur.date().isoformat(), "total": r.get("total", 0) or 0, "orders": r.get("n", 0) or 0})
            cur = (cur + timedelta(days=32)).replace(day=1)
    else:
        days = 7 if rng == "7" else 30
        since = today - timedelta(days=days - 1)
        by_day = {r["d"]: r for r in paid.filter(paid_at__gte=since).annotate(d=TruncDate("paid_at"))
                  .values("d").annotate(total=Sum("total"), n=Count("id"))}
        series = []
        for i in range(days):
            d = (since + timedelta(days=i)).date()
            r = by_day.get(d, {})
            series.append({"date": d.isoformat(), "total": r.get("total", 0) or 0, "orders": r.get("n", 0) or 0})

    by_work = []
    for w in Work.objects.all():
        acc = Access.objects.filter(work=w, source=Access.Source.PURCHASE)
        revenue = paid.filter(items__work=w).aggregate(t=Sum("items__unit_price"))["t"] or 0
        by_work.append({"id": w.pk, "title": w.title, "sales": acc.filter(granted_at__gte=month).count(),
                        "sales_total": acc.count(), "revenue": revenue,
                        "readers": Access.objects.filter(work=w, revoked_at__isnull=True).count()})

    by_method = list(paid.filter(paid_at__gte=month).values("payment_method")
                     .annotate(total=Sum("total"), n=Count("id")).order_by("-total"))
    visitors = ReadingLog.objects.filter(created_at__gte=today).values("user").distinct().count()
    data = {
        "sales_today": total(paid.filter(paid_at__gte=today)),
        "orders_today": paid.filter(paid_at__gte=today).count(),
        "sales_month": total(paid.filter(paid_at__gte=month)),
        "sales_prev_month": total(paid.filter(paid_at__gte=prev_month, paid_at__lt=month)),
        "orders_month": paid.filter(paid_at__gte=month).count(),
        "new_accounts_today": User.objects.filter(date_joined__gte=today).count(),
        "new_accounts_month": User.objects.filter(date_joined__gte=month).count(),
        "new_accounts_week": User.objects.filter(date_joined__gte=today - timedelta(days=6)).count(),
        "range": rng,
        "accounts_total": User.objects.filter(role=User.Role.READER, is_active=True).count(),
        "enrollments_month": Enrollment.objects.filter(created_at__gte=month,
                                                       status=Enrollment.Status.CONFIRMED).count(),
        "subscribers": Subscriber.objects.filter(is_active=True).count(),
        "active_readers_today": visitors,
        "pending_orders": Order.objects.filter(status=Order.Status.PENDING).count(),
        "conversion_rate": round(100 * paid.values("user").distinct().count() / max(1, User.objects.filter(
            role=User.Role.READER).count()), 1),
        "series": series,
        "by_work": by_work,
        "by_method": by_method,
        "pending_comments": Comment.objects.filter(status=Comment.Status.PENDING).count(),
        "pending_reviews": Review.objects.filter(status=Review.Status.PENDING).count(),
        "latest_comments": s.AdminCommentSerializer(
            Comment.objects.select_related("user", "post").order_by("-created_at")[:5], many=True).data,
        "latest_orders": s.AdminOrderSerializer(
            Order.objects.select_related("user").prefetch_related("items")[:6], many=True).data,
        "alerts": s.AlertSerializer(AbuseAlert.objects.filter(resolved=False).select_related("user")[:10],
                                    many=True).data,
        "upcoming_sessions": s.AdminSessionSerializer(
            TrainingSession.objects.filter(starts_at__gte=now, is_cancelled=False).select_related("training")[:4],
            many=True).data,
        "scheduled_posts": Post.objects.filter(status=Post.Status.PUBLISHED, published_at__gt=now).count(),
    }
    if not has_scope(request.user, "finance") and not has_scope(request.user, "orders"):
        for k in ("sales_today", "sales_month", "sales_prev_month", "series", "by_method", "latest_orders"):
            data.pop(k, None)
        for w in data["by_work"]:
            w.pop("revenue", None)
    return Response(data)


@api_view(["GET"])
@permission_classes([BackofficePermission])
def analytics(request):
    """Audience et ventes sur 7 j, 30 j, 90 j ou 12 mois, comparées à la période précédente."""
    from apps.analytics.report import RANGES, build
    rng = request.query_params.get("range", "30")
    if rng not in RANGES:
        rng = "30"
    finance = has_scope(request.user, "finance") or has_scope(request.user, "orders")
    return Response(build(rng, finance))


@api_view(["GET"])
@permission_classes([BackofficePermission])
def badges(request):
    """Compteurs de la barre latérale."""
    return Response({
        "orders": Order.objects.filter(status=Order.Status.PENDING).count(),
        "moderation": Comment.objects.filter(status=Comment.Status.PENDING).count()
        + Review.objects.filter(status=Review.Status.PENDING).count(),
        "alerts": AbuseAlert.objects.filter(resolved=False).count(),
    })


@api_view(["GET"])
@permission_classes([BackofficePermission])
def finance_export(request):
    """Export comptable : ventes payées sur une période (par défaut le mois en cours)."""
    start = request.query_params.get("from")
    end = request.query_params.get("to")
    qs = Order.objects.filter(status__in=[Order.Status.PAID, Order.Status.REFUNDED]).select_related("user")
    if start:
        qs = qs.filter(paid_at__date__gte=start)
    if end:
        qs = qs.filter(paid_at__date__lte=end)
    rows = [[o.reference, _dt(o.paid_at), o.user.full_name, o.user.email, o.get_payment_method_display(),
             o.subtotal, o.discount, o.total, o.get_status_display(), ", ".join(i.label for i in o.items.all())]
            for o in qs.prefetch_related("items")]
    return export_rows("ventes", ["Référence", "Date", "Client", "E-mail", "Moyen", "Sous-total", "Remise", "Total",
                                  "Statut", "Articles"], rows, request.query_params.get("format", "csv"))


# --- Œuvres ------------------------------------------------------------------

class WorkViewSet(BOViewSet):
    backoffice_scope = "works"
    serializer_class = s.AdminWorkSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = Work.objects.all()
    search_fields = ["title"]

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser])
    def import_sections(self, request, pk=None):
        """Import en masse : prévisualisation (dry_run=1) puis enregistrement."""
        work = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "Aucun fichier."}, status=400)
        try:
            parsed = parse_upload(upload.name, upload.read())
        except (ValueError, KeyError) as exc:
            return Response({"detail": str(exc) or "Fichier illisible."}, status=400)
        if not parsed:
            return Response({"detail": "Aucune section détectée. Utilisez des intertitres « Série 1 », « Histoire 2 »…"},
                            status=400)
        if request.data.get("dry_run") in ("1", "true"):
            return Response({"sections": [{**p, "content": p["content"][:200]} for p in parsed], "count": len(parsed)})
        with transaction.atomic():
            for p in parsed:
                sec = Section.objects.filter(work=work, number=p["number"]).first() or Section(work=work, number=p["number"])
                changed = sec.pk and sec.content != p["content"]
                sec.title = p["title"] or sec.title
                sec.content = p["content"]
                if changed:
                    sec.edition += 1
                sec.save()
        log_action(request, "import_sections", work, f"{len(parsed)} sections")
        return Response({"imported": len(parsed)})

    @action(detail=True, methods=["post"])
    def new_edition(self, request, pk=None):
        work = self.get_object()
        work.edition += 1
        work.save(update_fields=["edition"])
        log_action(request, "new_edition", work, f"édition {work.edition}")
        return Response({"edition": work.edition})


class SectionViewSet(BOViewSet):
    backoffice_scope = "works"
    serializer_class = s.AdminSectionSerializer
    filterset_fields = ["work"]
    pagination_class = None

    def get_queryset(self):
        return Section.objects.select_related("work").all()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["full"] = self.action == "retrieve"
        return ctx


class BundleViewSet(BOViewSet):
    backoffice_scope = "works"
    serializer_class = s.AdminBundleSerializer
    queryset = Bundle.objects.prefetch_related("works")
    pagination_class = None


class PromoViewSet(BOViewSet):
    backoffice_scope = "orders"
    serializer_class = s.AdminPromoSerializer
    queryset = PromoCode.objects.prefetch_related("works")
    search_fields = ["code", "description"]


# --- Commandes ---------------------------------------------------------------

class OrderViewSet(BO, viewsets.ReadOnlyModelViewSet):
    backoffice_scope = "orders"
    serializer_class = s.AdminOrderSerializer
    search_fields = ["reference", "user__email", "user__full_name", "user__phone"]
    filterset_fields = ["status", "payment_method"]
    ordering_fields = ["created_at", "total"]

    def get_queryset(self):
        qs = Order.objects.select_related("user", "promo_code").prefetch_related("items")
        p = self.request.query_params
        if p.get("from"):
            qs = qs.filter(created_at__date__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(created_at__date__lte=p["to"])
        return qs

    @action(detail=True, methods=["post"])
    def refund(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.PAID:
            return Response({"detail": "Seule une commande payée peut être remboursée."}, status=400)
        with transaction.atomic():
            order.status = Order.Status.REFUNDED
            order.refund_reason = str(request.data.get("reason", ""))[:255]
            order.save(update_fields=["status", "refund_reason", "updated_at"])
            if request.data.get("revoke_access", True):
                order.accesses.update(revoked_at=timezone.now())
        log_action(request, "refund", order, order.refund_reason)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        """Validation manuelle (paiement reçu hors ligne, litige résolu)."""
        from apps.shop.services import confirm_payment
        order = self.get_object()
        confirm_payment(order.reference, "MANUEL-" + str(request.user.pk))
        order.refresh_from_db()
        log_action(request, "mark_paid", order)
        return Response(self.get_serializer(order).data)

    @action(detail=True, methods=["post"])
    def resend_receipt(self, request, pk=None):
        from apps.shop.services import send_receipt
        order = self.get_object()
        if order.status != Order.Status.PAID:
            return Response({"detail": "Seule une commande payée a un reçu."}, status=400)
        send_receipt(order)
        log_action(request, "resend_receipt", order)
        return Response({"ok": True})

    @action(detail=False, methods=["get"])
    def counts(self, request):
        qs = Order.objects.values("status").annotate(n=Count("id"))
        out = {r["status"]: r["n"] for r in qs}
        out["all"] = sum(out.values())
        return Response(out)

    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rows = [[o.reference, _dt(o.created_at), o.user.full_name, o.user.email, o.get_status_display(),
                 o.get_payment_method_display(), o.total, ", ".join(i.label for i in o.items.all())] for o in qs]
        return export_rows("commandes", ["Référence", "Date", "Client", "E-mail", "Statut", "Moyen", "Total",
                                         "Articles"], rows, request.query_params.get("format", "csv"))


# --- Utilisateurs ------------------------------------------------------------

class UserViewSet(BO, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                  viewsets.GenericViewSet):
    backoffice_scope = "users_read"
    serializer_class = s.AdminUserSerializer
    search_fields = ["email", "full_name", "phone", "city"]
    filterset_fields = ["role", "is_blocked", "email_verified", "newsletter_consent"]
    ordering_fields = ["date_joined", "last_seen_at", "total_spent"]

    def get_queryset(self):
        from django.db.models import OuterRef, Subquery
        from django.db.models.functions import Coalesce

        from apps.accounts.models import DeviceSession

        def count_of(model, **flt):
            sq = model.objects.filter(user=OuterRef("pk"), **flt).values("user").annotate(c=Count("id")).values("c")
            return Coalesce(Subquery(sq), 0)

        spent = Order.objects.filter(user=OuterRef("pk"), status=Order.Status.PAID).values("user") \
            .annotate(t=Sum("total")).values("t")
        qs = User.objects.all()
        if self.request.query_params.get("deletion") == "1":
            qs = qs.filter(deletion_requested_at__isnull=False, is_active=True).order_by("deletion_requested_at")
        return qs.annotate(
            orders_count=count_of(Order, status=Order.Status.PAID),
            total_spent=Coalesce(Subquery(spent), 0),
            works_count=count_of(Access, revoked_at__isnull=True),
            devices_count=count_of(DeviceSession),
            open_alerts=count_of(AbuseAlert, resolved=False),
        )

    def _require_admin(self):
        if not has_scope(self.request.user, "*"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Action réservée à l'administrateur.")

    def perform_update(self, serializer):
        self._require_admin()
        if "role" in serializer.validated_data and serializer.instance.pk == self.request.user.pk:
            serializer.validated_data.pop("role")
        obj = serializer.save()
        log_action(self.request, "update_user", obj, str(serializer.validated_data)[:200])

    def retrieve(self, request, *args, **kwargs):
        u = self.get_object()
        data = self.get_serializer(u).data
        data["orders"] = s.AdminOrderSerializer(u.orders.prefetch_related("items")[:50], many=True).data
        data["accesses"] = [{"id": a.pk, "work": a.work.title, "work_id": a.work_id, "source": a.get_source_display(),
                             "granted_at": a.granted_at, "revoked_at": a.revoked_at}
                            for a in u.accesses.select_related("work")]
        data["devices"] = s.DeviceAdminSerializer(u.devices.all(), many=True).data
        data["enrollments"] = [{"id": e.pk, "training": e.session.training.title, "date": e.session.starts_at,
                                "status": e.get_status_display()}
                               for e in u.enrollments.select_related("session__training")]
        data["reading"] = [{"work": r.work.title, "section": r.section.number, "page": r.page + 1,
                            "device": r.device, "ip": r.ip_address, "at": r.created_at}
                           for r in u.reading_logs.select_related("work", "section")[:50]]
        data["alerts"] = s.AlertSerializer(u.alerts.all()[:20], many=True).data
        return Response(data)

    @action(detail=True, methods=["post"])
    def block(self, request, pk=None):
        self._require_admin()
        u = self.get_object()
        u.is_blocked = bool(request.data.get("blocked", True))
        u.save(update_fields=["is_blocked"])
        if u.is_blocked:
            for d in u.devices.all():
                close_device(d)
        log_action(request, "block" if u.is_blocked else "unblock", u)
        return Response({"is_blocked": u.is_blocked})

    @action(detail=True, methods=["post"])
    def erase(self, request, pk=None):
        """Suppression (anonymisation) d'un compte : réservée au super administrateur, jamais sur son propre compte."""
        from rest_framework.exceptions import PermissionDenied

        from apps.accounts.services import anonymize_user
        if not request.user.is_superuser:
            raise PermissionDenied("Seul le super administrateur peut supprimer un compte.")
        u = self.get_object()
        if u.pk == request.user.pk or u.is_superuser:
            return Response({"detail": "Ce compte ne peut pas être supprimé."}, status=400)
        anonymize_user(u)
        # Pas de nom ni d'e-mail dans le journal : l'effacement doit être complet.
        log_action(request, "erase_user", u, f"Compte n° {u.pk} anonymisé")
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def grant_access(self, request, pk=None):
        self._require_admin()
        u = self.get_object()
        work = get_object_or_404(Work, pk=request.data.get("work"))
        grant_access(u, work, Access.Source.MANUAL)
        log_action(request, "grant_access", u, work.title)
        return Response({"ok": True})

    @action(detail=True, methods=["post"])
    def revoke_access(self, request, pk=None):
        self._require_admin()
        u = self.get_object()
        Access.objects.filter(user=u, work_id=request.data.get("work")).update(revoked_at=timezone.now())
        log_action(request, "revoke_access", u, str(request.data.get("work")))
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="devices/(?P<device_id>[0-9]+)/close")
    def close_device(self, request, pk=None, device_id=None):
        self._require_admin()
        u = self.get_object()
        d = u.devices.filter(pk=device_id).first()
        if d:
            close_device(d)
            log_action(request, "close_device", u, d.label)
        return Response({"ok": True})

    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rows = [[u.full_name, u.email, u.phone, u.country, u.city, u.get_role_display(), _dt(u.date_joined),
                 u.orders_count, u.total_spent or 0, "oui" if u.newsletter_consent else "non", u.preferences]
                for u in qs]
        return export_rows("utilisateurs", ["Nom", "E-mail", "Téléphone", "Pays", "Ville", "Rôle", "Inscription",
                                            "Commandes", "Total dépensé", "Newsletter", "Préférences"], rows,
                           request.query_params.get("format", "csv"))


# --- Blog et modération ------------------------------------------------------

class PostViewSet(BOViewSet):
    backoffice_scope = "blog"
    serializer_class = AdminPostSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    search_fields = ["title", "quote", "excerpt"]
    filterset_fields = ["kind", "status", "category"]
    ordering_fields = ["published_at", "view_count", "share_count"]

    def get_queryset(self):
        qs = Post.objects.select_related("category").prefetch_related("tags")
        p = self.request.query_params
        now = timezone.now()
        if p.get("state") == "live":
            qs = qs.filter(status=Post.Status.PUBLISHED, published_at__lte=now)
        elif p.get("state") == "scheduled":
            qs = qs.filter(status=Post.Status.PUBLISHED, published_at__gt=now)
        elif p.get("state") == "draft":
            qs = qs.filter(status=Post.Status.DRAFT)
        if p.get("from"):
            qs = qs.filter(published_at__date__gte=p["from"])
        if p.get("to"):
            qs = qs.filter(published_at__date__lte=p["to"])
        return qs

    def perform_create(self, serializer):
        obj = serializer.save(author=self.request.user)
        log_action(self.request, "create", obj, str(obj))


    @action(detail=False, methods=["get"])
    def counts(self, request):
        now = timezone.now()
        return Response({
            "all": Post.objects.count(),
            "live": Post.objects.filter(status=Post.Status.PUBLISHED, published_at__lte=now).count(),
            "scheduled": Post.objects.filter(status=Post.Status.PUBLISHED, published_at__gt=now).count(),
            "draft": Post.objects.filter(status=Post.Status.DRAFT).count(),
        })


class CategoryViewSet(BOViewSet):
    backoffice_scope = "blog"
    serializer_class = s.AdminCategorySerializer
    queryset = Category.objects.all()
    pagination_class = None


class CommentViewSet(BO, mixins.ListModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin,
                     viewsets.GenericViewSet):
    backoffice_scope = "comments"
    serializer_class = s.AdminCommentSerializer
    filterset_fields = ["status"]
    search_fields = ["body", "user__email", "post__title"]

    def get_queryset(self):
        return Comment.objects.select_related("user", "post").order_by("-created_at")

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        c = self.get_object()
        reply = Comment.objects.create(post=c.post, user=request.user, parent=c, body=str(request.data.get("body", ""))[:2000],
                                       status=Comment.Status.APPROVED, is_author_reply=True)
        if c.status == Comment.Status.PENDING:
            c.status = Comment.Status.APPROVED
            c.save(update_fields=["status"])
        return Response(self.get_serializer(reply).data, status=201)

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        ids = request.data.get("ids", [])
        st = request.data.get("status")
        if st not in Comment.Status.values:
            return Response(status=400)
        n = Comment.objects.filter(pk__in=ids).update(status=st)
        log_action(request, "moderate_comments", None, f"{n} → {st}")
        return Response({"updated": n})


class ReviewViewSet(BO, mixins.ListModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin,
                    viewsets.GenericViewSet):
    backoffice_scope = "comments"
    serializer_class = s.AdminReviewSerializer
    filterset_fields = ["status", "work"]

    def get_queryset(self):
        return Review.objects.select_related("user", "work")


# --- Formations --------------------------------------------------------------

class TrainingViewSet(BOViewSet):
    backoffice_scope = "trainings"
    serializer_class = s.AdminTrainingSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = Training.objects.prefetch_related("sessions")
    search_fields = ["title", "theme"]


class SessionViewSet(BOViewSet):
    backoffice_scope = "trainings"
    serializer_class = s.AdminSessionSerializer
    filterset_fields = ["training"]
    pagination_class = None

    def get_queryset(self):
        return TrainingSession.objects.select_related("training")

    def perform_update(self, serializer):
        obj = serializer.save()
        promote_waitlist(obj)  # jauge augmentée : la liste d'attente avance
        log_action(self.request, "update", obj, str(obj))

    @action(detail=True, methods=["get"])
    def enrollments(self, request, pk=None):
        session = self.get_object()
        qs = session.enrollments.select_related("user", "form_response", "order")
        if request.query_params.get("format") in ("csv", "xlsx"):
            rows = [[e.user.full_name, e.user.email, e.user.phone, e.get_status_display(),
                     "oui" if e.attended else "non", _dt(e.created_at),
                     e.form_response.data if e.form_response else ""] for e in qs]
            return export_rows(f"inscrits-{session.training.slug}", ["Nom", "E-mail", "Téléphone", "Statut",
                                                                      "Présent", "Inscrit le", "Réponses"],
                               rows, request.query_params["format"])
        return Response(s.AdminEnrollmentSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def email(self, request, pk=None):
        session = self.get_object()
        subject, body = request.data.get("subject", ""), request.data.get("body", "")
        if not subject or not body:
            return Response({"detail": "Objet et message requis."}, status=400)
        recipients = session.enrollments.filter(status=Enrollment.Status.CONFIRMED).select_related("user")
        for e in recipients:
            send(e.user.email, subject, f"Bonjour {e.user.full_name},\n\n{body}")
        log_action(request, "email_participants", session, subject)
        return Response({"sent": recipients.count()})


class EnrollmentViewSet(BO, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    backoffice_scope = "trainings"
    serializer_class = s.AdminEnrollmentSerializer
    queryset = Enrollment.objects.select_related("user", "session__training")

    def perform_update(self, serializer):
        obj = serializer.save()
        if obj.status == Enrollment.Status.CANCELLED:
            promote_waitlist(obj.session)
        log_action(self.request, "update_enrollment", obj, f"{obj.status} présent={obj.attended}")

    @action(detail=True, methods=["get"])
    def certificate(self, request, pk=None):
        enr = self.get_object()
        if not enr.attended:
            return Response({"detail": "Marquez d'abord la présence."}, status=400)
        resp = HttpResponse(certificate_pdf(enr), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="attestation-{enr.user.full_name}.pdf"'
        return resp


# --- Formulaires -------------------------------------------------------------

class FormViewSet(BOViewSet):
    backoffice_scope = "forms"
    serializer_class = AdminFormSerializer
    queryset = Form.objects.prefetch_related("fields")
    filterset_fields = ["purpose", "is_active"]

    @action(detail=True, methods=["get"])
    def responses(self, request, pk=None):
        form = self.get_object()
        qs = form.responses.select_related("user")
        if request.query_params.get("from"):
            qs = qs.filter(created_at__date__gte=request.query_params["from"])
        fmt = request.query_params.get("format")
        if fmt in ("csv", "xlsx"):
            keys = [f.key for f in form.fields.all()]
            labels = [f.label for f in form.fields.all()]
            rows = [[_dt(r.created_at), r.user.email if r.user else "", *[
                (r.data.get(k) or {}).get("name") if isinstance(r.data.get(k), dict) else r.data.get(k) for k in keys],
                "oui" if r.consent else "non", "oui" if r.newsletter else "non", r.context] for r in qs]
            return export_rows(f"reponses-{form.slug}", ["Date", "Compte", *labels, "Consentement", "Newsletter",
                                                          "Contexte"], rows, fmt)
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(FormResponseSerializer(page, many=True).data)

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        form = self.get_object()
        out = []
        responses = list(form.responses.values_list("data", flat=True))
        for f in form.fields.all():
            if f.type in ("select", "multi", "checkbox", "rating"):
                counts = {}
                for d in responses:
                    v = d.get(f.key)
                    for item in (v if isinstance(v, list) else [v]):
                        if item not in (None, ""):
                            counts[str(item)] = counts.get(str(item), 0) + 1
                out.append({"key": f.key, "label": f.label, "type": f.type, "counts": counts})
        by_day = (form.responses.annotate(d=TruncDate("created_at")).values("d").annotate(n=Count("id")).order_by("d"))
        resp_users = form.responses.filter(user__isnull=False).values("user_id", "created_at")
        first = {}
        for r in resp_users:
            first[r["user_id"]] = min(first.get(r["user_id"], r["created_at"]), r["created_at"])
        buyers = sum(1 for uid, at in first.items()
                     if Order.objects.filter(user_id=uid, status=Order.Status.PAID, paid_at__gte=at).exists())
        conversion = round(100 * buyers / len(first)) if first else 0
        return Response({"total": len(responses), "fields": out, "conversion": conversion,
                         "by_day": [{"date": r["d"].isoformat(), "count": r["n"]} for r in by_day]})


# --- Newsletter --------------------------------------------------------------

def segment_emails(segment: str) -> list[str]:
    subs = Subscriber.objects.filter(is_active=True)
    if segment == Campaign.Segment.BUYERS:
        subs = subs.filter(email__in=Order.objects.filter(status=Order.Status.PAID).values("user__email"))
    elif segment == Campaign.Segment.LEARNERS:
        subs = subs.filter(email__in=Enrollment.objects.filter(status=Enrollment.Status.CONFIRMED).values("user__email"))
    elif segment == Campaign.Segment.FREE_FORMS:
        subs = subs.filter(source__startswith="formulaire:")
    elif segment == Campaign.Segment.INACTIVE:
        cutoff = timezone.now() - timedelta(days=60)
        subs = subs.filter(email__in=User.objects.filter(Q(last_seen_at__lt=cutoff) | Q(last_seen_at__isnull=True))
                           .values("email"))
    return list(subs.values_list("email", flat=True))


class SubscriberViewSet(BO, mixins.ListModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin,
                        viewsets.GenericViewSet):
    backoffice_scope = "newsletter"
    serializer_class = s.AdminSubscriberSerializer
    queryset = Subscriber.objects.all()
    search_fields = ["email", "source"]
    filterset_fields = ["is_active"]

    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.filter_queryset(self.get_queryset())
        rows = [[x.email, x.source, x.preferences, "actif" if x.is_active else "désinscrit", _dt(x.consent_at)]
                for x in qs]
        return export_rows("abonnes", ["E-mail", "Source", "Préférences", "Statut", "Consentement"], rows,
                           request.query_params.get("format", "csv"))

    @action(detail=False, methods=["get"])
    def segments(self, request):
        return Response([{"value": v, "label": label, "count": len(segment_emails(v))}
                         for v, label in Campaign.Segment.choices])


class CampaignViewSet(BOViewSet):
    backoffice_scope = "newsletter"
    serializer_class = s.AdminCampaignSerializer
    queryset = Campaign.objects.all()

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        from apps.core.emails import front
        c = self.get_object()
        if c.sent_at:
            return Response({"detail": "Campagne déjà envoyée."}, status=400)
        emails = segment_emails(c.segment)
        tokens = dict(Subscriber.objects.filter(email__in=emails).values_list("email", "unsubscribe_token"))
        for e in emails:
            send(e, c.subject, f"{c.body}\n\n—\nSe désinscrire : {front('/desinscription?token=' + tokens.get(e, ''))}")
        c.sent_at, c.recipients_count = timezone.now(), len(emails)
        c.save(update_fields=["sent_at", "recipients_count"])
        log_action(request, "send_campaign", c, f"{len(emails)} destinataires")
        return Response(self.get_serializer(c).data)


# --- Pages, paramètres, sécurité --------------------------------------------

class BannerViewSet(BOViewSet):
    backoffice_scope = "pages"
    serializer_class = s.AdminBannerSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = Banner.objects.all()
    pagination_class = None


class ExpertiseViewSet(BOViewSet):
    backoffice_scope = "pages"
    serializer_class = s.AdminExpertiseSerializer
    queryset = ExpertiseArea.objects.all()
    pagination_class = None


@api_view(["GET", "PATCH"])
@permission_classes([BackofficePermission])
def site_settings(request):
    obj = SiteSettings.load()
    if request.method == "PATCH":
        if not has_scope(request.user, "*"):
            return Response(status=403)
        ser = s.AdminSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        log_action(request, "update_settings", obj, ", ".join(request.data.keys()))
    return Response(s.AdminSettingsSerializer(obj).data)


@api_view(["POST"])
@permission_classes([BackofficePermission])
@parser_classes([MultiPartParser])
def media_upload(request):
    """Image insérée dans un article (éditeur riche)."""
    from django.core.files.storage import default_storage
    f = request.FILES.get("file")
    if not f or not f.content_type.startswith("image/") or f.size > 5 * 1024 * 1024:
        return Response({"detail": "Image (5 Mo max) requise."}, status=400)
    from PIL import Image
    try:
        Image.open(f).verify()
    except Exception:
        return Response({"detail": "Image illisible."}, status=400)
    # Ré-encodage : le fichier enregistré est toujours une vraie image, sous un nom et une extension choisis ici.
    import uuid
    from django.core.files.base import ContentFile
    f.seek(0)
    try:
        img = Image.open(f)
        # Dimensions lues dans l'en-tête, avant décompression : refuse les « bombes » d'images.
        if img.width * img.height > 40_000_000 or getattr(img, "n_frames", 1) > 200:
            return Response({"detail": "Image trop grande (40 mégapixels max)."}, status=400)
        img.load()  # GIF animé : seule la première image est conservée
    except Exception:
        return Response({"detail": "Image illisible."}, status=400)
    fmt = {"JPEG": ("JPEG", "jpg"), "PNG": ("PNG", "png"), "GIF": ("GIF", "gif")}.get(img.format, ("WEBP", "webp"))
    if fmt[0] == "JPEG" and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    out = io.BytesIO()
    img.save(out, fmt[0])
    path = default_storage.save(f"uploads/{timezone.now():%Y/%m}/{uuid.uuid4().hex}.{fmt[1]}", ContentFile(out.getvalue()))
    return Response({"url": default_storage.url(path)}, status=201)


AUDIT_CATEGORIES = {
    "connexions": ["otp_login"],
    "acces": ["grant_access", "revoke_access", "block", "unblock", "close_device", "update_user"],
    "paiements": ["refund", "mark_paid", "resend_receipt"],
}


class AuditLogViewSet(BO, viewsets.ReadOnlyModelViewSet):
    backoffice_scope = "*"
    serializer_class = s.AuditLogSerializer
    search_fields = ["action", "summary", "actor__email"]
    filterset_fields = ["action"]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor")
        cat = self.request.query_params.get("category")
        if cat in AUDIT_CATEGORIES:
            qs = qs.filter(action__in=AUDIT_CATEGORIES[cat])
        elif cat == "contenu":
            qs = qs.exclude(action__in=[a for v in AUDIT_CATEGORIES.values() for a in v])
        return qs


class AlertViewSet(BO, mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    backoffice_scope = "users_read"
    serializer_class = s.AlertSerializer
    queryset = AbuseAlert.objects.select_related("user")
    filterset_fields = ["resolved", "kind"]


class ReleaseNoteViewSet(BOViewSet):
    backoffice_scope = "*"
    serializer_class = s.ReleaseNoteSerializer
    queryset = ReleaseNote.objects.all()
    pagination_class = None


@api_view(["GET"])
@permission_classes([BackofficePermission])
def search(request):
    """Recherche globale du back-office."""
    q = request.query_params.get("q", "").strip()
    if len(q) < 2:
        return Response({"results": []})
    res = []
    u_ = request.user
    if has_scope(u_, "works"):
        for w in Work.objects.filter(title__icontains=q)[:5]:
            res.append({"type": "Œuvre", "label": w.title, "path": f"/admin/oeuvres/{w.pk}"})
    if has_scope(u_, "orders") or has_scope(u_, "finance"):
        for o in Order.objects.filter(Q(reference__icontains=q) | Q(user__email__icontains=q)).select_related("user")[:5]:
            res.append({"type": "Commande", "label": f"{o.reference} — {o.user.email}", "path": f"/admin/commandes?q={o.reference}"})
    if has_scope(request.user, "users_read"):
        for u in User.objects.filter(Q(email__icontains=q) | Q(full_name__icontains=q))[:5]:
            res.append({"type": "Utilisateur", "label": f"{u.full_name} — {u.email}", "path": f"/admin/utilisateurs/{u.pk}"})
    if has_scope(u_, "blog"):
        for p in Post.objects.filter(title__icontains=q)[:5]:
            res.append({"type": "Article", "label": p.title, "path": f"/admin/blog/{p.pk}"})
    if has_scope(u_, "trainings"):
        for t in Training.objects.filter(title__icontains=q)[:5]:
            res.append({"type": "Formation", "label": t.title, "path": f"/admin/formations/{t.pk}"})
    return Response({"results": res})

