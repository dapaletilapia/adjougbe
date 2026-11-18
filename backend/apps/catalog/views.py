from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.shop.models import Access

from .models import Bundle, Review, Work
from .serializers import BundleSerializer, WorkCardSerializer, WorkDetailSerializer

VISIBLE = [Work.Status.PUBLISHED, Work.Status.PREORDER]


class WorkList(generics.ListAPIView):
    serializer_class = WorkCardSerializer
    pagination_class = None
    search_fields = ["title", "summary"]
    filterset_fields = ["kind", "access_mode", "is_featured"]

    def get_queryset(self):
        return Work.objects.filter(status__in=VISIBLE).annotate(n_sections=Count("sections"))


class WorkDetail(generics.RetrieveAPIView):
    serializer_class = WorkDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return Work.objects.filter(status__in=VISIBLE).prefetch_related("sections", "related")


class BundleList(generics.ListAPIView):
    serializer_class = BundleSerializer
    pagination_class = None
    queryset = Bundle.objects.filter(is_active=True).prefetch_related("works")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def post_review(request, slug):
    work = get_object_or_404(Work, slug=slug)
    if not Access.objects.filter(user=request.user, work=work, revoked_at__isnull=True).exists():
        return Response({"detail": "Seuls les lecteurs de l'œuvre peuvent laisser un avis."}, status=403)
    try:
        rating = int(request.data.get("rating", 0))
    except (TypeError, ValueError):
        rating = 0
    if not 1 <= rating <= 5:
        return Response({"rating": "Note entre 1 et 5."}, status=400)
    Review.objects.update_or_create(work=work, user=request.user, defaults={
        "rating": rating, "body": str(request.data.get("body", ""))[:1500], "status": Review.Status.PENDING})
    return Response({"ok": True, "message": "Merci ! Votre avis sera publié après modération."}, status=201)
