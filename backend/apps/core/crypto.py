"""Chiffrement au repos du contenu protégé (Fernet / AES-128-CBC + HMAC)."""
import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    key = settings.CONTENT_ENCRYPTION_KEY
    if not key:
        if not settings.DEBUG:
            raise RuntimeError("CONTENT_ENCRYPTION_KEY est obligatoire hors développement.")
        # Clé dérivée de SECRET_KEY, uniquement en développement.
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def encrypt_text(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_text(token: str) -> str:
    if not token:
        return ""
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
