from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Device

STALE_THRESHOLD_SECONDS = 90  # if no data in 90s, consider device offline


@shared_task
def mark_stale_devices_offline():
    """
    Runs every 60 seconds (see CELERY_BEAT_SCHEDULE).
    If a device hasn't sent sensor data recently, flip is_online to False.
    This is what lets your dashboard show accurate online/offline status
    instead of trusting a value that's only ever set to True.
    """
    cutoff = timezone.now() - timedelta(seconds=STALE_THRESHOLD_SECONDS)
    stale_devices = Device.objects.filter(is_online=True, last_seen__lt=cutoff)

    count = stale_devices.count()
    stale_devices.update(is_online=False)

    return f"Marked {count} device(s) offline"