"""Rapport d'audience et de ventes pour le tableau de bord du Studio, sur une période et la précédente."""
from datetime import date, timedelta

from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone

from apps.accounts.models import User
from apps.blog.models import Post
from apps.catalog.models import Work
from apps.newsletter.models import Subscriber
from apps.shop.models import Order, OrderItem
from apps.trainings.models import Enrollment, Training

from .models import DailyVisitor, PageView

RANGES = {"7": 7, "30": 30, "90": 90, "365": 365}
SOURCE_LABELS = {"direct": "Accès direct", "whatsapp": "WhatsApp", "facebook": "Facebook", "instagram": "Instagram",
                 "tiktok": "TikTok", "x": "X (Twitter)", "linkedin": "LinkedIn", "telegram": "Telegram",
                 "google": "Google", "bing": "Bing", "youtube": "YouTube", "autre": "Autres sites"}
PAGE_LABELS = {"/": "Accueil", "/boutique": "Œuvres", "/formations": "Formations", "/blog": "Blog", "/a-propos": "À propos",
               "/panier": "Panier", "/recherche": "Recherche", "/connexion": "Connexion",
               "/inscription": "Création de compte", "/bibliotheque": "Bibliothèque", "/cadeau": "Code cadeau"}


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, 1)


def _buckets(rng: str):
    """Bornes des points de la courbe (jours, ou mois sur 12 mois) pour la période et la précédente."""
    today = timezone.localdate()
    if rng == "365":
        first = _add_months(_month_start(today), -11)
        cur = [_add_months(first, i) for i in range(12)]
        prev = [_add_months(first, i - 12) for i in range(12)]
        return cur, prev, first, today, prev[0], first - timedelta(days=1), True
    n = RANGES.get(rng, 30)
    start = today - timedelta(days=n - 1)
    cur = [start + timedelta(days=i) for i in range(n)]
    prev = [start - timedelta(days=n - i) for i in range(n)]
    return cur, prev, start, today, prev[0], start - timedelta(days=1), False


def _by_bucket(qs, field, monthly, agg):
    """{date du point: valeur} pour un queryset regroupé par jour ou par mois."""
    trunc = TruncMonth(field) if monthly else TruncDate(field)
    out = {}
    for r in qs.annotate(b=trunc).values("b").annotate(v=agg).values("b", "v"):
        b = r["b"].date() if hasattr(r["b"], "date") else r["b"]
        out[b] = r["v"] or 0
    return out


def _day_bucket(qs, monthly, agg):
    if not monthly:
        return {r["day"]: r["v"] or 0 for r in qs.values("day").annotate(v=agg)}
    out = {}
    for r in qs.values("day").annotate(v=agg):
        k = _month_start(r["day"])
        out[k] = out.get(k, 0) + (r["v"] or 0)
    return out


def _page_label(path: str, titles: dict) -> str:
    if path in PAGE_LABELS:
        return PAGE_LABELS[path]
    return titles.get(path, path)


