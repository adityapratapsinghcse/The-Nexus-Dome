from celery import shared_task


@shared_task
def healthcheck_task():
    """Simple task to confirm Celery is alive - useful for Postman/manual testing."""
    return "Celery is working ✅"