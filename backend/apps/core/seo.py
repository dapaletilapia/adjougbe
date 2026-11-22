"""Référencement et aperçus de partage.

Le site est une application React : les robots des réseaux (WhatsApp, Facebook, X…) ne lisent pas le JavaScript.
Nginx leur sert donc ces pages HTML minimales, avec les balises Open Graph de chaque œuvre, article ou formation.
"""
import re
from html import escape

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone

from apps.blog.models import Post
from apps.catalog.models import Work
from apps.trainings.models import Training


def _abs(path: str) -> str:
    return settings.FRONTEND_URL.rstrip("/") + path


def _page(title: str, description: str, path: str, image: str = "", kind: str = "website", jsonld: str = "") -> HttpResponse:
    image = image or _abs("/icon-512.png")
    t, d = escape(title), escape(description[:300])
    html = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>{t}</title><meta name="description" content="{d}">
<link rel="canonical" href="{_abs(path)}">
<meta property="og:type" content="{kind}"><meta property="og:site_name" content="Adjougbe">
<meta property="og:title" content="{t}"><meta property="og:description" content="{d}">
<meta property="og:url" content="{_abs(path)}"><meta property="og:image" content="{escape(image)}">
<meta property="og:locale" content="fr_FR"><meta name="twitter:card" content="summary_large_image">
{jsonld}</head><body><h1>{t}</h1><p>{d}</p><a href="{_abs(path)}">{_abs(path)}</a></body></html>"""
    return HttpResponse(html)


def share_preview(request, path=""):
    """Page d'aperçu pour un chemin du site (appelée par Nginx pour les robots)."""
    parts = [p for p in path.strip("/").split("/") if p]
    if len(parts) == 2 and parts[0] == "livres":
        w = Work.objects.filter(slug=parts[1], status__in=["published", "preorder"]).first()
        if w:
            img = request.build_absolute_uri(w.cover.url) if w.cover else ""
            price = f"{w.current_price_xof} XOF" if w.access_mode == "paid" else "Gratuit"
            ld = ('<script type="application/ld+json">{"@context":"https://schema.org","@type":"Book",'
                  f'"name":{escape_json(w.title)},"author":{{"@type":"Person","name":"Adjougbe"}},'
                  f'"bookFormat":"EBook","inLanguage":"fr","description":{escape_json(w.summary)},'
                  f'"offers":{{"@type":"Offer","price":"{w.current_price_xof}","priceCurrency":"XOF"}}}}</script>')
            return _page(f"{w.title} — Adjougbe", w.seo_description or f"{w.subtitle}. {price}. {w.summary}", f"/livres/{w.slug}", img, "book", ld)
    if len(parts) == 2 and parts[0] == "blog":
        p = Post.objects.published().filter(slug=parts[1]).first()
        if p:
            if p.kind == Post.Kind.PUNCHLINE:
                img = _abs(f"/api/blog/posts/{p.slug}/card.png")
                return _page("Punchline du jour — Adjougbe", f"« {p.quote} »", f"/blog/{p.slug}", img, "article")
            img = request.build_absolute_uri(p.cover.url) if p.cover else ""
            return _page(f"{p.title} — Adjougbe", p.seo_description or p.excerpt, f"/blog/{p.slug}", img, "article")
    if len(parts) == 2 and parts[0] == "formations":
        t = Training.objects.filter(slug=parts[1], is_published=True).first()
        if t:
            img = request.build_absolute_uri(t.cover.url) if t.cover else ""
            return _page(f"{t.title} — Formation Adjougbe", t.summary, f"/formations/{t.slug}", img)
    titles = {"boutique": "Les livres d'Adjougbe", "blog": "Le blog d'Adjougbe", "formations": "Formations d'Adjougbe", "a-propos": "À propos d'Adjougbe"}
    key = parts[0] if parts else ""
    return _page(titles.get(key, "Adjougbe — Livres, formations et punchlines"),
                 "Des punchlines pour se relever, des formations pour grandir. Lisez en ligne et payez en Mobile Money.", "/" + "/".join(parts))


def escape_json(s: str) -> str:
    import json
    return json.dumps(s or "", ensure_ascii=False).replace("</", "<\\/")


def sitemap(request):
    now = timezone.now()
    urls = [("/", "daily"), ("/boutique", "weekly"), ("/blog", "daily"), ("/formations", "weekly"), ("/a-propos", "monthly"),
            ("/cgu", "yearly"), ("/confidentialite", "yearly"), ("/mentions-legales", "yearly")]
    urls += [(f"/livres/{w.slug}", "weekly") for w in Work.objects.filter(status__in=["published", "preorder"])]
    urls += [(f"/blog/{p.slug}", "monthly") for p in Post.objects.published().filter(members_only=False)[:2000]]
    urls += [(f"/formations/{t.slug}", "weekly") for t in Training.objects.filter(is_published=True)]
    body = "".join(f"<url><loc>{escape(_abs(u))}</loc><changefreq>{f}</changefreq></url>" for u, f in urls)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'
    resp = HttpResponse(xml, content_type="application/xml")
    resp["Last-Modified"] = now.strftime("%a, %d %b %Y %H:%M:%S GMT")
    return resp


def robots(request):
    lines = ["User-agent: *", "Disallow: /admin", "Disallow: /lire/", "Disallow: /compte", "Disallow: /bibliotheque",
             "Disallow: /panier", "Disallow: /paiement", "Disallow: /api/", f"Sitemap: {_abs('/sitemap.xml')}"]
    if settings.ENVIRONMENT != "production":
        lines = ["User-agent: *", "Disallow: /"]  # recette et développement : non indexés
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain")


PREVIEW_BOTS = re.compile(r"facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|"
                          r"discordbot|pinterest|skypeuripreview|googlebot|bingbot", re.I)
BACKEND_PREFIXES = ("/api/", "/django-admin/", "/static/", "/media/", "/apercu/", "/sitemap.xml", "/robots.txt")


class SharePreviewMiddleware:
    """Hébergement Vercel : les pages du site arrivent ici quand un robot de réseau social les demande
    (règle de réécriture dans vercel.json). On lui sert l'aperçu, comme le fait Nginx en Docker."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (request.method == "GET" and not request.path.startswith(BACKEND_PREFIXES)
                and PREVIEW_BOTS.search(request.headers.get("User-Agent", ""))):
            return share_preview(request, request.path)
        return self.get_response(request)
