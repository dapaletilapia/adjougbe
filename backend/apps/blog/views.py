from django.db.models import F, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.reader.rendering import render_quote_card

from .models import Category, Comment, Post, Reaction
from .serializers import CategorySerializer, CommentSerializer, PostCardSerializer, PostDetailSerializer

BANNED = {"connard", "salaud", "enculé", "pute", "batard", "bâtard", "fdp", "ntm"}


class PostList(generics.ListAPIView):
    serializer_class = PostCardSerializer
    search_fields = ["title", "excerpt", "body", "quote"]

    def get_queryset(self):
        qs = Post.objects.published().select_related("category")
        p = self.request.query_params
        if p.get("kind"):
            qs = qs.filter(kind=p["kind"])
        if p.get("category"):
            qs = qs.filter(category__slug=p["category"])
        if p.get("tag"):
            qs = qs.filter(tags__slug=p["tag"])
        return qs


@api_view(["GET"])
def post_detail(request, slug):
    post = get_object_or_404(Post.objects.published().select_related("category", "author"), slug=slug)
    Post.objects.filter(pk=post.pk).update(view_count=F("view_count") + 1)
    data = PostDetailSerializer(post, context={"request": request}).data
    related = Post.objects.published().filter(Q(category=post.category) | Q(kind=post.kind)).exclude(pk=post.pk)[:3]
    data["related"] = PostCardSerializer(related, many=True, context={"request": request}).data
    return Response(data)


@api_view(["GET"])
def categories(request):
    return Response(CategorySerializer(Category.objects.all(), many=True).data)


@api_view(["GET"])
def punchline_of_the_day(request):
    post = Post.objects.published().filter(kind=Post.Kind.PUNCHLINE).first()
    if not post:
        return Response(None)
    return Response(PostCardSerializer(post, context={"request": request}).data)


@api_view(["GET", "POST"])
def comments(request, slug):
    post = get_object_or_404(Post.objects.published(), slug=slug)
    if request.method == "POST":
        if not request.user.is_authenticated:
            return Response({"detail": "Connectez-vous pour commenter."}, status=401)
        if not post.allow_comments:
            return Response({"detail": "Commentaires fermés."}, status=400)
        body = str(request.data.get("body", "")).strip()[:2000]
        if len(body) < 2:
            return Response({"body": "Commentaire trop court."}, status=400)
        flagged = any(w in body.lower() for w in BANNED)
        c = Comment.objects.create(
            post=post, user=request.user, body=body, parent_id=request.data.get("parent") or None,
            is_author_reply=request.user.is_staff_role,
            status=Comment.Status.APPROVED if request.user.is_staff_role else
            (Comment.Status.REJECTED if flagged else Comment.Status.PENDING))
        return Response({**CommentSerializer(c).data,
                         "message": "Merci ! Votre commentaire sera visible après modération."}, status=201)
    qs = post.comments.filter(status=Comment.Status.APPROVED).select_related("user")
    return Response(CommentSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def react(request, slug):
    post = get_object_or_404(Post.objects.published(), slug=slug)
    kind = request.data.get("kind")
    if kind not in Reaction.Kind.values:
        return Response(status=400)
    r = Reaction.objects.filter(post=post, user=request.user, kind=kind)
    if r.exists():
        r.delete()
    else:
        Reaction.objects.create(post=post, user=request.user, kind=kind)
    return Response(PostDetailSerializer(post, context={"request": request}).data["reactions"])


@api_view(["POST"])
def track_share(request, slug):
    Post.objects.filter(slug=slug).update(share_count=F("share_count") + 1)
    return Response({"ok": True})


def quote_card(request, slug):
    """Visuel de citation prêt à partager (PNG)."""
    post = get_object_or_404(Post.objects.published(), slug=slug)
    text = post.quote or post.excerpt or post.title
    fmt = "story" if request.GET.get("format") == "story" else "square"
    resp = HttpResponse(render_quote_card(text[:400], fmt=fmt), content_type="image/png")
    resp["Cache-Control"] = "public, max-age=86400"
    if request.GET.get("download"):
        resp["Content-Disposition"] = f'attachment; filename="punchline-{post.slug}.png"'
    return resp


@api_view(["GET"])
def home(request):
    """Accueil dynamique : punchline du jour, œuvres, articles, formations, bannières, témoignages."""
    from apps.catalog.models import Review, Work
    from apps.catalog.serializers import WorkCardSerializer
    from apps.core.models import Banner
    from apps.trainings.models import TrainingSession
    from apps.trainings.serializers import SessionCardSerializer

    now = timezone.now()
    punch = Post.objects.published().filter(kind=Post.Kind.PUNCHLINE).first()
    banners = Banner.objects.filter(is_active=True).filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now)).filter(
        Q(ends_at__isnull=True) | Q(ends_at__gte=now))
    reviews = Review.objects.filter(status="approved", rating__gte=4).select_related("user", "work")[:6]
    ctx = {"request": request}
    from django.db.models import Avg, Count

    from apps.catalog.models import Bundle
    from apps.catalog.serializers import BundleSerializer
    from apps.shop.models import Access
    rating = Review.objects.filter(status="approved").aggregate(avg=Avg("rating"), n=Count("id"))
    stats = {
        "readers": Access.objects.filter(revoked_at__isnull=True).values("user").distinct().count(),
        "rating": round(rating["avg"], 1) if rating["avg"] else None,
        "reviews": rating["n"],
        "trainings": TrainingSession.objects.filter(is_cancelled=False, starts_at__lte=now).count(),
        "series": sum(w.sections.count() for w in Work.objects.filter(status="published", access_mode="paid")),
    }
    bundle = Bundle.objects.filter(is_active=True).prefetch_related("works").first()
    return Response({
        "stats": stats,
        "bundle": BundleSerializer(bundle, context=ctx).data if bundle else None,
        "punchline": PostCardSerializer(punch, context=ctx).data if punch else None,
        "works": WorkCardSerializer(Work.objects.filter(status__in=["published", "preorder"]), many=True, context=ctx).data,
        "posts": PostCardSerializer(Post.objects.published().exclude(kind=Post.Kind.PUNCHLINE)[:4], many=True, context=ctx).data,
        "sessions": SessionCardSerializer(
            TrainingSession.objects.filter(starts_at__gte=now, is_cancelled=False, training__is_published=True)
            .select_related("training")[:3], many=True, context=ctx).data,
        "banners": [{"id": b.pk, "title": b.title, "subtitle": b.subtitle, "image": b.image.url if b.image else None,
                     "link_url": b.link_url, "link_label": b.link_label, "placement": b.placement} for b in banners],
        "testimonials": [{"body": r.body, "rating": r.rating, "work": r.work.title,
                          "author": r.user.full_name.split()[0] if r.user.full_name else "Lecteur"} for r in reviews],
    })
