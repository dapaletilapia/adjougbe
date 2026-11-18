from .models import AuditLog


def client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR")
    return fwd.split(",")[0].strip() if fwd else request.META.get("REMOTE_ADDR")


def log_action(request, action: str, target=None, summary: str = ""):
    AuditLog.objects.create(
        actor=request.user if request.user.is_authenticated else None,
        action=action,
        target_type=target.__class__.__name__ if target is not None else "",
        target_id=str(getattr(target, "pk", "") or ""),
        summary=summary[:255],
        ip_address=client_ip(request),
    )


class AuditedModelViewSetMixin:
    """Journalise automatiquement création, modification et suppression."""

    def perform_create(self, serializer):
        obj = serializer.save()
        log_action(self.request, "create", obj, str(obj))

    def perform_update(self, serializer):
        obj = serializer.save()
        log_action(self.request, "update", obj, str(obj))

    def perform_destroy(self, instance):
        log_action(self.request, "delete", instance, str(instance))
        instance.delete()
