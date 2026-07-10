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
    'water_leak':         'water',
    'is_dark':            None,
    'vibration_detected': 'vibration',
    'light_on':           'light_relay',
    'fan_on':             'fan_relay',
    'cutoff_on':          'cutoff_relay',
}


@api_view(['POST'])
@permission_classes([AllowAny])
def ingest_sensor_data(request):
    # Authenticate device via headers
    device_key = request.headers.get('X-Device-Key')
    if not device_key:
        return Response({"error": "Device key missing"}, status=status.HTTP_401_UNAUTHORIZED)
        
    try:
        from devices.models import Device
        device = Device.objects.get(device_key=device_key, is_active=True)
    except Device.DoesNotExist:
        return Response({"error": "Invalid or inactive device"}, status=status.HTTP_401_UNAUTHORIZED)

    household = device.household
    serializer = SensorBulkIngestSerializer(data=request.data)
    
    if serializer.is_valid():
        data = serializer.validated_data
        
        # Save real-time numeric readings
        readings_to_create = []
        for field, value in data.items():
            if field in ['gas_detected', 'flame_detected', 'water_detected', 'car_detected']:
                continue # Handled by alert triggers
            if value is not None:
                readings_to_create.append(SensorReading(
                    device=device, sensor_type=field, value=value
                ))
        if readings_to_create:
            SensorReading.objects.bulk_create(readings_to_create)

        # Emergency Threshold & Edge Triggers
        if data.get('gas_detected'):
            broadcast_and_push_alert(household, 'gas_leak', "Dangerous gas levels detected in the kitchen!")
            
        if data.get('flame_detected'):
            broadcast_and_push_alert(household, 'fire', "Critical flame signature detected!")
            
        if data.get('water_detected'):
            broadcast_and_push_alert(household, 'water_leak', "Water leak detected near structural points.")

        # Garage Gate Edge Detection (Car Presence)
        if data.get('car_detected'):
            # Check if there isn't already an active car_detected alert in the last 2 minutes to prevent spam
            from django.utils import timezone
            import datetime
            two_mins_ago = timezone.now() - datetime.timedelta(minutes=2)
            recent_car_alert = Alert.objects.filter(
                household=household, 
                type='car_detected', 
                created_at__gte=two_mins_ago
            ).exists()
            
            if not recent_car_alert:
                broadcast_and_push_alert(household, 'car_detected', "Vehicle detected approaching the garage gate.")

        return Response({"status": "success", "message": "Data processed successfully"}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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

def broadcast_and_push_alert(household, alert_type, message):
    """Helper to save alert, push to FCM, and broadcast over WebSocket simultaneously"""
    alert = Alert.objects.create(
        household=household,
        type=alert_type,
        message=message,
        severity='high'
    )
    
    # 1. Broadcast to in-app WebSockets
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"alerts_{household.id}",
        {
            "type": "alert_message",
            "message": {
                "id": alert.id,
                "type": alert.type,
                "message": alert.message,
                "severity": alert.severity,
                "is_resolved": alert.is_resolved,
                "created_at": alert.created_at.strftime("%Y-%m-%dT%H:%M:%SZ")
            }
        }
    )
    
    # 2. Push to Android Mobile App via FCM
    send_alert_push(household, f"🚨 SmartNest Alert", message)
    return alert