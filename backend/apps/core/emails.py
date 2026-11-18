"""E-mails transactionnels. Aucun lien de téléchargement : on renvoie vers la bibliothèque."""
from django.conf import settings
from django.core.mail import send_mail


def send(to: str, subject: str, body: str):
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [to], fail_silently=False)


def front(path: str) -> str:
    return settings.FRONTEND_URL.rstrip("/") + path
