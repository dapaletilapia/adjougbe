"""Étape de build Vercel (service backend) : applique les migrations sur la base Neon.

En production uniquement, sauf MIGRATE_ON_BUILD=1 (par exemple si les prévisualisations
ont leur propre branche de base Neon). Le collectstatic est lancé par Vercel lui-même.
"""
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from django.core.management import call_command  # noqa: E402

if os.environ.get("VERCEL_ENV") == "production" or os.environ.get("MIGRATE_ON_BUILD") == "1":
    if not os.environ.get("DATABASE_URL"):
        sys.exit("DATABASE_URL manquante : connecter la base Neon au projet Vercel avant de déployer.")
    call_command("migrate", interactive=False)
    from apps.catalog.models import Work
    if not Work.objects.exists() and os.environ.get("ENVIRONMENT") != "production":
        call_command("seed_demo", catalog_only=True)  # recette : œuvres de démonstration, aucun compte
    call_command("load_content")

    # Premier compte administrateur. Aucun secret n'est jamais écrit dans le journal du build :
    # - e-mail configuré (SMTP) : compte sans mot de passe + lien « nouveau mot de passe » envoyé par e-mail ;
    # - sinon : mot de passe fourni par la variable temporaire DJANGO_SUPERUSER_PASSWORD (à supprimer ensuite).
    admin_email = os.environ.get("INITIAL_ADMIN_EMAIL", "").strip().lower()
    if admin_email:
        from django.conf import settings
        from django.utils import timezone

        from apps.accounts.models import User
        from apps.accounts.services import send_password_reset
        if User.objects.filter(is_superuser=True).exists():
            print("Compte administrateur déjà présent : rien à créer.")
        else:
            real_email = settings.EMAIL_BACKEND.endswith("smtp.EmailBackend")
            password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
            if not real_email and not password:
                print("Compte administrateur NON créé : configurer l'envoi d'e-mails (SMTP) "
                      "ou définir DJANGO_SUPERUSER_PASSWORD, puis redéployer.")
            else:
                u = User.objects.create_superuser(admin_email, password or None, full_name="Adjougbe",
                                                  terms_accepted_at=timezone.now())
                if password:
                    print("Compte administrateur créé avec le mot de passe fourni. "
                          "Supprimer DJANGO_SUPERUSER_PASSWORD des variables Vercel.")
                else:
                    send_password_reset(u)
                    print("Compte administrateur créé : lien pour choisir le mot de passe envoyé par e-mail.")
