from django.conf import settings
from django.db import models


class ReadingProgress(models.Model):
    """Reprise de lecture à la dernière page."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progress")
    work = models.ForeignKey("catalog.Work", on_delete=models.CASCADE)
    section = models.ForeignKey("catalog.Section", on_delete=models.CASCADE)
    page = models.PositiveIntegerField(default=0)
    sections_read = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "work")]


class Bookmark(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks")
    section = models.ForeignKey("catalog.Section", on_delete=models.CASCADE)
    page = models.PositiveIntegerField(default=0)
    note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ReadingLog(models.Model):
    """Journal d'accès : pages consultées, horodatage, appareil (détection des abus)."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reading_logs")
    work = models.ForeignKey("catalog.Work", on_delete=models.CASCADE)
    section = models.ForeignKey("catalog.Section", on_delete=models.CASCADE)
    page = models.PositiveIntegerField()
    device = models.CharField(max_length=120, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]


class AbuseAlert(models.Model):
    class Kind(models.TextChoices):
        MASS_READING = "mass_reading", "Consultation massive de pages"
        MULTI_DEVICE = "multi_device", "Connexions simultanées anormales"
        SUSPICIOUS_PURCHASE = "suspicious_purchase", "Achats multiples suspects"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alerts")
    kind = models.CharField(max_length=30, choices=Kind.choices)
    detail = models.CharField(max_length=255)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
