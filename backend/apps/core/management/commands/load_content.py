"""Charge les textes proposés (apps/core/content_fr.py) et peut les exporter pour relecture.

    python manage.py load_content            # remplit les zones encore vides ou de démonstration
    python manage.py load_content --force    # remplace aussi les textes déjà modifiés
    python manage.py load_content --export docs/contenus-proposes.md
"""
import re
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.blog.models import Category, Post
from apps.catalog.models import Work
from apps.core import content_fr as C
from apps.core.models import SiteSettings
from apps.trainings.models import Training

DEMO_MARKERS = ("à rédiger", "à compléter", "démonstration", "biographie à compléter")


def is_placeholder(text: str) -> bool:
    t = (text or "").lower()
    return not t.strip() or any(m in t for m in DEMO_MARKERS)


def to_md(html: str) -> str:
    s = re.sub(r"<h2>(.*?)</h2>", r"\n## \1\n", html)
    s = re.sub(r"<h3>(.*?)</h3>", r"\n### \1\n", s)
    s = re.sub(r"<blockquote>(.*?)</blockquote>", r"\n> \1\n", s, flags=re.S)
    s = re.sub(r"<li>(.*?)</li>", r"- \1", s, flags=re.S)
    s = re.sub(r"<(strong)>(.*?)</\1>", r"**\2**", s)
    s = re.sub(r"<(em)>(.*?)</\1>", r"*\2*", s)
    s = re.sub(r'<a href="([^"]+)">(.*?)</a>', r"\2", s)
    s = re.sub(r"<br\s*/?>", "  \n", s)
    s = re.sub(r"</?(p|ul)>", "\n", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


class Command(BaseCommand):
    help = "Charge les textes proposés pour le site (bio, œuvres, formations, blog, pages légales)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true")
        parser.add_argument("--export", default="")

    def handle(self, *args, **o):
        if o["export"]:
            return self.export(Path(o["export"]))
        force = o["force"]
        done = []
        st = SiteSettings.load()
        for field, html in [("about_html", C.ABOUT_HTML), ("terms_html", C.TERMS_HTML), ("privacy_html", C.PRIVACY_HTML), ("legal_html", C.LEGAL_HTML)]:
            if force or is_placeholder(getattr(st, field)):
                setattr(st, field, html.strip())
                done.append(field)
        st.save()
        for slug, data in C.WORKS.items():
            w = Work.objects.filter(slug=slug).first()
            if w and (force or is_placeholder(w.summary)):
                for k, v in data.items():
                    setattr(w, k, v)
                w.save()
                done.append(f"œuvre {slug}")
        for slug, data in C.TRAININGS.items():
            t = Training.objects.filter(slug=slug).first()
            if t and (force or len(t.summary) < 120 or not t.faq or len(t.objectives) < 4):
                for k, v in data.items():
                    setattr(t, k, v)
                t.save()
                done.append(f"formation {slug}")
        now = timezone.now()
        for i, p in enumerate(C.POSTS):
            cat = Category.objects.filter(slug=p["category"]).first()
            post = Post.objects.filter(slug=p["slug"]).first()
            if post and not force and not is_placeholder(post.body):
                continue
            post = post or Post(slug=p["slug"], published_at=now - timedelta(days=2 + i * 3))
            post.title, post.excerpt, post.body, post.category = p["title"], p["excerpt"], p["body"], cat
            post.kind, post.status = Post.Kind.ARTICLE, Post.Status.PUBLISHED
            post.save()
            done.append(f"article {p['slug']}")
        existing = set(Post.objects.filter(kind=Post.Kind.PUNCHLINE).values_list("quote", flat=True))
        for d, q in enumerate(C.PUNCHLINES):
            if q not in existing:
                Post.objects.create(title=f"Punchline du {(now - timedelta(days=d)):%d/%m/%Y}", kind=Post.Kind.PUNCHLINE,
                                    quote=q, excerpt=q, status=Post.Status.PUBLISHED, published_at=now - timedelta(days=d, hours=1))
                done.append("punchline")
        self.stdout.write(self.style.SUCCESS(f"{len(done)} élément(s) mis à jour : {', '.join(sorted(set(done)))}"))

    def export(self, path: Path):
        parts = ["# Textes proposés pour le site Adjougbe",
                 "Version provisoire à relire et corriger par Adjougbe. Les passages entre crochets sont à compléter. "
                 "Les textes juridiques doivent être validés par un juriste avant la mise en ligne.",
                 "\n---\n# 1. Page « À propos »", to_md(C.ABOUT_HTML),
                 "\n---\n# 2. Les œuvres"]
        for slug, w in C.WORKS.items():
            parts += [f"\n## {slug.replace('-', ' ').title()}", f"**Sous-titre** : {w['subtitle']}", f"\n{w['summary']}",
                      f"\n*Description Google* : {w['seo_description']}"]
        parts.append("\n---\n# 3. Les formations")
        for slug, t in C.TRAININGS.items():
            parts += [f"\n## {slug.replace('-', ' ').capitalize()}", t["summary"], "\n**Objectifs**",
                      *[f"- {x}" for x in t["objectives"]], f"\n**Pour qui** : {t['audience']}", "\n**Programme**",
                      *[f"- **{m['title']}** : {m['detail']}" for m in t["program"]], "\n**Questions fréquentes**",
                      *[f"- **{f['q']}** {f['a']}" for f in t["faq"]]]
        parts.append("\n---\n# 4. Articles du blog")
        for p in C.POSTS:
            parts += [f"\n## {p['title']}", f"*{p['excerpt']}*", to_md(p["body"])]
        parts += ["\n---\n# 5. Punchlines du jour (exemples à remplacer par de vraies punchlines)", *[f"- {q}" for q in C.PUNCHLINES]]
        parts += ["\n---\n# 6. Conditions générales", to_md(C.TERMS_HTML), "\n---\n# 7. Politique de confidentialité",
                  to_md(C.PRIVACY_HTML), "\n---\n# 8. Mentions légales", to_md(C.LEGAL_HTML)]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(parts) + "\n", encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Export : {path}"))
