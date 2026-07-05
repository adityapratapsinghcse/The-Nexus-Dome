from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from devices.models import Device
from .models import SensorReading
from .serializers import SensorReadingSerializer, SensorBulkIngestSerializer
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny ,IsAuthenticated
from devices.authentication import DeviceKeyAuthentication
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from alerts.push import send_alert_push
from alerts.models import Alert

# Maps the flat JSON fields your ESP32 sends to (sensor_type, unit) pairs
SENSOR_FIELD_MAP = {
    'temperature':        ('temperature', 'C'),
    'humidity':           ('humidity', '%'),
    'distance_cm':        ('distance', 'cm'),
    'gas_percent':        ('gas', '%'),
    'current_amps':       ('current', 'A'),
    'light_percent':      ('light', '%'),
}
# Boolean fields get stored as 1.0/0.0 so they still fit the FloatField value column
BOOLEAN_FIELD_MAP = {
    'motion':             'motion',
    'window_open':        'window',
    'flame_detected':     'flame',
    'water_leak':         'water',
    'is_dark':            None,
    'vibration_detected': 'vibration',
    'light_on':           'light_relay',
    'fan_on':             'fan_relay',
    'cutoff_on':          'cutoff_relay',
}


@api_view(['POST'])
@authentication_classes([DeviceKeyAuthentication])
@permission_classes([AllowAny])
def ingest_sensor_data(request):
    """
    POST /api/sensors/data/
    Header required: X-Device-Key: <device's secret key>
    """
    device = request.auth
    if device is None:
        return Response({"error": "Missing or invalid X-Device-Key header"}, status=401)

    serializer = SensorBulkIngestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    data.pop('device_id', None)  # no longer required/used - device comes from the key

    device.is_online = True
    device.last_seen = timezone.now()
    device.save()

    created = []
    for field, value in data.items():
        if field in SENSOR_FIELD_MAP:
            sensor_type, unit = SENSOR_FIELD_MAP[field]
            created.append(SensorReading(device=device, sensor_type=sensor_type, value=value, unit=unit))
        elif field in BOOLEAN_FIELD_MAP and BOOLEAN_FIELD_MAP[field]:
            sensor_type = BOOLEAN_FIELD_MAP[field]
            created.append(SensorReading(device=device, sensor_type=sensor_type, value=1.0 if value else 0.0, unit='bool'))

    SensorReading.objects.bulk_create(created)
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"sensors_{device.household_id}",
        {
            "type": "sensor_update",
            "data": {
                "device_id": device.id,
                "device_name": device.name,
                **request.data  # the raw payload the ESP32 sent
            }
        }
    )
    # Inside ingest_sensor_data, after the existing bulk_create and WebSocket broadcast, add:
    if data.get('flame_detected'):
        Alert.objects.create(device=device, type='fire', severity='critical', message='Flame detected - possible fire!')
        send_alert_push(device.household_id, "🔥 Fire Alert", "Flame sensor triggered - check immediately!")

    if data.get('water_leak'):
        Alert.objects.create(device=device, type='water_leak', severity='critical', message='Water leak detected!')
        send_alert_push(device.household_id, "💧 Water Leak", "Leak sensor triggered.")

    if data.get('gas_percent', 0) > 55:
        Alert.objects.create(device=device, type='gas_leak', severity='critical', message=f"Gas level critical: {data.get('gas_percent')}%")
        send_alert_push(device.household_id, "⚠️ Gas Alert", f"Gas level at {data.get('gas_percent')}% - critical threshold exceeded!")
        return Response({"status": "ok", "readings_created": len(created)}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def latest_readings(request):
    """
    GET /api/sensors/latest/?device_id=1
    Returns the single most recent reading per sensor_type for a device
    the logged-in user actually belongs to.
    """
    user_households = request.user.memberships.values_list('household_id', flat=True)
    device_id = request.query_params.get('device_id')

    devices = Device.objects.filter(household_id__in=user_households)
    if device_id:
        devices = devices.filter(id=device_id)
        if not devices.exists():
            return Response({"error": "Device not found or not in your household"}, status=404)

    readings = SensorReading.objects.filter(device__in=devices)

    latest_per_type = {}
    for reading in readings.order_by('sensor_type', '-timestamp'):
        if reading.sensor_type not in latest_per_type:
            latest_per_type[reading.sensor_type] = reading

    serializer = SensorReadingSerializer(list(latest_per_type.values()), many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sensor_history(request):
    """
    GET /api/sensors/history/?device_id=1&sensor_type=temperature&limit=100
    """
    user_households = request.user.memberships.values_list('household_id', flat=True)
    device_id = request.query_params.get('device_id')
    sensor_type = request.query_params.get('sensor_type')
    limit = int(request.query_params.get('limit', 100))

    if not sensor_type:
        return Response({"error": "sensor_type query param required"}, status=400)

    devices = Device.objects.filter(household_id__in=user_households)
    if device_id:
        devices = devices.filter(id=device_id)
        if not devices.exists():
            return Response({"error": "Device not found or not in your household"}, status=404)

    readings = SensorReading.objects.filter(
        device__in=devices, sensor_type=sensor_type
    ).order_by('-timestamp')[:limit]

    serializer = SensorReadingSerializer(readings, many=True)
    return Response(serializer.data)