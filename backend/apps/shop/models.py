import secrets

from django.conf import settings
from django.db import models
from django.db.models import F
from django.utils import timezone

from apps.core.models import TimeStampedModel


class PaymentMethod(models.TextChoices):
    ORANGE_MONEY = "orange_money", "Orange Money"
    MTN_MOMO = "mtn_momo", "MTN MoMo"
    MOOV_MONEY = "moov_money", "Moov Money"
    WAVE = "wave", "Wave"
    CARD = "card", "Carte bancaire (Visa, Mastercard)"
    FREE = "free", "Gratuit"
    MANUAL = "manual", "Accès offert"


class PromoCode(TimeStampedModel):
    code = models.CharField(max_length=40, unique=True)
    description = models.CharField(max_length=200, blank=True)
    percent_off = models.PositiveSmallIntegerField(null=True, blank=True)
    amount_off_xof = models.PositiveIntegerField(null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    used_count = models.PositiveIntegerField(default=0)
    min_total_xof = models.PositiveIntegerField(default=0)
    works = models.ManyToManyField("catalog.Work", blank=True, help_text="Vide = valable sur toute la boutique")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    def is_valid_now(self) -> bool:
        now = timezone.now()
        return (self.is_active and (not self.starts_at or self.starts_at <= now)
                and (not self.ends_at or self.ends_at >= now)
                and (self.max_uses is None or self.used_count < self.max_uses))

    def discount_for(self, eligible_total: int) -> int:
        if self.percent_off:
            return min(eligible_total, eligible_total * self.percent_off // 100)
        if self.amount_off_xof:
            return min(eligible_total, self.amount_off_xof)
        return 0


def new_reference() -> str:
    return "ADJ-" + timezone.now().strftime("%y%m") + "-" + secrets.token_hex(3).upper()


class Order(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente de paiement"
        PAID = "paid", "Payée"
        FAILED = "failed", "Échec"
        CANCELLED = "cancelled", "Annulée"
        REFUNDED = "refunded", "Remboursée"

    reference = models.CharField(max_length=24, unique=True, default=new_reference)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING, db_index=True)
    subtotal = models.PositiveIntegerField(default=0)
    discount = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)
    currency = models.CharField(max_length=3, default="XOF")
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, blank=True)
    promo_code = models.ForeignKey(PromoCode, null=True, blank=True, on_delete=models.SET_NULL)
    provider = models.CharField(max_length=30, blank=True)
    provider_reference = models.CharField(max_length=120, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    refund_reason = models.CharField(max_length=255, blank=True)
    is_gift = models.BooleanField(default=False)
    gift_recipient_email = models.EmailField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.reference

    def mark_paid(self, provider_reference: str = ""):
        """Confirme la commande et débloque immédiatement l'accès (idempotent)."""
        from .services import fulfil_order

        if self.status == self.Status.PAID:
            return False
        self.status = self.Status.PAID
        self.paid_at = timezone.now()
        if provider_reference:
            self.provider_reference = provider_reference
        self.save(update_fields=["status", "paid_at", "provider_reference", "updated_at"])
        if self.promo_code_id:
            PromoCode.objects.filter(pk=self.promo_code_id).update(used_count=F("used_count") + 1)
        fulfil_order(self)
        return True


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    work = models.ForeignKey("catalog.Work", null=True, blank=True, on_delete=models.PROTECT)
    bundle = models.ForeignKey("catalog.Bundle", null=True, blank=True, on_delete=models.PROTECT)
    training_session = models.ForeignKey("trainings.TrainingSession", null=True, blank=True, on_delete=models.PROTECT)
    label = models.CharField(max_length=200)
    unit_price = models.PositiveIntegerField()
    quantity = models.PositiveSmallIntegerField(default=1)

    @property
    def line_total(self) -> int:
        return self.unit_price * self.quantity


class PaymentEvent(models.Model):
    """Trace brute de chaque notification de la passerelle (litiges, audit)."""

    order = models.ForeignKey(Order, null=True, on_delete=models.SET_NULL, related_name="payment_events")
    provider = models.CharField(max_length=30)
    event = models.CharField(max_length=40)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Access(models.Model):
    """Droit de lecture d'une œuvre pour un utilisateur."""

    class Source(models.TextChoices):
        PURCHASE = "purchase", "Achat"
        FREE_FORM = "free_form", "Formulaire"
        FREE_ACCOUNT = "free_account", "Gratuit avec compte"
        MANUAL = "manual", "Offert par l'administrateur"
        GIFT = "gift", "Cadeau"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accesses")
    work = models.ForeignKey("catalog.Work", on_delete=models.CASCADE, related_name="accesses")
    source = models.CharField(max_length=20, choices=Source.choices)
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name="accesses")
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("user", "work")]
        ordering = ["-granted_at"]

    def __str__(self):
        return f"{self.user} → {self.work}"

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None


class GiftCode(TimeStampedModel):
    """« Offrir un livre » : code d'accès envoyé au destinataire."""

    code = models.CharField(max_length=20, unique=True)
    work = models.ForeignKey("catalog.Work", on_delete=models.CASCADE)
    order = models.ForeignKey(Order, null=True, blank=True, on_delete=models.SET_NULL, related_name="gift_codes")
    recipient_email = models.EmailField(blank=True)
    redeemed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    redeemed_at = models.DateTimeField(null=True, blank=True)

    @staticmethod
    def generate() -> str:
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3))
