from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from devices.models import Device
from .models import Command

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def garage_confirm(request):
    """
    POST /api/commands/garage/confirm/
    body: { "device_id": 1, "confirm": true|false }
    """
    device_id = request.data.get('device_id')
    confirm = request.data.get('confirm')

    try:
        device = Device.objects.get(
            id=device_id,
            household__memberships__user=request.user,
        )
    except Device.DoesNotExist:
        return Response({"error": "Device not found"}, status=404)

    if confirm:
        device.garage_status = 'occupied'
        Command.objects.create(device=device, action='open_garage')
    else:
        device.garage_status = 'vacant'

    device.save(update_fields=['garage_status'])
    return Response({"status": "ok", "garage_status": device.garage_status})