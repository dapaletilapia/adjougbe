from django.db.models import Avg, Count
from rest_framework import serializers

from apps.shop.models import Access

from .models import Bundle, Review, Section, Work


class WorkCardSerializer(serializers.ModelSerializer):
    current_price_xof = serializers.IntegerField(read_only=True)
    is_promo_active = serializers.BooleanField(read_only=True)
    sections_count = serializers.SerializerMethodField()
    rating = serializers.SerializerMethodField()
    owned = serializers.SerializerMethodField()
    access_mode_label = serializers.CharField(source="get_access_mode_display", read_only=True)

    class Meta:
        model = Work
        fields = ["id", "slug", "title", "subtitle", "kind", "cover", "cover_color", "summary", "price_xof",
                  "price_eur", "current_price_xof", "promo_price_xof", "promo_ends_at", "is_promo_active",
                  "access_mode", "access_mode_label", "status", "release_date", "is_featured", "sections_count",
                  "unit_label", "rating", "owned", "format_label", "edition"]

    def get_sections_count(self, obj):
        return getattr(obj, "n_sections", None) if hasattr(obj, "n_sections") else obj.sections.count()

    def get_rating(self, obj):
        agg = obj.reviews.filter(status=Review.Status.APPROVED).aggregate(avg=Avg("rating"), n=Count("id"))
        return {"average": round(agg["avg"], 1) if agg["avg"] else None, "count": agg["n"]}

    def get_owned(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        owned = self.context.setdefault("_owned", set(
            Access.objects.filter(user=request.user, revoked_at__isnull=True).values_list("work_id", flat=True)))
        return obj.pk in owned


class SectionTitleSerializer(serializers.ModelSerializer):
    free = serializers.BooleanField(source="is_free_extract")

    class Meta:
        model = Section
        fields = ["id", "number", "title", "free"]


class ReviewSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ["id", "rating", "body", "author", "created_at"]

    def get_author(self, obj):
        parts = obj.user.full_name.split()
        return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else (parts[0] if parts else "Lecteur")


class BundleSerializer(serializers.ModelSerializer):
    works = WorkCardSerializer(many=True, read_only=True)
    full_price_xof = serializers.IntegerField(read_only=True)

    class Meta:
        model = Bundle
        fields = ["id", "slug", "title", "description", "price_xof", "full_price_xof", "works"]


class WorkDetailSerializer(WorkCardSerializer):
    sections = SectionTitleSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    related = WorkCardSerializer(many=True, read_only=True)
    bundles = serializers.SerializerMethodField()
    access_form = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    readers_count = serializers.SerializerMethodField()

    class Meta(WorkCardSerializer.Meta):
        fields = WorkCardSerializer.Meta.fields + ["sections", "reviews", "related", "bundles", "access_form",
                                                   "free_extract_count", "seo_description", "readers_count"]

    def get_readers_count(self, obj):
        return obj.accesses.filter(revoked_at__isnull=True).count()

    def get_reviews(self, obj):
        qs = obj.reviews.filter(status=Review.Status.APPROVED).select_related("user")[:20]
        return ReviewSerializer(qs, many=True).data

    def get_bundles(self, obj):
        return [{"id": b.pk, "slug": b.slug, "title": b.title, "price_xof": b.price_xof,
                 "full_price_xof": b.full_price_xof} for b in obj.bundles.filter(is_active=True)]