def build(rng: str, finance: bool) -> dict:
    cur, prev, start, end, pstart, pend, monthly = _buckets(rng)
    tz = timezone.get_current_timezone()

    def dt(d, end_of_day=False):
        from datetime import datetime, time
        return timezone.make_aware(datetime.combine(d, time.max if end_of_day else time.min), tz)

    def window(a, b):
        return dt(a), dt(b, True)

    def stats(a, b):
        lo, hi = window(a, b)
        visitors = DailyVisitor.objects.filter(day__range=(a, b))
        paid = Order.objects.filter(status=Order.Status.PAID, paid_at__range=(lo, hi))
        signups = User.objects.filter(role=User.Role.READER, date_joined__range=(lo, hi)).count()
        v = visitors.count()
        revenue = paid.aggregate(t=Sum("total"))["t"] or 0
        orders = paid.count()
        buyers = paid.values("user").distinct().count()
        return {
            "visitors": v,
            "views": PageView.objects.filter(day__range=(a, b)).aggregate(t=Sum("views"))["t"] or 0,
            "pages_per_visit": round((visitors.aggregate(t=Sum("pages"))["t"] or 0) / v, 1) if v else 0,
            "signups": signups,
            "buyers": buyers,
            "conversion": round(100 * buyers / v, 1) if v else 0,
            "enrollments": Enrollment.objects.filter(created_at__range=(lo, hi), status=Enrollment.Status.CONFIRMED).count(),
            "subscribers": Subscriber.objects.filter(created_at__range=(lo, hi)).count(),
            "revenue": revenue,
            "orders": orders,
            "avg_order": round(revenue / orders) if orders else 0,
        }

    now_stats, prev_stats = stats(start, end), stats(pstart, pend)

    def series_for(days, a, b):
        lo, hi = window(a, b)
        paid = Order.objects.filter(status=Order.Status.PAID, paid_at__range=(lo, hi))
        vis = _day_bucket(DailyVisitor.objects.filter(day__range=(a, b)), monthly, Count("id"))
        views = _day_bucket(PageView.objects.filter(day__range=(a, b)), monthly, Sum("views"))
        rev = _by_bucket(paid, "paid_at", monthly, Sum("total"))
        orders = _by_bucket(paid, "paid_at", monthly, Count("id"))
        sign = _by_bucket(User.objects.filter(role=User.Role.READER, date_joined__range=(lo, hi)), "date_joined", monthly, Count("id"))
        return [{"date": d.isoformat(), "visitors": vis.get(d, 0), "views": views.get(d, 0), "revenue": rev.get(d, 0),
                 "orders": orders.get(d, 0), "signups": sign.get(d, 0)} for d in days]

    series = series_for(cur, start, end)
    previous = series_for(prev, pstart, pend)

    visitors = DailyVisitor.objects.filter(day__range=(start, end))
    sources = [{"key": r["source"], "label": SOURCE_LABELS.get(r["source"], r["source"]), "visitors": r["n"]}
               for r in visitors.values("source").annotate(n=Count("id")).order_by("-n")]
    devices = {r["device"]: r["n"] for r in visitors.values("device").annotate(n=Count("id"))}
    pages = list(PageView.objects.filter(day__range=(start, end)).values("path").annotate(views=Sum("views")).order_by("-views")[:8])
    landings = {r["landing"]: r["n"] for r in visitors.values("landing").annotate(n=Count("id"))}

    # Titres lisibles des pages de contenu.
    slugs = {p["path"].split("/")[2] for p in pages if p["path"].count("/") == 2}
    titles = {f"/livres/{w.slug}": w.title for w in Work.objects.filter(slug__in=slugs)}
    titles |= {f"/blog/{x.slug}": x.title for x in Post.objects.filter(slug__in=slugs)}
    titles |= {f"/formations/{t.slug}": t.title for t in Training.objects.filter(slug__in=slugs)}
    top_pages = [{"path": p["path"], "label": _page_label(p["path"], titles), "views": p["views"],
                  "entries": landings.get(p["path"], 0)} for p in pages]

    data = {
        "range": rng, "monthly": monthly, "start": start.isoformat(), "end": end.isoformat(),
        "kpis": {k: {"value": now_stats[k], "prev": prev_stats[k]} for k in now_stats},
        "series": series, "previous": previous,
        "sources": sources,
        "devices": [{"key": k, "label": lbl, "visitors": devices.get(k, 0)} for k, lbl in DailyVisitor.Device.choices],
        "top_pages": top_pages,
        "funnel": [
            {"key": "visitors", "label": "Visiteurs", "value": now_stats["visitors"]},
            {"key": "signups", "label": "Comptes créés", "value": now_stats["signups"]},
            {"key": "buyers", "label": "Acheteurs", "value": now_stats["buyers"]},
        ],
    }
    if finance:
        lo, hi = window(start, end)
        items = (OrderItem.objects.filter(order__status=Order.Status.PAID, order__paid_at__range=(lo, hi))
                 .values("label").annotate(revenue=Sum(F("unit_price") * F("quantity")), sold=Sum("quantity"))
                 .order_by("-revenue")[:6])
        data["top_products"] = [{"label": r["label"], "revenue": r["revenue"], "sold": r["sold"]} for r in items]
    else:
        for k in ("revenue", "orders", "avg_order"):
            data["kpis"].pop(k)
        for row in data["series"] + data["previous"]:
            row.pop("revenue")
            row.pop("orders")
    return data
