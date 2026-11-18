from django.contrib import admin

from .models import Access, GiftCode, Order, OrderItem, PaymentEvent, PromoCode


class ItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["reference", "user", "status", "total", "payment_method", "created_at"]
    list_filter = ["status", "payment_method"]
    search_fields = ["reference", "user__email"]
    inlines = [ItemInline]


admin.site.register([Access, GiftCode, PaymentEvent, PromoCode])
