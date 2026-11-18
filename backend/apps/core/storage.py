"""Stockage de fichiers en base de données, pour un hébergement sans disque persistant (Vercel)."""
import mimetypes
import posixpath
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class DatabaseStorage(Storage):
    def __init__(self, private: bool = False):
        self.private = private

    def _model(self):
        from apps.core.models import StoredFile
        return StoredFile

    def _open(self, name, mode="rb"):
        obj = self._model().objects.filter(name=name).first()
        if obj is None:
            raise FileNotFoundError(name)
        f = ContentFile(bytes(obj.content), name=name)
        return f

    def _save(self, name, content):
        content.seek(0) if hasattr(content, "seek") else None
        data = content.read()
        if isinstance(data, str):
            data = data.encode()
        ctype = getattr(content, "content_type", None) or mimetypes.guess_type(name)[0] or "application/octet-stream"
        self._model().objects.create(name=name, content=data, size=len(data), content_type=ctype,
                                     is_private=self.private)
        return name

    def get_available_name(self, name, max_length=None):
        if self.exists(name):
            root, ext = posixpath.splitext(name)
            name = f"{root}_{uuid.uuid4().hex[:7]}{ext}"
        return name

    def exists(self, name):
        return self._model().objects.filter(name=name).exists()

    def delete(self, name):
        self._model().objects.filter(name=name).delete()

    def size(self, name):
        obj = self._model().objects.filter(name=name).only("size").first()
        return obj.size if obj else 0

    def url(self, name):
        if self.private:
            raise ValueError("Fichier privé : pas d'URL publique.")
        return settings.MEDIA_URL + name
