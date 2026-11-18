import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


class Training(TimeStampedModel):
    class Format(models.TextChoices):
        ONSITE = "onsite", "Présentiel"
        ONLINE = "online", "En ligne en direct"
        RECORDED = "recorded", "Enregistrée"

    title = models.CharField(max_length=180)
    slug = models.SlugField(unique=True, max_length=200)
    theme = models.CharField(max_length=80, blank=True)
    format = models.CharField(max_length=12, choices=Format.choices, default=Format.ONLINE)
    summary = models.TextField(blank=True)
    objectives = models.JSONField(default=list, blank=True)
    audience = models.TextField(blank=True)
    program = models.JSONField(default=list, blank=True, help_text="Liste de modules {titre, détail}")
    duration_label = models.CharField(max_length=80, blank=True)
    trainer = models.CharField(max_length=120, default="Adjougbe")
    cover = models.ImageField(upload_to="trainings/", blank=True)
    price_xof = models.PositiveIntegerField(default=0)
    faq = models.JSONField(default=list, blank=True)
    testimonials = models.JSONField(default=list, blank=True)
    registration_form = models.ForeignKey("forms_builder.Form", null=True, blank=True, on_delete=models.SET_NULL,
                                          related_name="trainings")
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:200]
        super().save(*args, **kwargs)

    @property
    def is_free(self):
        return self.price_xof == 0


class TrainingSession(models.Model):
    class Status(models.TextChoices):
        UPCOMING = "upcoming", "À venir"
        OPEN = "open", "Inscriptions ouvertes"
        FULL = "full", "Complet"
        DONE = "done", "Terminé"
        CANCELLED = "cancelled", "Annulée"

    training = models.ForeignKey(Training, on_delete=models.CASCADE, related_name="sessions")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    location = models.CharField(max_length=200, blank=True, help_text="Adresse (présentiel)")
    meeting_link = models.URLField(blank=True, help_text="Zoom, Meet ou WhatsApp — envoyé aux inscrits seulement")
    capacity = models.PositiveIntegerField(default=30)
    price_xof = models.PositiveIntegerField(null=True, blank=True, help_text="Vide = prix de la formation")
    registrations_open = models.BooleanField(default=True)
    is_cancelled = models.BooleanField(default=False)
    reminder_24h_sent = models.BooleanField(default=False)
    reminder_1h_sent = models.BooleanField(default=False)

    class Meta:
        ordering = ["starts_at"]

    def __str__(self):
        return f"{self.training.title} — {timezone.localtime(self.starts_at):%d/%m/%Y %H:%M}"

    @property
    def effective_price(self) -> int:
        return self.price_xof if self.price_xof is not None else self.training.price_xof

    @property
    def seats_taken(self) -> int:
        return self.enrollments.filter(status__in=[Enrollment.Status.CONFIRMED, Enrollment.Status.PENDING_PAYMENT]).count()

    @property
    def seats_left(self) -> int:
        return max(0, self.capacity - self.seats_taken)

    @property
    def status(self) -> str:
        now = timezone.now()
        if self.is_cancelled:
            return self.Status.CANCELLED
        if self.ends_at < now:
            return self.Status.DONE
        if self.seats_left == 0:
            return self.Status.FULL
        if self.registrations_open:
            return self.Status.OPEN
        return self.Status.UPCOMING


def certificate_code() -> str:
    return "ADJ-" + secrets.token_hex(4).upper()


class Enrollment(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING_PAYMENT = "pending_payment", "En attente de paiement"
        CONFIRMED = "confirmed", "Confirmée"
        WAITLIST = "waitlist", "Liste d'attente"
        CANCELLED = "cancelled", "Annulée"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments")
    session = models.ForeignKey(TrainingSession, on_delete=models.CASCADE, related_name="enrollments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT)
    order = models.ForeignKey("shop.Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="enrollments")
    form_response = models.ForeignKey("forms_builder.FormResponse", null=True, blank=True, on_delete=models.SET_NULL)
    attended = models.BooleanField(default=False)
    certificate_code = models.CharField(max_length=20, blank=True, db_index=True)
    certificate_issued_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("user", "session")]
        ordering = ["-created_at"]

    def issue_certificate(self):
        if not self.certificate_code:
            self.certificate_code = certificate_code()
            self.certificate_issued_at = timezone.now()
            self.save(update_fields=["certificate_code", "certificate_issued_at"])
        return self.certificate_code
