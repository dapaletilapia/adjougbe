from django.conf import settings
from django.db import models
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


class Form(TimeStampedModel):
    """Formulaire créé par l'administrateur, sans développeur."""

    class Purpose(models.TextChoices):
        WORK_ACCESS = "work_access", "Accès à un ouvrage gratuit"
        TRAINING = "training", "Inscription à une formation"
        NEWSLETTER = "newsletter", "Newsletter"
        CONTACT = "contact", "Contact et dédicaces"
        SURVEY = "survey", "Sondage lecteurs"
        OTHER = "other", "Autre"

    title = models.CharField(max_length=160)
    slug = models.SlugField(unique=True, max_length=180)
    purpose = models.CharField(max_length=20, choices=Purpose.choices, default=Purpose.OTHER)
    description = models.TextField(blank=True)
    consent_text = models.CharField(
        max_length=400,
        default="J'accepte que mes réponses soient utilisées par Adjougbe pour me proposer du contenu adapté.",
    )
    newsletter_optin = models.BooleanField(default=True, help_text="Proposer l'inscription à la newsletter")
    success_message = models.CharField(max_length=255, default="Merci ! Vos réponses ont bien été enregistrées.")
    requires_login = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:180]
        super().save(*args, **kwargs)


class FormField(models.Model):
    class Type(models.TextChoices):
        TEXT = "text", "Texte court"
        TEXTAREA = "textarea", "Texte long"
        EMAIL = "email", "E-mail"
        PHONE = "phone", "Téléphone"
        SELECT = "select", "Liste déroulante"
        MULTI = "multi", "Choix multiple"
        CHECKBOX = "checkbox", "Case à cocher"
        DATE = "date", "Date"
        NUMBER = "number", "Nombre"
        FILE = "file", "Fichier"
        RATING = "rating", "Note (1 à 5)"

    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="fields")
    key = models.SlugField(max_length=60)
    label = models.CharField(max_length=200)
    type = models.CharField(max_length=12, choices=Type.choices, default=Type.TEXT)
    required = models.BooleanField(default=False)
    options = models.JSONField(default=list, blank=True)
    help_text = models.CharField(max_length=255, blank=True)
    placeholder = models.CharField(max_length=120, blank=True)
    # Logique conditionnelle simple : {"field": "<clé>", "equals": "<valeur>"}
    condition = models.JSONField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        unique_together = [("form", "key")]

    def __str__(self):
        return f"{self.form.title} / {self.label}"


class FormResponse(models.Model):
    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="responses")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                             related_name="form_responses")
    data = models.JSONField(default=dict)
    consent = models.BooleanField(default=False)
    newsletter = models.BooleanField(default=False)
    context = models.CharField(max_length=120, blank=True, help_text="Œuvre, formation ou page d'origine")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
