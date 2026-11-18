"""Données de démonstration (développement et recette uniquement).

Les textes des œuvres sont des EXEMPLES : le vrai contenu est importé par l'auteur
depuis le back-office (Œuvres → Importer).
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import User
from apps.blog.models import Category, Post
from apps.catalog.models import Bundle, Section, Work
from apps.core.models import ReleaseNote, SiteSettings
from apps.forms.models import Form, FormField
from apps.shop.models import PromoCode
from apps.trainings.models import Training, TrainingSession

PUNCHLINES = [
    "Celui qui attend que la pluie s'arrête pour sortir n'ira jamais au marché.",
    "Le maquis ne ferme jamais pour celui qui a la monnaie.",
    "On ne compte pas les dents d'un ami qui rit.",
    "Le gbaka ne t'attend pas, mais la vie te rattrape toujours.",
    "Si tu cours derrière deux attiékés, tu manges le garba de quelqu'un d'autre.",
    "Le travail paie, mais c'est la patience qui fait la monnaie.",
]


def sample_series(n: int) -> str:
    lines = [f"> {PUNCHLINES[(n + i) % len(PUNCHLINES)]}" for i in range(5)]
    return ("Texte de démonstration — remplacez-le par le contenu réel depuis le back-office.\n\n"
            + "\n\n".join(lines)
            + "\n\nChaque punchline est une petite histoire. Lis-la deux fois : la première pour rire, "
              "la seconde pour comprendre.")


def sample_story(n: int) -> str:
    return ("Texte de démonstration — remplacez-le par le contenu réel depuis le back-office.\n\n"
            f"# Au quartier, épisode {n}\n\n"
            "Ce matin-là, Tiékar s'était levé avant le soleil. Le marché de Treichville bruissait déjà, "
            "les vendeuses installaient leurs bassines, et l'odeur du pain chaud se mêlait à celle du café "
            "touba. Il avait une seule idée en tête : trouver l'argent du loyer avant midi.\n\n"
            "Sur sa route, il croisa son vieil ami Bakary, qui lui proposa une affaire « sûre à cent pour cent ». "
            "Tiékar sourit. À Abidjan, tout le monde sait qu'une affaire sûre à cent pour cent cache toujours "
            "un petit pourcentage de surprise.\n\n"
            "> On ne dit pas non à un ami, on lui dit « on va voir ».\n\n"
            "Ils marchèrent ensemble jusqu'au carrefour, discutant de tout et de rien, du dernier match, "
            "des prix qui montent et des enfants qui grandissent trop vite. " * 2)


class Command(BaseCommand):
    help = "Crée des données de démonstration et un compte administrateur."

    def add_arguments(self, parser):
        parser.add_argument("--admin-email", default="admin@adjougbe.local")
        parser.add_argument("--admin-password", default="Adjougbe-Demo-2026!")
        parser.add_argument("--catalog-only", action="store_true",
                            help="Œuvres, formulaires et articles de démonstration, sans aucun compte (site en ligne).")

    def handle(self, *args, **o):
        if settings.ENVIRONMENT == "production":
            raise CommandError("Interdit en production.")
        now = timezone.now()

        admin = None
        if not o["catalog_only"]:
            admin, created = User.objects.get_or_create(email=o["admin_email"], defaults={
                "full_name": "Adjougbe", "role": User.Role.ADMIN, "is_staff": True, "is_superuser": True,
                "email_verified": True, "terms_accepted_at": now})
            if created:
                admin.set_password(o["admin_password"])
                admin.save()
            reader, created = User.objects.get_or_create(email="lecteur@adjougbe.local", defaults={
                "full_name": "Awa Koné", "city": "Abidjan", "email_verified": True, "terms_accepted_at": now,
                "phone": "+225 07 00 00 00 00"})
            if created:
                reader.set_password("Lecteur-Demo-2026!")
                reader.save()

        access_form, _ = Form.objects.get_or_create(slug="acces-papos-de-tiekar", defaults={
            "title": "Accès offert — Les Papos de Tiékar", "purpose": Form.Purpose.WORK_ACCESS,
            "description": "Quelques questions avant de lire les Papos, offerts par Adjougbe.",
            "requires_login": True})
        if not access_form.fields.exists():
            for i, (key, label, typ, req, opts) in enumerate([
                ("ville", "Ville", "text", True, []),
                ("age", "Tranche d'âge", "select", True, ["Moins de 18 ans", "18-25 ans", "26-35 ans", "36-50 ans", "Plus de 50 ans"]),
                ("interets", "Centres d'intérêt", "multi", False, ["Humour", "Société", "Formations", "Événements"]),
                ("decouverte", "Comment avez-vous connu Adjougbe ?", "select", False,
                 ["WhatsApp", "Facebook", "TikTok", "Instagram", "Bouche-à-oreille", "Autre"]),
            ]):
                FormField.objects.create(form=access_form, key=key, label=label, type=typ, required=req, options=opts,
                                         position=i)

        training_form, _ = Form.objects.get_or_create(slug="inscription-formation", defaults={
            "title": "Inscription à une formation", "purpose": Form.Purpose.TRAINING, "requires_login": True})
        if not training_form.fields.exists():
            for i, (key, label, typ, req, opts) in enumerate([
                ("motivation", "Qu'attendez-vous de cette formation ?", "textarea", True, []),
                ("niveau", "Votre niveau", "select", True, ["Débutant", "Intermédiaire", "Confirmé"]),
                ("profession", "Votre activité", "text", False, []),
            ]):
                FormField.objects.create(form=training_form, key=key, label=label, type=typ, required=req,
                                         options=opts, position=i)

        contact, _ = Form.objects.get_or_create(slug="contact", defaults={
            "title": "Contact et dédicaces", "purpose": Form.Purpose.CONTACT,
            "success_message": "Merci ! Nous vous répondons rapidement."})
        if not contact.fields.exists():
            for i, (key, label, typ, req, opts) in enumerate([
                ("nom", "Votre nom", "text", True, []), ("email", "E-mail", "email", True, []),
                ("type", "Type de demande", "select", True, ["Dédicace", "Presse", "Formation en entreprise", "Autre"]),
                ("message", "Message", "textarea", True, []),
            ]):
                FormField.objects.create(form=contact, key=key, label=label, type=typ, required=req, options=opts,
                                         position=i)

        works = [
            ("Les Punchlines — Tome 1", "120 séries de punchlines", "les-punchlines-tome-1", Work.Kind.PUNCHLINES,
             Work.AccessMode.PAID, 5000, "#2F68B7", 120, None),
            ("Les Punchlines — Tome 2", "120 nouvelles séries", "les-punchlines-tome-2", Work.Kind.PUNCHLINES,
             Work.AccessMode.PAID, 5000, "#041C5C", 120, None),
            ("Les Papos de Tiékar", "30 histoires sur la vie en Côte d'Ivoire", "les-papos-de-tiekar",
             Work.Kind.STORIES, Work.AccessMode.FREE_FORM, 0, "#FF6B29", 30, access_form),
        ]
        created_works = []
        for i, (title, sub, slug, kind, mode, price, color, n, form) in enumerate(works):
            w, created = Work.objects.get_or_create(slug=slug, defaults={
                "title": title, "subtitle": sub, "kind": kind, "access_mode": mode, "price_xof": price,
                "cover_color": color, "status": Work.Status.PUBLISHED, "position": i, "is_featured": True,
                "access_form": form, "free_extract_count": 2,
                "summary": f"{sub}. L'humour d'Adjougbe, ancré dans le quotidien ivoirien : des phrases qui claquent, "
                           "qui font rire et qui restent. (Résumé de démonstration.)",
                "seo_description": f"{title} — {sub}, à lire en ligne sur le site d'Adjougbe."})
            created_works.append(w)
            if created:
                for k in range(1, (12 if kind == Work.Kind.PUNCHLINES else 6) + 1):
                    s = Section(work=w, number=k, title=("" if kind == Work.Kind.PUNCHLINES else ["Le loyer", "Le gbaka", "Le maquis", "La dot", "Le match", "Le retour"][k - 1]))
                    s.content = sample_series(k) if kind == Work.Kind.PUNCHLINES else sample_story(k)
                    s.save()
        t1, t2, papos = created_works
        if not t1.promo_price_xof:
            t1.promo_price_xof, t1.promo_ends_at = 4000, now + timedelta(days=10)
            t1.save()
        t1.related.add(t2, papos)
        bundle, created = Bundle.objects.get_or_create(slug="pack-punchlines", defaults={
            "title": "Pack Tomes 1 + 2", "price_xof": 8000,
            "description": "Les deux tomes réunis à prix doux."})
        if created:
            bundle.works.set([t1, t2])
        PromoCode.objects.get_or_create(code="BIENVENUE10", defaults={
            "description": "10 % pour les nouveaux lecteurs", "percent_off": 10})

        cats = {slug: Category.objects.get_or_create(slug=slug, defaults={"name": name})[0]
                for slug, name in [("actualite", "Actualité"), ("coulisses", "Coulisses d'écriture"),
                                   ("culture", "Culture et société")]}
        for d, text in enumerate(PUNCHLINES):
            Post.objects.get_or_create(slug=f"punchline-demo-{d + 1}", defaults={
                "title": f"Punchline du jour #{d + 1}", "kind": Post.Kind.PUNCHLINE, "quote": text,
                "excerpt": text, "status": Post.Status.PUBLISHED, "author": admin,
                "published_at": now - timedelta(days=d)})
        Post.objects.get_or_create(slug="dans-les-coulisses-du-tome-2", defaults={
            "title": "Dans les coulisses du Tome 2", "kind": Post.Kind.ARTICLE, "category": cats["coulisses"],
            "excerpt": "Comment naît une punchline ? Réponse entre deux gbakas.",
            "body": "<p>Article de démonstration. Rédigez vos articles depuis le back-office.</p>"
                    "<blockquote>Une bonne punchline, c'est une vérité qui a pris le temps de s'habiller.</blockquote>",
            "status": Post.Status.PUBLISHED, "author": admin, "published_at": now - timedelta(days=2)})
        Post.objects.get_or_create(slug="papo-le-loyer", defaults={
            "title": "Papo : le loyer de Tiékar", "kind": Post.Kind.PAPO, "category": cats["culture"],
            "excerpt": "Tiékar a jusqu'à midi pour trouver l'argent du loyer…",
            "body": "<p>Extrait de démonstration des Papos de Tiékar.</p>", "status": Post.Status.PUBLISHED,
            "author": admin, "published_at": now - timedelta(days=4), "members_only": True})

        tr, created = Training.objects.get_or_create(slug="ecrire-des-punchlines-qui-claquent", defaults={
            "title": "Écrire des punchlines qui claquent", "theme": "Écriture", "format": Training.Format.ONLINE,
            "summary": "Un atelier pratique pour apprendre à écrire court, drôle et juste.",
            "objectives": ["Trouver l'idée", "Couper le superflu", "Tester sur un public"],
            "audience": "Créateurs de contenu, communicants, curieux de l'écriture.",
            "program": [{"title": "Module 1 — L'observation", "detail": "Repérer les situations du quotidien."},
                        {"title": "Module 2 — La formule", "detail": "Rythme, chute, image."},
                        {"title": "Module 3 — L'atelier", "detail": "Écriture et retours en direct."}],
            "duration_label": "3 heures", "price_xof": 15000, "registration_form": training_form,
            "is_published": True,
            "faq": [{"q": "Faut-il de l'expérience ?", "a": "Non, l'atelier est ouvert à tous."}]})
        if created:
            TrainingSession.objects.create(training=tr, starts_at=now + timedelta(days=12, hours=2),
                                           ends_at=now + timedelta(days=12, hours=5), capacity=25,
                                           meeting_link="https://meet.google.com/demo-demo-demo")
        tr2, created = Training.objects.get_or_create(slug="atelier-lecture-publique", defaults={
            "title": "Atelier lecture publique", "theme": "Oralité", "format": Training.Format.ONSITE,
            "summary": "Lire à voix haute devant un public : souffle, rythme, présence.",
            "duration_label": "2 heures", "price_xof": 0, "registration_form": training_form, "is_published": True})
        if created:
            TrainingSession.objects.create(training=tr2, starts_at=now + timedelta(days=20),
                                           ends_at=now + timedelta(days=20, hours=2), capacity=15,
                                           location="Institut français, Plateau, Abidjan")

        st = SiteSettings.load()
        if not st.terms_html:
            st.terms_html = "<h2>Conditions générales d'utilisation</h2><p>À rédiger avec l'auteur.</p>"
            st.privacy_html = ("<h2>Politique de confidentialité</h2><p>À rédiger avec l'auteur (ARTCI, RGPD). "
                               "Vous pouvez exporter ou supprimer vos données depuis votre compte.</p>")
            st.legal_html = "<h2>Mentions légales</h2><p>À compléter.</p>"
            st.about_html = ("<h2>À propos d'Adjougbe</h2><p>Biographie à compléter. Écrivain ivoirien, "
                             "auteur des Punchlines et des Papos de Tiékar.</p>")
            st.whatsapp_number = "2250700000000"
            st.save()
        ReleaseNote.objects.get_or_create(version="1.0.0", defaults={
            "released_at": now.date(), "content": "Première version : vendre et lire.", "delivered_by": "All'Digit"})
        if o["catalog_only"]:
            self.stdout.write(self.style.SUCCESS("Catalogue de démonstration prêt (aucun compte créé)."))
            return
        self.stdout.write(self.style.SUCCESS(
            f"Démo prête. Admin : {o['admin_email']} / {o['admin_password']} — "
            "Lecteur : lecteur@adjougbe.local / Lecteur-Demo-2026!"))
