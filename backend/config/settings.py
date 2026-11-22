"""Configuration Django de la plateforme Adjougbe.

Toutes les valeurs sensibles viennent de variables d'environnement (fichier .env en local).
Trois environnements : development, staging (recette), production.
"""
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ENVIRONMENT=(str, "development"),
)
environ.Env.read_env(BASE_DIR / ".env")

# Sur Vercel, la plateforme fournit VERCEL=1, VERCEL_ENV et les noms de domaine du déploiement.
ON_VERCEL = bool(env("VERCEL", default=""))
VERCEL_HOSTS = [h for h in (env("VERCEL_URL", default=""), env("VERCEL_BRANCH_URL", default=""),
                            env("VERCEL_PROJECT_PRODUCTION_URL", default="")) if h]

ENVIRONMENT = env("ENVIRONMENT")
DEBUG = env("DEBUG")
SECRET_KEY = env("SECRET_KEY", default="dev-insecure-change-me" if DEBUG else environ.Env.NOTSET)
# Sur Vercel, une requête n'atteint ce code que si elle vise un domaine du projet (adresses de déploiement,
# alias *.vercel.app, domaine personnalisé déclaré dans ALLOWED_HOSTS) : le suffixe .vercel.app est sûr ici.
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"]) + VERCEL_HOSTS + (
    [".vercel.app"] if ON_VERCEL else [])

# Clé de chiffrement au repos du contenu des livres (Fernet, 32 octets base64).
CONTENT_ENCRYPTION_KEY = env("CONTENT_ENCRYPTION_KEY", default="")

FRONTEND_URL = env("FRONTEND_URL", default=(
    f"https://{env('VERCEL_PROJECT_PRODUCTION_URL')}" if env("VERCEL_PROJECT_PRODUCTION_URL", default="")
    else "http://localhost:5173"))

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "django_filters",
    "apps.core",
    "apps.accounts",
    "apps.catalog",
    "apps.shop",
    "apps.reader",
    "apps.blog",
    "apps.trainings",
    "apps.forms",
    "apps.newsletter",
    "apps.analytics",
    "apps.backoffice",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "apps.core.seo.SharePreviewMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.DeviceSessionMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# PostgreSQL en recette/production via DATABASE_URL ; SQLite par défaut en développement.
DATABASES = {"default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}")}
if ON_VERCEL:
    DATABASES["default"]["CONN_MAX_AGE"] = 0  # fonctions éphémères : pas de connexion persistante (Neon pool)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr"
LANGUAGES = [("fr", "Français"), ("en", "English")]
TIME_ZONE = "Africa/Abidjan"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Fichiers : disque (Docker) ou base de données (Vercel, sans disque persistant).
FILE_STORAGE = env("FILE_STORAGE", default="database" if ON_VERCEL else "filesystem")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "private": {"BACKEND": "django.core.files.storage.FileSystemStorage",
                "OPTIONS": {"location": env("PRIVATE_STORAGE_ROOT", default=str(BASE_DIR / "private"))}},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
if FILE_STORAGE == "database":
    STORAGES["default"] = {"BACKEND": "apps.core.storage.DatabaseStorage"}
    STORAGES["private"] = {"BACKEND": "apps.core.storage.DatabaseStorage", "OPTIONS": {"private": True}}
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))
# Stockage privé : jamais servi par une URL publique (contenu des livres, pièces jointes de formulaires).
PRIVATE_STORAGE_ROOT = Path(env("PRIVATE_STORAGE_ROOT", default=str(BASE_DIR / "private")))

# --- Sessions et sécurité ---------------------------------------------------
SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=60 * 60 * 24 * 14)
SESSION_INACTIVITY_TIMEOUT = env.int("SESSION_INACTIVITY_TIMEOUT", default=60 * 60 * 2)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=["http://localhost:5173", "http://127.0.0.1:5173"]) + [
    f"https://{h}" for h in VERCEL_HOSTS]
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173", "http://127.0.0.1:5173"])
CORS_ALLOW_CREDENTIALS = True

MAX_DEVICES_PER_ACCOUNT = env.int("MAX_DEVICES_PER_ACCOUNT", default=2)
LOGIN_MAX_ATTEMPTS = env.int("LOGIN_MAX_ATTEMPTS", default=5)
LOGIN_LOCKOUT_MINUTES = env.int("LOGIN_LOCKOUT_MINUTES", default=15)
READER_URL_TTL_SECONDS = env.int("READER_URL_TTL_SECONDS", default=120)
READER_MAX_PAGES_PER_HOUR = env.int("READER_MAX_PAGES_PER_HOUR", default=400)

if not DEBUG:
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = env.bool("SECURE_COOKIES", default=True)
    CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

# --- API ---------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle", "rest_framework.throttling.UserRateThrottle"],
    # Limites larges pour l'IP partagée des opérateurs mobiles (NAT) ; connexion et inscription restent strictes.
    "DEFAULT_THROTTLE_RATES": {"anon": "600/min", "user": "1200/min", "auth": "10/min", "reader": "120/min"},
}

# --- E-mails -----------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Adjougbe <bonjour@adjougbe.ci>")
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", default="")

# --- Paiement ----------------------------------------------------------------
# "simulated" en développement ; "cinetpay" en recette (mode test) et production.
PAYMENT_PROVIDER = env("PAYMENT_PROVIDER", default="simulated")
if ENVIRONMENT == "production" and PAYMENT_PROVIDER == "simulated":
    # Le paiement simulé donne les livres gratuitement : interdit sur le site public.
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured("PAYMENT_PROVIDER=simulated est interdit en production (utiliser cinetpay).")
CINETPAY_API_KEY = env("CINETPAY_API_KEY", default="")
CINETPAY_SITE_ID = env("CINETPAY_SITE_ID", default="")
CINETPAY_SECRET_KEY = env("CINETPAY_SECRET_KEY", default="")
BACKEND_PUBLIC_URL = env("BACKEND_PUBLIC_URL", default=FRONTEND_URL if ON_VERCEL else "http://localhost:8000")
CRON_SECRET = env("CRON_SECRET", default="")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {"django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False}},
}

PASSWORD_RESET_TIMEOUT = 60 * 60  # lien « mot de passe oublié » valable 1 h
