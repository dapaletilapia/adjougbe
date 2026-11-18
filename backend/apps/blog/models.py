from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.models import TimeStampedModel


class Category(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField(max_length=60)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name


class PublishedQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=Post.Status.PUBLISHED, published_at__lte=timezone.now())


class Post(TimeStampedModel):
    class Kind(models.TextChoices):
        ARTICLE = "article", "Article"
        PUNCHLINE = "punchline", "Punchline du jour"
        PAPO = "papo", "Papo de Tiékar"
        MEDIA = "media", "Vidéo / audio"
        EVENT = "event", "Annonce / événement"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        PUBLISHED = "published", "Publié / programmé"

    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=220)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.ARTICLE, db_index=True)
    excerpt = models.CharField(max_length=300, blank=True)
    body = models.TextField(blank=True, help_text="HTML nettoyé à l'enregistrement")
    quote = models.TextField(blank=True, help_text="Texte de la punchline (rubrique Punchline du jour)")
    cover = models.ImageField(upload_to="blog/", blank=True)
    media_url = models.URLField(blank=True, help_text="Vidéo YouTube/TikTok ou fichier audio")
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="posts")
    tags = models.ManyToManyField(Tag, blank=True, related_name="posts")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="posts")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT, db_index=True)
    # Une date future = publication programmée.
    published_at = models.DateTimeField(default=timezone.now, db_index=True)
    members_only = models.BooleanField(default=False, help_text="Réservé aux comptes inscrits")
    allow_comments = models.BooleanField(default=True)
    seo_description = models.CharField(max_length=160, blank=True)
    view_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)

    objects = PublishedQuerySet.as_manager()

    class Meta:
        ordering = ["-published_at"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:200] or "billet"
            slug, i = base, 2
            while Post.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug, i = f"{base}-{i}", i + 1
            self.slug = slug
        super().save(*args, **kwargs)

    @property
    def is_live(self):
        return self.status == self.Status.PUBLISHED and self.published_at <= timezone.now()


class Comment(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        APPROVED = "approved", "Publié"
        REJECTED = "rejected", "Refusé"

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    body = models.TextField(max_length=2000)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    is_author_reply = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]


class Reaction(models.Model):
    class Kind(models.TextChoices):
        LOVE = "love", "❤️"
        LOL = "lol", "😂"
        FIRE = "fire", "🔥"
        CLAP = "clap", "👏"

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=8, choices=Kind.choices)

    class Meta:
        unique_together = [("post", "user", "kind")]
