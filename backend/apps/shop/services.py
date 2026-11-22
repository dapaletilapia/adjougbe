"""Panier, calcul des prix, création et exécution des commandes."""
from dataclasses import dataclass, field

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.catalog.models import Bundle, Work
from apps.core.emails import front, send

from .models import Access, GiftCode, Order, OrderItem, PromoCode


@dataclass
class Line:
    kind: str  # work | bundle | session
    obj: object
    label: str
    unit_price: int
    work_ids: list = field(default_factory=list)


def owned_work_ids(user) -> set:
    if not user or not user.is_authenticated:
        return set()
    return set(Access.objects.filter(user=user, revoked_at__isnull=True).values_list("work_id", flat=True))


def build_lines(items, user=None, gift=False) -> list[Line]:
    from apps.trainings.models import TrainingSession

    owned = set() if gift else owned_work_ids(user)
    lines, seen = [], set()
    for raw in items:
        kind, pk = raw.get("type"), raw.get("id")
        if (kind, pk) in seen:
            continue
        seen.add((kind, pk))
        if kind == "work":
            w = Work.objects.filter(pk=pk, status__in=[Work.Status.PUBLISHED, Work.Status.PREORDER],
                                    access_mode=Work.AccessMode.PAID).first()
            if not w:
                raise ValidationError({"items": "Œuvre indisponible à la vente."})
            if w.pk in owned:
                continue
            lines.append(Line("work", w, w.title, w.current_price_xof, [w.pk]))
        elif kind == "bundle":
            b = Bundle.objects.filter(pk=pk, is_active=True).prefetch_related("works").first()
            if not b:
                raise ValidationError({"items": "Offre indisponible."})
            lines.append(Line("bundle", b, b.title, b.price_xof, [w.pk for w in b.works.all()]))
        elif kind == "session":
            s = TrainingSession.objects.filter(pk=pk, training__is_published=True).select_related("training").first()
            if not s:
                raise ValidationError({"items": "Session introuvable."})
            if s.training.registration_mode == s.training.Registration.EXTERNAL:
                raise ValidationError({"items": "L'inscription à cette formation se fait auprès de l'organisateur."})
            lines.append(Line("session", s, str(s), s.effective_price))
        else:
            raise ValidationError({"items": "Article inconnu."})
    # Une œuvre achetée seule et aussi incluse dans un pack : on garde le pack.
    bundled = {wid for ln in lines if ln.kind == "bundle" for wid in ln.work_ids}
    return [ln for ln in lines if not (ln.kind == "work" and ln.obj.pk in bundled)]


def resolve_promo(code: str, lines: list[Line]):
    if not code:
        return None, 0
    promo = PromoCode.objects.filter(code__iexact=code.strip()).prefetch_related("works").first()
    if not promo or not promo.is_valid_now():
        raise ValidationError({"promo_code": "Code promo invalide ou expiré."})
    restricted = {w.pk for w in promo.works.all()}
    eligible = sum(ln.unit_price for ln in lines
                   if not restricted or (ln.kind in ("work", "bundle") and set(ln.work_ids) & restricted))
    if sum(ln.unit_price for ln in lines) < promo.min_total_xof:
        raise ValidationError({"promo_code": f"Montant minimum : {promo.min_total_xof} FCFA."})
    return promo, promo.discount_for(eligible)


def quote(items, promo_code="", user=None, gift=False) -> dict:
    lines = build_lines(items, user, gift)
    promo, discount = resolve_promo(promo_code, lines)
    subtotal = sum(ln.unit_price for ln in lines)
    return {
        "lines": [{"type": ln.kind, "id": ln.obj.pk, "label": ln.label, "unit_price": ln.unit_price} for ln in lines],
        "subtotal": subtotal,
        "discount": discount,
        "total": subtotal - discount,
        "promo_code": promo.code if promo else "",
        "_lines": lines,
        "_promo": promo,
    }


