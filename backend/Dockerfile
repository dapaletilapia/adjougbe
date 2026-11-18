# --- API Django (Gunicorn) ---------------------------------------------------
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Utilisateur sans privilèges ; volumes pour les médias publics et le stockage privé des livres.
RUN useradd --create-home --uid 1000 adjougbe \
 && mkdir -p /data/media /data/private /app/staticfiles \
 && chmod +x /app/docker-entrypoint.sh \
 && chown -R adjougbe:adjougbe /data /app
USER adjougbe

ENV MEDIA_ROOT=/data/media \
    PRIVATE_STORAGE_ROOT=/data/private

# collectstatic n'a besoin d'aucun secret réel.
RUN SECRET_KEY=build DEBUG=0 CONTENT_ENCRYPTION_KEY=build python manage.py collectstatic --noinput

EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60", "--access-logfile", "-"]
