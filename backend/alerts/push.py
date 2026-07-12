import json
import firebase_admin
from firebase_admin import credentials, messaging
from django.conf import settings

_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if _firebase_app is None:
        cred_json = settings.FIREBASE_CREDENTIALS_JSON
        cred = credentials.Certificate(json.loads(cred_json))
        _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app

def send_alert_push(household_id, title, body):
    """
    Sends a push notification to every member of a household who has
    registered an FCM token. Silently skips if Firebase isn't configured
    or a token is invalid - a failed push should never break the alert flow.
    """
    from accounts.models import Membership

    try:
        get_firebase_app()
    except Exception as e:
        print(f"⚠️ Firebase not configured, skipping push: {e}")
        return

    tokens = list(
        Membership.objects.filter(household_id=household_id, fcm_token__isnull=False)
        .exclude(fcm_token='')
        .values_list('fcm_token', flat=True)
    )
    if not tokens:
        return

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        tokens=tokens,
    )
    try:
        # FIX: messaging.send_multicast was removed from the firebase-admin
        # Python SDK in v6.2+ (requirements.txt pins >=6.5, so Railway always
        # installs a version without it). Calling it raised AttributeError
        # on every single push, every time — silently swallowed by the
        # except block below, so FCM never actually delivered anything even
        # with valid credentials and valid tokens. send_each_for_multicast
        # is the current replacement with the same MulticastMessage input.
        response = messaging.send_each_for_multicast(message)
        if response.failure_count:
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    print(f"⚠️ Push failed for token …{tokens[idx][-8:]}: {resp.exception}")
    except Exception as e:
        print(f"⚠️ Push send failed: {e}")