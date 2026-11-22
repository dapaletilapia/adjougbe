from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsVerifiedEmail
from apps.forms.models import FormResponse
from apps.shop.serializers import OrderSerializer

from . import services
from .certificates import certificate_pdf
from .models import Enrollment, Training, TrainingSession
from .serializers import MyEnrollmentSerializer, TrainingCardSerializer, TrainingDetailSerializer


class TrainingList(generics.ListAPIView):
    serializer_class = TrainingCardSerializer
    pagination_class = None
    search_fields = ["title", "summary", "theme"]
    filterset_fields = ["format", "theme"]

    def get_queryset(self):
        qs = Training.objects.filter(is_published=True).prefetch_related("sessions")
        price = self.request.query_params.get("price")
        if price == "free":
            qs = qs.filter(price_xof=0)
        elif price == "paid":
            qs = qs.filter(price_xof__gt=0)
        return qs


class TrainingDetail(generics.RetrieveAPIView):
    serializer_class = TrainingDetailSerializer
    lookup_field = "slug"
    queryset = Training.objects.filter(is_published=True)


@api_view(["POST"])
@permission_classes([IsVerifiedEmail])
def enroll(request, pk):
    session = get_object_or_404(TrainingSession.objects.select_related("training"), pk=pk,
                                training__is_published=True)
    if session.training.registration_mode == Training.Registration.EXTERNAL:
        return Response({"detail": "L'inscription à cette formation se fait auprès de l'organisateur."}, status=400)
    form_response = None
    if request.data.get("form_response_id"):
        form_response = FormResponse.objects.filter(pk=request.data["form_response_id"], user=request.user).first()
    if session.training.registration_form_id and not form_response:
        return Response({"detail": "Merci de remplir le formulaire d'inscription."}, status=400)
    enr = services.enroll(request.user, session, form_response)
    payload = {"enrollment": MyEnrollmentSerializer(enr).data}
    if enr.status == Enrollment.Status.PENDING_PAYMENT:
        from apps.shop import services as shop
        from apps.shop.views import _start_payment
        order = shop.create_order(request.user, [{"type": "session", "id": session.pk}],
                                  request.data.get("payment_method", "orange_money"))
        enr.order = order
        enr.save(update_fields=["order"])
        payload["order"] = OrderSerializer(order).data
        payload["redirect_url"] = _start_payment(order)
    return Response(payload, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_enrollments(request):
    qs = request.user.enrollments.select_related("session__training", "order")
    return Response(MyEnrollmentSerializer(qs, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_enrollment(request, pk):
    enr = get_object_or_404(Enrollment, pk=pk, user=request.user)
    if enr.status == Enrollment.Status.CONFIRMED and enr.session.effective_price > 0:
        return Response({"detail": "Contactez-nous pour annuler une inscription payée."}, status=400)
    enr.status = Enrollment.Status.CANCELLED
    enr.save(update_fields=["status"])
    services.promote_waitlist(enr.session)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def certificate(request, pk):
    enr = get_object_or_404(Enrollment, pk=pk, user=request.user, attended=True)
    resp = HttpResponse(certificate_pdf(enr), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="attestation-{enr.session.training.slug}.pdf"'
    return resp


@api_view(["GET"])
def verify_certificate(request, code):
    enr = Enrollment.objects.filter(certificate_code=code.upper()).select_related("user", "session__training").first()
    if not enr:
        return Response({"valid": False}, status=404)
    return Response({"valid": True, "name": enr.user.full_name, "training": enr.session.training.title,
                     "date": enr.session.starts_at, "issued_at": enr.certificate_issued_at})
