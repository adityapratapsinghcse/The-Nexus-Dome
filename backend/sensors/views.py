from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from devices.models import Device
from .models import SensorReading
from .serializers import SensorReadingSerializer, SensorBulkIngestSerializer
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from devices.authentication import DeviceKeyAuthentication
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from alerts.push import send_alert_push
from alerts.models import Alert
import logging

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
    'vibration_detected': 'vibration',
    'light_on':           'light_relay',
    'fan_on':             'fan_relay',
    'cutoff_on':          'cutoff_relay',
    'car_detected':       'car_presence',
}

# ---- Water tank calibration ----
# NOTE: water tank feature is currently deferred (ultrasonic sensor is
# dedicated to the garage). This calibration is left in place but unused
# until a second ultrasonic sensor is added for the tank.
TANK_HEIGHT_CM = 100
TANK_LOW_PERCENT = 25
TANK_CRITICAL_PERCENT = 10
ALERT_REPEAT_COOLDOWN_MINUTES = 30


def compute_water_level_percent(distance_cm):
    """Convert a raw ultrasonic distance reading into a 0-100% tank fill level."""
    if distance_cm is None:
        return None
    level = ((TANK_HEIGHT_CM - distance_cm) / TANK_HEIGHT_CM) * 100
    return round(max(0, min(100, level)), 1)


def _recent_alert_exists(device, alert_type, minutes=ALERT_REPEAT_COOLDOWN_MINUTES):
    from django.utils import timezone
    import datetime
    since = timezone.now() - datetime.timedelta(minutes=minutes)
    return Alert.objects.filter(device=device, type=alert_type, timestamp__gte=since).exists()


@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_sensor_data(request):
    # Authenticate device via headers
    device_key = request.headers.get('X-Device-Key')
    if not device_key:
        return Response({"error": "Device key missing"}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        from devices.models import Device
        device = Device.objects.get(device_key=device_key)
    except Device.DoesNotExist:
        return Response({"error": "Invalid device key"}, status=status.HTTP_401_UNAUTHORIZED)

    household = device.household

    # Mark the board as online now that it has actually reached us
    device.is_online = True
    device.last_seen = timezone.now()
    device.save(update_fields=['is_online', 'last_seen'])

    serializer = SensorBulkIngestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    readings_to_create = []
    broadcast_payload = {}  # what gets pushed live to the dashboard over WebSocket

    # Numeric readings (temperature, humidity, distance, gas, current, light)
    for field, (sensor_type, unit) in SENSOR_FIELD_MAP.items():
        value = data.get(field)
        if value is not None:
            readings_to_create.append(SensorReading(device=device, sensor_type=sensor_type, value=value, unit=unit))
            broadcast_payload[field] = value

    # Boolean / relay states, stored as 1.0 / 0.0
    for field, sensor_type in BOOLEAN_FIELD_MAP.items():
        value = data.get(field)
        if value is not None:
            readings_to_create.append(SensorReading(device=device, sensor_type=sensor_type, value=1.0 if value else 0.0))
            broadcast_payload[field] = value

    # Derive the water tank level (%) straight from the ultrasonic distance reading
    # (currently unused in practice since the ultrasonic sensor is dedicated to the garage)
    water_level_percent = compute_water_level_percent(data.get('distance_cm'))
    if water_level_percent is not None:
        readings_to_create.append(SensorReading(device=device, sensor_type='water_level', value=water_level_percent, unit='%'))
        broadcast_payload['water_level_percent'] = water_level_percent

    if readings_to_create:
        SensorReading.objects.bulk_create(readings_to_create)

    # Push this reading to the live dashboard immediately, in real time
    if broadcast_payload:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"sensors_{household.id}",
            {"type": "sensor_update", "data": broadcast_payload},
        )

    # ---- Emergency threshold & edge triggers ----
    if data.get('flame_detected'):
        broadcast_and_push_alert(device, 'fire', "Critical flame signature detected!", severity='critical')

    # Water tank level alerts (dormant until a dedicated tank sensor exists)
    if water_level_percent is not None:
        if water_level_percent <= TANK_CRITICAL_PERCENT:
            if not _recent_alert_exists(device, 'water_low'):
                broadcast_and_push_alert(
                    device, 'water_low',
                    f"Water tank is critically low ({water_level_percent}%). Please refill soon.",
                    severity='critical',
                )
        elif water_level_percent <= TANK_LOW_PERCENT:
            if not _recent_alert_exists(device, 'water_low'):
                broadcast_and_push_alert(
                    device, 'water_low',
                    f"Water tank level is getting low ({water_level_percent}%).",
                    severity='warning',
                )

    # Garage: car detected -> don't auto-open, ask the user first
    if data.get('car_detected'):
        # FIX: garage_status only ever left 'pending' via garage_confirm().
        # If that confirm step never happened (ESP32 test run cut short, a
        # Postman test that skipped the confirm call, etc.) garage_status
        # stayed stuck on 'pending' forever, and this whole block was
        # permanently skipped — the popup would never fire again for that
        # device, with no error anywhere to explain why. Treat a 'pending'
        # that's older than 5 minutes as abandoned and let it re-trigger.
        stale_pending = False
        if device.garage_status == 'pending':
            last_prompt = Alert.objects.filter(device=device, type='car_detected').order_by('-timestamp').first()
            if last_prompt:
                import datetime
                stale_pending = (timezone.now() - last_prompt.timestamp) > datetime.timedelta(minutes=5)
            else:
                stale_pending = True  # pending with no matching alert at all shouldn't be possible; don't get stuck on it

        if (device.garage_status != 'pending' or stale_pending) and not _recent_alert_exists(device, 'car_detected', minutes=2):
            device.garage_status = 'pending'
            device.save(update_fields=['garage_status'])
            alert = broadcast_and_push_alert(
                device, 'car_detected',
                "A vehicle was detected at the garage. Open the gate?",
                severity='warning',
            )
            # Extra WebSocket event specifically for the confirm/deny modal
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"alerts_{device.household_id}",
                {
                    "type": "garage_prompt",
                    "message": {
                        "device_id": device.id,
                        "alert_id": alert.id,
                        "text": "Vehicle detected at the garage gate. Open it?",
                    },
                },
            )

    return Response({"status": "ok"}, status=status.HTTP_201_CREATED)


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


logger = logging.getLogger(__name__)

def broadcast_and_push_alert(device, alert_type, message, severity='warning'):
    """Helper to save alert, push to FCM, and broadcast over WebSocket simultaneously"""
    alert = Alert.objects.create(
        device=device,
        type=alert_type,
        message=message,
        severity=severity
    )

    # 1. Broadcast to in-app WebSockets
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"alerts_{device.household_id}",
        {
            # NOTE: this "type" must match AlertConsumer's handler method name (alert_update)
            "type": "alert_update",
            "message": {
                "id": alert.id,
                "device_id": device.id,
                "type": alert.type,
                "message": alert.message,
                "severity": alert.severity,
                "is_read": alert.is_read,
                "timestamp": alert.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "created_at": alert.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        }
    )

    # 2. Push to Android Mobile App via FCM
    send_alert_push(device.household_id, "🚨 SmartNest Alert", message)
    return alert