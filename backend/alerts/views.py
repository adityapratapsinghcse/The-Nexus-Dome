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
    POST /api/access/verify/
    Header required: X-Device-Key: <device's secret key>
    Body: {"rfid_uid": "A1B2C3D4", "method": "rfid", "granted": true}
    """
    device = request.auth
    if device is None:
        return Response({"error": "Missing or invalid X-Device-Key header"}, status=401)

    data = request.data.copy()
    log = AccessLog.objects.create(
        device=device,
        rfid_uid=data.get('rfid_uid', ''),
        method=data.get('method', 'rfid'),
        granted=data.get('granted', False),
    )

    channel_layer = get_channel_layer()

    if not log.granted:
        alert = Alert.objects.create(
            device=device,
            type='rfid_denied',
            severity='warning',
            message=f"Access denied for UID {log.rfid_uid}"
        )
        async_to_sync(channel_layer.group_send)(
            f"alerts_{device.household_id}",
            {
                "type": "alert_update",
                "data": {
                    "id": alert.id,
                    "device_id": device.id,
                    "type": alert.type,
                    "severity": alert.severity,
                    "message": alert.message,
                }
            }
        )
        # inside verify_access, right after the async_to_sync(channel_layer.group_send)(...) call:
        send_alert_push(
            device.household_id,
            title="Access Denied",
            body=f"Failed access attempt: UID {log.rfid_uid}"
        )


    return Response(AccessLogSerializer(log).data, status=201)

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