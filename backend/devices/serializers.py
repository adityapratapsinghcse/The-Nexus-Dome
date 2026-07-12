from rest_framework import serializers
from .models import Device, Command, EnergyLog
from .models import RFIDCard

class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ['id','household','name', 'type', 'location', 'is_online', 'last_seen', 'created_at']
        read_only_fields = ['id', 'created_at']


class CommandSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)

    class Meta:
        model = Command
        fields = [
            'id', 'device', 'device_name', 'action', 'payload',
            'status', 'created_at', 'acknowledged_at'
        ]
        read_only_fields = ['id', 'created_at', 'acknowledged_at', 'device_name']


class EnergyLogSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)

    class Meta:
        model = EnergyLog
        fields = ['id', 'device', 'device_name', 'on_duration_mins', 'estimated_kwh', 'date']
        read_only_fields = ['id', 'device_name']


class RFIDCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = RFIDCard
        fields = ['id', 'household', 'uid', 'label', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']