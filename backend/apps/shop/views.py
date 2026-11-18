import logging

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.emails import front
from apps.core.permissions import IsVerifiedEmail

from . import services
from .models import Order, PaymentEvent
from .payments import get_provider
from .serializers import CheckoutSerializer, OrderSerializer, QuoteSerializer

log = logging.getLogger(__name__)


def _public_quote(q):
    return {k: v for k, v in q.items() if not k.startswith("_")}


@api_view(["POST"])
def quote(request):
    ser = QuoteSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    d = ser.validated_data
    return Response(_public_quote(services.quote(d["items"], d["promo_code"], request.user, d["gift"])))


def _start_payment(order: Order):
    if order.total == 0:
        services.confirm_payment(order.reference, "gratuit")
        return front(f"/paiement/retour?ref={order.reference}")
    order.provider = get_provider().name
    order.save(update_fields=["provider"])
    return get_provider().initiate(order)


@api_view(["POST"])
@permission_classes([IsVerifiedEmail])
def checkout(request):
    ser = CheckoutSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    d = ser.validated_data
    if d["payer_phone"] and d["payment_method"] != "card" and not request.user.phone:
        # Numéro Mobile Money transmis à la passerelle (champ customer_phone_number).
        request.user.phone = d["payer_phone"]
        request.user.save(update_fields=["phone"])
    order = services.create_order(request.user, d["items"], d["payment_method"], d["promo_code"], d["gift_email"])
    try:
        redirect_url = _start_payment(order)
    except Exception as exc:  # passerelle injoignable : la commande reste en attente, relançable
        log.exception("Initialisation du paiement impossible")
        return Response({"detail": f"Le paiement n'a pas pu démarrer : {exc}", "reference": order.reference},
                        status=status.HTTP_502_BAD_GATEWAY)
    return Response({"order": OrderSerializer(order).data, "redirect_url": redirect_url}, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_orders(request):
    return Response(OrderSerializer(request.user.orders.prefetch_related("items__work"), many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def order_detail(request, reference):
    order = request.user.orders.filter(reference=reference).first()
    if not order:
        return Response(status=404)
    if order.status == Order.Status.PENDING and order.provider == "cinetpay":
        result = get_provider().check(order)
        if result == Order.Status.PAID:
            services.confirm_payment(order.reference)
        elif result == Order.Status.FAILED:
            services.fail_payment(order.reference)
        order.refresh_from_db()
    return Response(OrderSerializer(order).data)


@api_view(["POST"])
@permission_classes([IsVerifiedEmail])
def retry_payment(request, reference):
    order = request.user.orders.filter(reference=reference, status__in=[Order.Status.PENDING, Order.Status.FAILED]).first()
    if not order:
        return Response(status=404)
    if order.status == Order.Status.FAILED:
        order.status = Order.Status.PENDING
        order.save(update_fields=["status"])
    method = request.data.get("payment_method")
    if method:
        order.payment_method = method
        order.save(update_fields=["payment_method"])
    return Response({"redirect_url": _start_payment(order)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def simulate_payment(request, reference):
    """Paiement simulé (développement uniquement)."""
    if settings.PAYMENT_PROVIDER != "simulated":
        return Response(status=404)
    order = request.user.orders.filter(reference=reference).first()
    if not order:
        return Response(status=404)
    PaymentEvent.objects.create(order=order, provider="simulated", event=request.data.get("outcome", ""), payload={})
    if request.data.get("outcome") == "success":
        services.confirm_payment(reference, "SIM-" + reference)
    else:
        services.fail_payment(reference)
    order.refresh_from_db()
    return Response(OrderSerializer(order).data)


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def cinetpay_notify(request):
    """Notification serveur CinetPay. On revérifie toujours le statut auprès de l'API."""
    ref = request.data.get("cpm_trans_id") or request.POST.get("cpm_trans_id")
    order = Order.objects.filter(reference=ref).first()
    PaymentEvent.objects.create(order=order, provider="cinetpay", event="notify", payload=dict(request.data))
    if not order:
        return Response({"ok": False}, status=404)
    result = get_provider().check(order)
    if result == Order.Status.PAID:
        services.confirm_payment(order.reference)
    elif result == Order.Status.FAILED:
        services.fail_payment(order.reference)
    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def redeem_gift(request):
    gift = services.redeem_gift(request.user, request.data.get("code", ""))
    return Response({"work": {"slug": gift.work.slug, "title": gift.work.title}})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def receipt(request, reference):
    from django.http import HttpResponse

    from .receipts import receipt_pdf
    order = request.user.orders.filter(reference=reference, status__in=[Order.Status.PAID, Order.Status.REFUNDED]).first()
    if not order:
        return Response(status=404)
    resp = HttpResponse(receipt_pdf(order), content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="recu-{order.reference}.pdf"'
    return resp
