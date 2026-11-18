from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditLog(models.Model):
    """Journal de toutes les actions administratives (section 10 et 20)."""

    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=80)
    target_type = models.CharField(max_length=80, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    summary = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.target_type}#{self.target_id}"


class SiteSettings(models.Model):
    """Réglages éditables depuis le back-office (singleton)."""

    site_name = models.CharField(max_length=120, default="Adjougbe")
    tagline = models.CharField(max_length=200, default="Possumus")
    whatsapp_number = models.CharField(max_length=30, blank=True)
    contact_email = models.EmailField(blank=True)
    eur_rate = models.DecimalField(max_digits=10, decimal_places=3, default=655.957, help_text="FCFA pour 1 €")
    enabled_payment_methods = models.JSONField(default=list, blank=True)
    max_devices_per_account = models.PositiveSmallIntegerField(default=2)
    reader_alert_threshold = models.PositiveIntegerField(default=150, help_text="Pages par heure avant alerte et suspension")
    maintenance_mode = models.BooleanField(default=False)
    maintenance_message = models.CharField(max_length=255, blank=True)
    terms_html = models.TextField(blank=True)
    privacy_html = models.TextField(blank=True)
    legal_html = models.TextField(blank=True)
    about_html = models.TextField(blank=True)
    social_links = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Paramètres du site"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1, defaults={
            "enabled_payment_methods": ["orange_money", "mtn_momo", "moov_money", "wave", "card"],
        })
        return obj


class Banner(TimeStampedModel):
    """Bannières programmables de l'accueil (module Pages et bannières)."""

    title = models.CharField(max_length=160)
    subtitle = models.CharField(max_length=255, blank=True)
    image = models.ImageField(upload_to="banners/", blank=True)
    link_url = models.CharField(max_length=255, blank=True)
    link_label = models.CharField(max_length=60, blank=True)
    placement = models.CharField(max_length=30, default="home_hero")
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "-created_at"]

    def __str__(self):
        return self.title


class ReleaseNote(models.Model):
    """Journal des versions visible dans le back-office (section 23)."""

    version = models.CharField(max_length=20)
    released_at = models.DateField()
    content = models.TextField()
    delivered_by = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-released_at"]

    def __str__(self):
        return self.version


class StoredFile(models.Model):
    """Fichier conservé en base (hébergement sans disque persistant, ex. Vercel).

    Les fichiers publics (couvertures, images du blog) sont servis par /media/ ;
    les fichiers privés (pièces jointes des formulaires) ne le sont jamais.
    """

    name = models.CharField(max_length=255, unique=True)
    content = models.BinaryField()
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(default=0)
    is_private = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
