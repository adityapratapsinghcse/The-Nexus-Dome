from rest_framework import serializers
from .models import Alert, AccessLog

class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'device', 'type', 'severity', 'message', 'is_read', 'timestamp']
        read_only_fields = ['id', 'timestamp']


class AccessLogSerializer(serializers.ModelSerializer):
    device = serializers.PrimaryKeyRelatedField(read_only=True)
    # Resolves the raw UID to the registered card's label (e.g. "Aditya Singh")
    # so the frontend doesn't have to display a bare hex string. Falls back to
    # None when the UID isn't registered (e.g. a denied/unknown card) — the
    # frontend is responsible for falling back to "Unknown RFID" itself.
    card_label = serializers.SerializerMethodField()

    class Meta:
        model = AccessLog
        fields = ['id', 'device', 'rfid_uid', 'card_label', 'method', 'granted', 'timestamp']
        read_only_fields = ['id', 'timestamp']

    def get_card_label(self, obj):
        if not obj.device_id or not obj.rfid_uid:
            return None
        from devices.models import RFIDCard
        card = RFIDCard.objects.filter(
            household_id=obj.device.household_id, uid__iexact=obj.rfid_uid
        ).first()
        return card.label if card and card.label else None