from rest_framework import serializers
from .models import Alert, AccessLog

class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ['id', 'device', 'type', 'severity', 'message', 'is_read', 'timestamp']
        read_only_fields = ['id', 'timestamp']


class AccessLogSerializer(serializers.ModelSerializer):
    device = serializers.PrimaryKeyRelatedField(read_only=True)
    class Meta:
        model = AccessLog
        fields = ['id','device', 'rfid_uid', 'method', 'granted', 'timestamp']
        read_only_fields = ['id', 'timestamp']