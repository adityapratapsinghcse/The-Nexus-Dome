from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .models import Device, Command, EnergyLog
from .serializers import DeviceSerializer, CommandSerializer, EnergyLogSerializer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

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
    (e.g. unlock door, turn light on/off).
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