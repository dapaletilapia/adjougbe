from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.catalog.models import Work
from apps.shop.models import Access
from apps.shop.services import grant_access

from . import services
from .models import Form
from .serializers import PublicFormSerializer


@api_view(["GET"])
def form_detail(request, slug):
    form = get_object_or_404(Form.objects.prefetch_related("fields"), slug=slug, is_active=True)
    return Response(PublicFormSerializer(form).data)


@api_view(["POST"])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def form_submit(request, slug):
    form = get_object_or_404(Form, slug=slug, is_active=True)
    data = request.data.dict() if hasattr(request.data, "dict") else dict(request.data)
    if hasattr(request.data, "getlist"):
        for f in form.fields.filter(type="multi"):
            data[f.key] = request.data.getlist(f.key)
    work_slug = request.query_params.get("work") or ""
    resp = services.submit(form, request, data, request.FILES, context=f"work:{work_slug}" if work_slug else "")
    payload = {"ok": True, "message": form.success_message, "response_id": resp.pk}
    # Formulaire d'accès à un ouvrage gratuit : déblocage immédiat.
    if work_slug and request.user.is_authenticated:
        work = Work.objects.filter(slug=work_slug, access_form=form, access_mode=Work.AccessMode.FREE_FORM).first()
        if work:
            grant_access(request.user, work, Access.Source.FREE_FORM)
            payload["work_unlocked"] = work.slug
    return Response(payload, status=201)