@transaction.atomic
def create_order(user, items, payment_method, promo_code="", gift_email="") -> Order:
    q = quote(items, promo_code, user, gift=bool(gift_email))
    if not q["_lines"]:
        raise ValidationError({"items": "Votre panier est vide ou vous possédez déjà ces œuvres."})
    order = Order.objects.create(
        user=user, subtotal=q["subtotal"], discount=q["discount"], total=q["total"],
        payment_method=payment_method if q["total"] > 0 else "free", promo_code=q["_promo"],
        is_gift=bool(gift_email), gift_recipient_email=gift_email or "",
    )
    for ln in q["_lines"]:
        OrderItem.objects.create(
            order=order, label=ln.label, unit_price=ln.unit_price,
            work=ln.obj if ln.kind == "work" else None,
            bundle=ln.obj if ln.kind == "bundle" else None,
            training_session=ln.obj if ln.kind == "session" else None,
        )
    return order


def grant_access(user, work, source, order=None) -> Access:
    access, created = Access.objects.get_or_create(user=user, work=work, defaults={"source": source, "order": order})
    if not created and access.revoked_at:
        access.revoked_at = None
        access.source, access.order = source, order
        access.save(update_fields=["revoked_at", "source", "order"])
    return access


def fulfil_order(order: Order):
    """Déblocage automatique après confirmation du paiement."""
    from apps.trainings.models import Enrollment
    from apps.trainings.services import send_enrollment_confirmation

    gift_codes = []
    for item in order.items.select_related("work", "bundle", "training_session__training"):
        works = [item.work] if item.work else list(item.bundle.works.all()) if item.bundle else []
        for w in works:
            if order.is_gift:
                gift_codes.append(GiftCode.objects.create(code=GiftCode.generate(), work=w, order=order,
                                                          recipient_email=order.gift_recipient_email))
            else:
                grant_access(order.user, w, Access.Source.PURCHASE, order)
        if item.training_session:
            enr = Enrollment.objects.filter(order=order, session=item.training_session).first()
            if enr:
                enr.status = Enrollment.Status.CONFIRMED
                enr.save(update_fields=["status"])
                send_enrollment_confirmation(enr)
    send_receipt(order)
    if gift_codes:
        send_gift_codes(order, gift_codes)


def send_receipt(order: Order):
    lines = "\n".join(f"  • {i.label} — {i.line_total:,} FCFA".replace(",", " ") for i in order.items.all())
    send(
        order.user.email,
        f"Votre reçu {order.reference} — Adjougbe",
        f"Bonjour {order.user.full_name},\n\nMerci pour votre achat !\n\nCommande {order.reference}\n{lines}\n"
        f"  Remise : {order.discount} FCFA\n  Total payé : {order.total} FCFA\n\n"
        f"Vos livres vous attendent dans votre bibliothèque en ligne : {front('/bibliotheque')}\n"
        "Aucun fichier n'est joint : la lecture se fait uniquement sur le site.\n\nAdjougbe — Possumus",
    )


def send_gift_codes(order: Order, codes):
    body = "\n".join(f"  • {c.work.title} : {c.code}" for c in codes)
    send(
        order.gift_recipient_email,
        f"{order.user.full_name} vous offre un livre d'Adjougbe",
        f"Bonjour,\n\n{order.user.full_name} vous offre :\n{body}\n\n"
        f"Créez votre compte puis saisissez le code ici : {front('/cadeau')}\n\nBonne lecture !",
    )


@transaction.atomic
def redeem_gift(user, code: str) -> GiftCode:
    gift = GiftCode.objects.select_for_update().filter(code__iexact=code.strip()).first()
    if not gift or gift.redeemed_at:
        raise ValidationError({"code": "Code cadeau invalide ou déjà utilisé."})
    gift.redeemed_by, gift.redeemed_at = user, timezone.now()
    gift.save(update_fields=["redeemed_by", "redeemed_at"])
    grant_access(user, gift.work, Access.Source.GIFT, gift.order)
    return gift


@transaction.atomic
def confirm_payment(reference: str, provider_reference: str = "") -> Order | None:
    order = Order.objects.select_for_update().filter(reference=reference).first()
    if order:
        order.mark_paid(provider_reference)
    return order


@transaction.atomic
def fail_payment(reference: str):
    order = Order.objects.select_for_update().filter(reference=reference, status=Order.Status.PENDING).first()
    if order:
        order.status = Order.Status.FAILED
        order.save(update_fields=["status", "updated_at"])
        from apps.trainings.models import Enrollment
        Enrollment.objects.filter(order=order, status=Enrollment.Status.PENDING_PAYMENT).update(
            status=Enrollment.Status.CANCELLED)
    return order
