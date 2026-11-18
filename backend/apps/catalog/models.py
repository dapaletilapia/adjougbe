from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.crypto import decrypt_text, encrypt_text
from apps.core.models import TimeStampedModel


class Work(TimeStampedModel):
    """Œuvre : Punchlines T1/T2, Les Papos de Tiékar, futurs tomes."""

    class Kind(models.TextChoices):
        PUNCHLINES = "punchlines", "Punchlines (séries)"
        STORIES = "stories", "Histoires"
        OTHER = "other", "Autre"

    class AccessMode(models.TextChoices):
        PAID = "paid", "Payant"
        FREE_FORM = "free_form", "Gratuit avec formulaire"
        FREE_ACCOUNT = "free_account", "Gratuit avec compte"
        PUBLIC = "public", "Extrait public (sans compte)"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publié"
        PREORDER = "preorder", "Précommande"
        ARCHIVED = "archived", "Archivé"

    title = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=200, blank=True)
    slug = models.SlugField(unique=True, max_length=180)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.PUNCHLINES)
    cover = models.ImageField(upload_to="covers/", blank=True)
    cover_color = models.CharField(max_length=9, default="#ec681c", help_text="Couleur d'accent de la fiche")
    summary = models.TextField(blank=True)
    format_label = models.CharField(max_length=80, default="Livre numérique — lecture en ligne")
    price_xof = models.PositiveIntegerField(default=0)
    price_eur = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    # Prix de lancement / promotion à durée limitée (compte à rebours sur la fiche).
    promo_price_xof = models.PositiveIntegerField(null=True, blank=True)
    promo_ends_at = models.DateTimeField(null=True, blank=True)
    access_mode = models.CharField(max_length=20, choices=AccessMode.choices, default=AccessMode.PAID)
    access_form = models.ForeignKey("forms_builder.Form", null=True, blank=True, on_delete=models.SET_NULL,
                                    related_name="gated_works", help_text="Formulaire exigé en mode « gratuit avec formulaire »")
    free_extract_count = models.PositiveSmallIntegerField(default=2, help_text="Nombre de séries/histoires en extrait gratuit")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    release_date = models.DateField(null=True, blank=True)
    edition = models.PositiveIntegerField(default=1, help_text="Numéro d'édition du texte")
    is_featured = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    related = models.ManyToManyField("self", blank=True)
    seo_description = models.CharField(max_length=160, blank=True)
    buyers_group_link = models.URLField(blank=True, help_text="Lien d'invitation au groupe privé des acheteurs")

    class Meta:
        ordering = ["position", "title"]
        verbose_name = "œuvre"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:180]
        super().save(*args, **kwargs)

    @property
    def is_promo_active(self) -> bool:
        return bool(self.promo_price_xof is not None and (not self.promo_ends_at or self.promo_ends_at > timezone.now()))

    @property
    def current_price_xof(self) -> int:
        return self.promo_price_xof if self.is_promo_active else self.price_xof

    @property
    def unit_label(self) -> str:
        return "série" if self.kind == self.Kind.PUNCHLINES else "histoire"


class Section(TimeStampedModel):
    """Série de punchlines ou histoire. Le texte est chiffré au repos."""

    work = models.ForeignKey(Work, on_delete=models.CASCADE, related_name="sections")
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=200, blank=True)
    content_encrypted = models.TextField(blank=True, editable=False)
    word_count = models.PositiveIntegerField(default=0, editable=False)
    edition = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["work", "number"]
        unique_together = [("work", "number")]

    def __str__(self):
        return f"{self.work.title} — {self.number}. {self.title}"

    @property
    def content(self) -> str:
        return decrypt_text(self.content_encrypted)

    @content.setter
    def content(self, value: str):
        self.content_encrypted = encrypt_text(value or "")
        self.word_count = len((value or "").split())

    @property
    def is_free_extract(self) -> bool:
        return self.number <= self.work.free_extract_count


class Bundle(TimeStampedModel):
    """Offre groupée : pack T1 + T2, bundle avec Les Papos de Tiékar."""

    title = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    works = models.ManyToManyField(Work, related_name="bundles")
    price_xof = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.title

    @property
    def full_price_xof(self) -> int:
        return sum(w.current_price_xof for w in self.works.all())


class Review(TimeStampedModel):
    """Avis des lecteurs, modérés avant publication."""

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        APPROVED = "approved", "Publié"
        REJECTED = "rejected", "Refusé"

    work = models.ForeignKey(Work, on_delete=models.CASCADE, related_name="reviews")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    body = models.TextField(max_length=1500, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("work", "user")]
