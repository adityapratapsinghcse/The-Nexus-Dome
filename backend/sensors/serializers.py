from rest_framework import serializers
from .models import SensorReading

class SensorReadingSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='device.name', read_only=True)

    class Meta:
        model = SensorReading
        fields = ['id', 'device', 'device_name', 'sensor_type', 'value', 'unit', 'timestamp']
        read_only_fields = ['id', 'timestamp', 'device_name']


class SensorBulkIngestSerializer(serializers.Serializer):
    """
    Matches the exact JSON shape your ESP32 already sends from
    buildSensorJSON() in Step 1.12 - one POST creates multiple
    SensorReading rows in one go.
    """
    temperature = serializers.FloatField(required=False)
    humidity = serializers.FloatField(required=False)
    distance_cm = serializers.FloatField(required=False)
    motion = serializers.BooleanField(required=False)
    window_open = serializers.BooleanField(required=False)
    gas_percent = serializers.FloatField(required=False)
    flame_detected = serializers.BooleanField(required=False)
    water_leak = serializers.BooleanField(required=False)
    current_amps = serializers.FloatField(required=False)
    light_percent = serializers.FloatField(required=False)
    is_dark = serializers.BooleanField(required=False)
    vibration_detected = serializers.BooleanField(required=False)