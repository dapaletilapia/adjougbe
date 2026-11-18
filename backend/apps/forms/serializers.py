from rest_framework import serializers

from .models import Form, FormField, FormResponse


class FormFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormField
        fields = ["id", "key", "label", "type", "required", "options", "help_text", "placeholder", "condition", "position"]


class PublicFormSerializer(serializers.ModelSerializer):
    fields = FormFieldSerializer(many=True, read_only=True)

    class Meta:
        model = Form
        fields = ["slug", "title", "description", "purpose", "consent_text", "newsletter_optin", "success_message",
                  "requires_login", "fields"]


class AdminFormSerializer(serializers.ModelSerializer):
    fields = FormFieldSerializer(many=True, required=False)
    response_count = serializers.IntegerField(source="responses.count", read_only=True)

    class Meta:
        model = Form
        fields = ["id", "slug", "title", "description", "purpose", "consent_text", "newsletter_optin",
                  "success_message", "requires_login", "is_active", "fields", "response_count", "created_at"]
        read_only_fields = ["slug"]

    def _save_fields(self, form, fields):
        keep = []
        for i, f in enumerate(fields):
            f["position"] = i
            obj, _ = FormField.objects.update_or_create(form=form, key=f["key"], defaults=f)
            keep.append(obj.pk)
        form.fields.exclude(pk__in=keep).delete()

    def create(self, data):
        fields = data.pop("fields", [])
        form = Form.objects.create(**data)
        self._save_fields(form, fields)
        return form

    def update(self, form, data):
        fields = data.pop("fields", None)
        for k, v in data.items():
            setattr(form, k, v)
        form.save()
        if fields is not None:
            self._save_fields(form, fields)
        return form


class FormResponseSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", default=None)

    class Meta:
        model = FormResponse
        fields = ["id", "data", "consent", "newsletter", "context", "user_email", "created_at"]
