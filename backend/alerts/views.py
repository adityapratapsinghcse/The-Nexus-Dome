from rest_framework.decorators import api_view ,permission_classes ,authentication_classes
from rest_framework.response import Response
from .models import Alert, AccessLog
from .serializers import AlertSerializer, AccessLogSerializer
from rest_framework.permissions import IsAuthenticated ,AllowAny
from devices.authentication import DeviceKeyAuthentication
from devices.models import Device
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .push import send_alert_push


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alert_list(request):
    """
    GET /api/alerts/?is_read=false&device_id=1
    """
    user_households = request.user.memberships.values_list('household_id', flat=True)
    devices = Device.objects.filter(household_id__in=user_households)
    alerts = Alert.objects.filter(device__in=devices)
    device_id = request.query_params.get('device_id')
    if device_id:
        alerts = alerts.filter(device_id=device_id)
    is_read = request.query_params.get('is_read')
    if is_read is not None:
        alerts = alerts.filter(is_read=(is_read.lower() == 'true'))
    serializer = AlertSerializer(alerts, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def mark_alert_read(request):
    """
    POST /api/alerts/read/
    Body: {"alert_id": 3}
    """
    alert_id = request.data.get('alert_id')
    try:
        alert = Alert.objects.get(id=alert_id)
    except Alert.DoesNotExist:
        return Response({"error": "Alert not found"}, status=404)

    alert.is_read = True
    alert.save()
    return Response(AlertSerializer(alert).data)


@api_view(['POST'])
@authentication_classes([DeviceKeyAuthentication])
@permission_classes([AllowAny])
def verify_access(request):
    """
    POST /api/access/verify/   Header: X-Device-Key
    Body: {"rfid_uid": "A1B2C3D4"}
    ESP32 sends the raw UID it just scanned — backend looks it up and
    returns the decision. ESP32 only opens the servo if granted=true.
    """
    device = request.auth
    if device is None:
        return Response({"error": "Missing or invalid X-Device-Key header"}, status=401)

    uid = request.data.get('rfid_uid', '').upper()
    from devices.models import RFIDCard
    granted = RFIDCard.objects.filter(household=device.household, uid=uid, is_active=True).exists()

    log = AccessLog.objects.create(device=device, rfid_uid=uid, method='rfid', granted=granted)

    channel_layer = get_channel_layer()

    if granted:
        device.door_status = 'unlocked'
        device.save(update_fields=['door_status'])
        async_to_sync(channel_layer.group_send)(
            f"alerts_{device.household_id}",
            {"type": "door_status_update", "message": {"device_id": device.id, "door_status": "unlocked"}},
        )
    alert = None
    if not granted:
        alert = Alert.objects.create(device=device, type='rfid_denied', severity='warning',
                                      message=f"Access denied for unrecognized card {uid}")
    async_to_sync(channel_layer.group_send)(
        f"alerts_{device.household_id}",
        {"type": "alert_update", "message": {
            # FIX: AlertConsumer.alert_update reads event['message'], but this
            # was sending event['data'] — every RFID scan (granted or denied)
            # was silently crashing the WebSocket broadcast with a KeyError.
            "id": alert.id if alert else None, "device_id": device.id,
            "type": "rfid_result", "granted": granted, "rfid_uid": uid,
            "message": alert.message if alert else f"Access granted to {uid}",
        }}
    )
    if not granted:
        send_alert_push(device.household_id, "Access Denied", f"Failed access attempt: UID {uid}")

    return Response({**AccessLogSerializer(log).data, "granted": granted}, status=201)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def access_log_list(request):
    """
    GET /api/access/log/?device_id=1
    """
    user_households = request.user.memberships.values_list('household_id', flat=True)
    devices = Device.objects.filter(household_id__in=user_households)

    logs = AccessLog.objects.filter(device__in=devices)
    device_id = request.query_params.get('device_id')
    if device_id:
        logs = logs.filter(device_id=device_id)

    serializer = AccessLogSerializer(logs[:20], many=True)
    return Response(serializer.data)