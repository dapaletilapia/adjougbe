from rest_framework import serializers

from .models import Order, OrderItem, PaymentMethod


class CartItemSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["work", "bundle", "session"])
    id = serializers.IntegerField()


class QuoteSerializer(serializers.Serializer):
    items = CartItemSerializer(many=True)
    promo_code = serializers.CharField(required=False, allow_blank=True, default="")
    gift = serializers.BooleanField(required=False, default=False)


class CheckoutSerializer(QuoteSerializer):
    payment_method = serializers.ChoiceField(choices=[c for c in PaymentMethod.values if c not in ("free", "manual")])
    gift_email = serializers.EmailField(required=False, allow_blank=True, default="")
    payer_phone = serializers.RegexField(r"^\+?[0-9 ]{8,20}$", required=False, allow_blank=True, default="")


class OrderItemSerializer(serializers.ModelSerializer):
    work_slug = serializers.CharField(source="work.slug", default=None)

    class Meta:
        model = OrderItem
        fields = ["label", "unit_price", "quantity", "work_slug"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display")
    payment_method_label = serializers.CharField(source="get_payment_method_display")

    class Meta:
        model = Order
        fields = ["reference", "status", "status_label", "subtotal", "discount", "total", "currency",
                  "payment_method", "payment_method_label", "created_at", "paid_at", "items", "is_gift",
                  "gift_recipient_email"]
