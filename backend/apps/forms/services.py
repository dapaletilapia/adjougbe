import re
import uuid
from datetime import date
from pathlib import Path

from django.conf import settings
from rest_framework.exceptions import ValidationError

from apps.core.audit import client_ip

from .models import Form, FormField, FormResponse

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^\+?[0-9 ().-]{8,20}$")
ALLOWED_UPLOADS = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"}
MAX_UPLOAD = 5 * 1024 * 1024


def _visible(field: FormField, data: dict) -> bool:
    cond = field.condition
    if not cond or not cond.get("field"):
        return True
    value = data.get(cond["field"])
    expected = cond.get("equals")
    return expected in value if isinstance(value, list) else str(value) == str(expected)


def clean_submission(form: Form, data: dict, files=None) -> dict:
    errors, cleaned = {}, {}
    for f in form.fields.all():
        if not _visible(f, data):
            continue
        raw = data.get(f.key)
        empty = raw in (None, "", [], False)
        if f.type == FormField.Type.FILE:
            upload = files.get(f.key) if files else None
            if not upload:
                if f.required:
                    errors[f.key] = "Fichier requis."
                continue
            ext = Path(upload.name).suffix.lower()
            if ext not in ALLOWED_UPLOADS or upload.size > MAX_UPLOAD:
                errors[f.key] = "Fichier refusé (PDF, image ou Word, 5 Mo maximum)."
                continue
            dest_dir = settings.PRIVATE_STORAGE_ROOT / "forms" / form.slug
            dest_dir.mkdir(parents=True, exist_ok=True)
            name = f"{uuid.uuid4().hex}{ext}"
            with open(dest_dir / name, "wb") as out:
                for chunk in upload.chunks():
                    out.write(chunk)
            cleaned[f.key] = {"file": f"forms/{form.slug}/{name}", "name": upload.name[:120]}
            continue
        if empty:
            if f.required:
                errors[f.key] = "Ce champ est obligatoire."
            continue
        try:
            if f.type == FormField.Type.EMAIL:
                if not EMAIL_RE.match(str(raw)):
                    raise ValueError("Adresse e-mail invalide.")
                raw = str(raw).lower()
            elif f.type == FormField.Type.PHONE:
                if not PHONE_RE.match(str(raw)):
                    raise ValueError("Numéro de téléphone invalide.")
            elif f.type == FormField.Type.NUMBER:
                raw = float(raw)
            elif f.type == FormField.Type.RATING:
                raw = int(raw)
                if not 1 <= raw <= 5:
                    raise ValueError("Note entre 1 et 5.")
            elif f.type == FormField.Type.DATE:
                raw = date.fromisoformat(str(raw)).isoformat()
            elif f.type == FormField.Type.SELECT:
                if raw not in f.options:
                    raise ValueError("Choix invalide.")
            elif f.type == FormField.Type.MULTI:
                raw = [v for v in (raw if isinstance(raw, list) else [raw]) if v in f.options]
                if f.required and not raw:
                    raise ValueError("Choisissez au moins une option.")
            elif f.type == FormField.Type.CHECKBOX:
                raw = bool(raw)
            else:
                raw = str(raw)[:5000]
        except (ValueError, TypeError) as exc:
            errors[f.key] = str(exc) if str(exc) and not str(exc).startswith(("could not", "invalid")) else "Valeur invalide."
            continue
        cleaned[f.key] = raw
    if errors:
        raise ValidationError({"fields": errors})
    return cleaned


def submit(form: Form, request, data: dict, files=None, context: str = "") -> FormResponse:
    if not form.is_active:
        raise ValidationError({"detail": "Ce formulaire est fermé."})
    # Anti-robot : champ piège invisible pour les humains, rempli par les robots.
    if str(data.get("_website", "")).strip():
        raise ValidationError({"detail": "Envoi refusé."})
    user = request.user if request.user.is_authenticated else None
    if form.requires_login and not user:
        raise ValidationError({"detail": "Connectez-vous pour répondre."})
    consent = str(data.get("_consent", "")).lower() in ("true", "1", "on")
    if not consent:
        raise ValidationError({"_consent": "Votre consentement est nécessaire."})
    cleaned = clean_submission(form, data, files)
    newsletter = str(data.get("_newsletter", "")).lower() in ("true", "1", "on")
    resp = FormResponse.objects.create(form=form, user=user, data=cleaned, consent=consent, newsletter=newsletter,
                                       context=context[:120], ip_address=client_ip(request))
    if newsletter:
        from apps.newsletter.models import Subscriber
        email = (user.email if user else None) or next(
            (v for k, v in cleaned.items() if isinstance(v, str) and EMAIL_RE.match(v)), None)
        if email:
            Subscriber.subscribe(email, source=f"formulaire:{form.slug}", user=user)
    return resp
