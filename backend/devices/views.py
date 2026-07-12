from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import Device, Command, EnergyLog
from .serializers import DeviceSerializer, CommandSerializer, EnergyLogSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from collections import defaultdict
from datetime import timedelta
from django.utils import timezone
from sensors.models import SensorReading
from .models import RFIDCard
from .serializers import RFIDCardSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def device_list_create(request):
    user_households = request.user.memberships.values_list('household_id', flat=True)

    if request.method == 'GET':
        devices = Device.objects.filter(household_id__in=user_households)
        serializer = DeviceSerializer(devices, many=True)
        return Response(serializer.data)

    household_id = request.data.get('household')
    if household_id not in user_households:
        return Response({"error": "You don't belong to that household"}, status=403)

    serializer = DeviceSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def send_command(request):
    """
    POST /api/commands/send/
    Frontend calls this to tell the ESP32 to do something
    (e.g. unlock door, turn light on/off, open/deny garage gate).
    """
    serializer = CommandSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(status='pending')
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def pending_commands(request):
    """
    GET /api/commands/pending/?device_id=1
    ESP32 polls this endpoint to check if the dashboard sent it anything to do.
    """
    device_id = request.query_params.get('device_id')
    if not device_id:
        return Response({"error": "device_id query param required"}, status=400)

    commands = Command.objects.filter(device_id=device_id, status='pending')
    serializer = CommandSerializer(commands, many=True)
    return Response(serializer.data)


# Command actions that resolve a garage "awaiting confirmation" state either way
GARAGE_RESOLVING_ACTIONS = {'garage_open', 'garage_deny', 'open_gate', 'deny_gate', 'close_gate'}


@api_view(['POST'])
def acknowledge_command(request):
    """
    POST /api/commands/ack/
    Body: {"command_id": 5}
    ESP32 calls this after executing a command, so it doesn't run twice.
    """
    command_id = request.data.get('command_id')
    try:
        command = Command.objects.get(id=command_id)
    except Command.DoesNotExist:
        return Response({"error": "Command not found"}, status=404)

    command.status = 'acknowledged'
    command.acknowledged_at = timezone.now()
    command.save()

    if command.action in GARAGE_RESOLVING_ACTIONS and command.device.garage_status in ('pending', 'opening'):
        command.device.garage_status = 'vacant'
        command.device.save(update_fields=['garage_status'])

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"alerts_{command.device.household_id}",
            {
                "type": "garage_status_update",
                "message": {
                    "device_id": command.device.id,
                    "garage_status": command.device.garage_status,
                },
            },
        )

    return Response(CommandSerializer(command).data)


@api_view(['GET'])
def energy_daily(request):
    """
    GET /api/energy/daily/?device_id=1
    Returns energy logs, most recent first.
    """
    device_id = request.query_params.get('device_id')
    logs = EnergyLog.objects.all()
    if device_id:
        logs = logs.filter(device_id=device_id)
    serializer = EnergyLogSerializer(logs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def energy_summary(request):
    """
    GET /api/energy/summary/?device_id=1
    Integrates real ACS712 current readings (Amps) into Watt-hours,
    assuming 230V mains. Returns today's total and a 7-day daily breakdown.
    """
    user_households = request.user.memberships.values_list('household_id', flat=True)
    device_id = request.query_params.get('device_id')

    devices = Device.objects.filter(household_id__in=user_households)
    if device_id:
        devices = devices.filter(id=device_id)
    if not devices.exists():
        return Response({"error": "Device not found or not in your household"}, status=404)

    seven_days_ago = timezone.now() - timedelta(days=7)
    readings = SensorReading.objects.filter(
        device__in=devices, sensor_type='current', timestamp__gte=seven_days_ago
    ).order_by('timestamp')

    daily_kwh = defaultdict(float)
    prev = None
    for r in readings:
        if prev is not None:
            dt_hours = (r.timestamp - prev.timestamp).total_seconds() / 3600
            if 0 < dt_hours < 1:
                avg_amps = (r.value + prev.value) / 2
                watts = avg_amps * 230
                kwh = (watts * dt_hours) / 1000
                day_key = r.timestamp.date().isoformat()
                daily_kwh[day_key] += kwh
        prev = r

    today_key = timezone.now().date().isoformat()
    today_kwh = daily_kwh.get(today_key, 0.0)

    last_7_days = []
    for i in range(6, -1, -1):
        day = (timezone.now() - timedelta(days=i)).date()
        last_7_days.append({"day": day.strftime('%a'), "date": day.isoformat(), "kwh": round(daily_kwh.get(day.isoformat(), 0.0), 3)})

    return Response({
        "today_kwh": round(today_kwh, 3),
        "week_total_kwh": round(sum(daily_kwh.values()), 3),
        "daily_breakdown": last_7_days,
        "has_data": readings.exists(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_push_token(request):
    fcm_token = request.data.get('fcm_token')
    if not fcm_token:
        return Response({"error": "fcm_token required"}, status=400)

    from accounts.models import Membership
    Membership.objects.filter(user=request.user).update(fcm_token=fcm_token)
    return Response({"status": "registered"})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def rfid_card_list_create(request):
    user_households = request.user.memberships.values_list('household_id', flat=True)
    if request.method == 'GET':
        cards = RFIDCard.objects.filter(household_id__in=user_households)
        return Response(RFIDCardSerializer(cards, many=True).data)

    if request.data.get('household') not in user_households:
        return Response({"error": "Not your household"}, status=403)
    serializer = RFIDCardSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def rfid_card_detail(request, card_id):
    user_households = request.user.memberships.values_list('household_id', flat=True)
    try:
        card = RFIDCard.objects.get(id=card_id, household_id__in=user_households)
    except RFIDCard.DoesNotExist:
        return Response({"error": "Not found"}, status=404)

    if request.method == 'DELETE':
        card.delete()
        return Response(status=204)

    serializer = RFIDCardSerializer(card, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def garage_confirm(request):
    """
    POST /api/commands/garage/confirm/
    Body: {"device_id": 1, "confirm": true}
    Called from the Security page's garage prompt modal when the user
    answers "Yes, open" or "No, keep closed" to a car-detected event.
    """
    device_id = request.data.get('device_id')
    confirm = request.data.get('confirm')

    if device_id is None or confirm is None:
        return Response({"error": "device_id and confirm are required"}, status=400)

    user_households = request.user.memberships.values_list('household_id', flat=True)
    try:
        device = Device.objects.get(id=device_id, household_id__in=user_households)
    except Device.DoesNotExist:
        return Response({"error": "Device not found or not in your household"}, status=404)

    action = 'garage_open' if confirm else 'garage_deny'
    Command.objects.create(device=device, action=action, status='pending')

    # Optimistic transitional state — acknowledge_command() clears this back
    # to 'vacant' once the ESP32 actually reports the action was carried out.
    device.garage_status = 'opening' if confirm else 'vacant'
    device.save(update_fields=['garage_status'])

    return Response({"garage_status": device.garage_status})