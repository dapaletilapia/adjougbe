import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


def new_token() -> str:
    return secrets.token_urlsafe(24)


class Subscriber(models.Model):
    email = models.EmailField(unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    source = models.CharField(max_length=60, blank=True)
    preferences = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    consent_at = models.DateTimeField(default=timezone.now)
    unsubscribe_token = models.CharField(max_length=40, unique=True, default=new_token)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    @classmethod
    def subscribe(cls, email, source="", user=None, preferences=None):
        sub, created = cls.objects.get_or_create(email=email.lower(), defaults={
            "source": source, "user": user, "preferences": preferences or []})
        if not created and not sub.is_active:
            sub.is_active = True
            sub.consent_at = timezone.now()
            sub.save(update_fields=["is_active", "consent_at"])
        return sub


class Campaign(models.Model):
    class Segment(models.TextChoices):
        ALL = "all", "Tous les abonnés"
        BUYERS = "buyers", "Acheteurs"
        LEARNERS = "learners", "Inscrits aux formations"
        FREE_FORMS = "free_forms", "Contacts des formulaires gratuits"
        INACTIVE = "inactive", "Lecteurs inactifs depuis 60 jours"

    subject = models.CharField(max_length=200)
    body = models.TextField()
    segment = models.CharField(max_length=20, choices=Segment.choices, default=Segment.ALL)
    sent_at = models.DateTimeField(null=True, blank=True)
    recipients_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.subject
