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

    # Premier compte administrateur : créé sans mot de passe ; un lien « nouveau mot de passe »
    # est envoyé par e-mail (ou affiché dans le journal de build tant que l'e-mail n'est pas configuré).
    admin_email = os.environ.get("INITIAL_ADMIN_EMAIL", "").strip().lower()
    if admin_email:
        from django.utils import timezone

        from apps.accounts.models import User
        from apps.accounts.services import send_password_reset
        if not User.objects.filter(is_superuser=True).exists():
            u = User.objects.create_superuser(admin_email, None, full_name="Adjougbe", email_verified=True,
                                              terms_accepted_at=timezone.now())
            send_password_reset(u)
            print(f"Compte administrateur créé pour {admin_email} : lien de mot de passe envoyé (valable 1 h).")  # textes proposés, seulement là où rien n'a encore été écrit
else:
    print("Migrations ignorées (déploiement de prévisualisation).")
