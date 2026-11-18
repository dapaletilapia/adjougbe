import nh3
from rest_framework import serializers

from .models import Category, Comment, Post, Tag

ALLOWED_TAGS = {"p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4",
                "img", "figure", "figcaption", "iframe", "hr", "span", "code", "pre"}
ALLOWED_ATTRS = {"a": {"href", "title", "target"}, "img": {"src", "alt", "width", "height"},
                 "iframe": {"src", "width", "height", "allow", "allowfullscreen", "title"}, "span": {"class"}}


def sanitize_html(html: str) -> str:
    cleaned = nh3.clean(html or "", tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, link_rel="noopener noreferrer")
    return cleaned


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class PostCardSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    comment_count = serializers.SerializerMethodField()
    read_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ["id", "slug", "title", "kind", "kind_label", "excerpt", "quote", "cover", "category",
                  "published_at", "members_only", "comment_count", "media_url", "read_minutes"]

    def get_read_minutes(self, obj):
        import re
        words = len(re.sub(r"<[^>]+>", " ", obj.body or "").split()) + len((obj.quote or "").split())
        return max(1, round(words / 200))

    def get_comment_count(self, obj):
        return obj.comments.filter(status=Comment.Status.APPROVED).count()


class PostDetailSerializer(PostCardSerializer):
    tags = TagSerializer(many=True, read_only=True)
    body = serializers.SerializerMethodField()
    locked = serializers.SerializerMethodField()
    reactions = serializers.SerializerMethodField()
    author_name = serializers.CharField(source="author.full_name", default="Adjougbe")

    class Meta(PostCardSerializer.Meta):
        fields = PostCardSerializer.Meta.fields + ["tags", "body", "locked", "reactions", "allow_comments",
                                                   "seo_description", "author_name"]

    def _locked(self, obj):
        req = self.context.get("request")
        return obj.members_only and not (req and req.user.is_authenticated)

    def get_locked(self, obj):
        return self._locked(obj)

    def get_body(self, obj):
        return "" if self._locked(obj) else obj.body

    def get_reactions(self, obj):
        req = self.context.get("request")
        counts = {k: 0 for k, _ in obj.reactions.model.Kind.choices}
        for r in obj.reactions.values_list("kind", flat=True):
            counts[r] += 1
        mine = list(obj.reactions.filter(user=req.user).values_list("kind", flat=True)) if req and req.user.is_authenticated else []
        return {"counts": counts, "mine": mine}


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "body", "author", "parent", "is_author_reply", "created_at", "status"]
        read_only_fields = ["is_author_reply", "status"]

    def get_author(self, obj):
        return obj.user.full_name.split()[0] if obj.user.full_name else "Lecteur"


class AdminPostSerializer(serializers.ModelSerializer):
    category_id = serializers.PrimaryKeyRelatedField(source="category", queryset=Category.objects.all(),
                                                     allow_null=True, required=False)
    tag_names = serializers.ListField(child=serializers.CharField(), required=False, write_only=True)
    tags = TagSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    is_live = serializers.BooleanField(read_only=True)
    pending_comments = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = ["id", "slug", "title", "kind", "excerpt", "body", "quote", "cover", "media_url", "category",
                  "category_id", "tags", "tag_names", "status", "published_at", "members_only", "allow_comments",
                  "seo_description", "view_count", "share_count", "is_live", "pending_comments", "created_at",
                  "updated_at"]
        read_only_fields = ["slug", "view_count", "share_count"]

    def get_pending_comments(self, obj):
        return obj.comments.filter(status=Comment.Status.PENDING).count()

    def validate_body(self, value):
        return sanitize_html(value)

    def _tags(self, post, names):
        from django.utils.text import slugify
        tags = []
        for n in names:
            n = n.strip()
            if n:
                tags.append(Tag.objects.get_or_create(slug=slugify(n)[:50], defaults={"name": n})[0])
        post.tags.set(tags)

    def create(self, data):
        names = data.pop("tag_names", None)
        post = super().create(data)
        if names is not None:
            self._tags(post, names)
        return post

    def update(self, post, data):
        names = data.pop("tag_names", None)
        post = super().update(post, data)
        if names is not None:
            self._tags(post, names)
        return post
