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

def send_test_push(user):
    """
    Diagnostic version of send_alert_push for a single user, used by
    /api/devices/test-push/. Returns a dict describing exactly which stage
    failed instead of silently swallowing everything, so "is FCM working"
    can be answered from one API call instead of guessing.
    """
    from accounts.models import Membership

    membership = Membership.objects.filter(user=user).exclude(fcm_token__isnull=True).exclude(fcm_token='').first()
    if not membership:
        return {
            "ok": False,
            "stage": "token",
            "detail": "No fcm_token stored for this user yet. Open the Android app and log in/reopen it "
                       "so setupPushNotifications.js can register — check Logcat for "
                       "'Push token registered with backend' or 'Push registration error'.",
        }

    try:
        get_firebase_app()
    except Exception as e:
        return {
            "ok": False,
            "stage": "credentials",
            "detail": f"FIREBASE_CREDENTIALS_JSON is missing or invalid on the server: {e}",
        }

    message = messaging.Message(
        notification=messaging.Notification(title="SmartNest test", body="If you see this, FCM is working end to end."),
        token=membership.fcm_token,
    )
    try:
        message_id = messaging.send(message)
        return {"ok": True, "stage": "sent", "detail": f"Sent, message id: {message_id}"}
    except Exception as e:
        return {
            "ok": False,
            "stage": "send",
            "detail": f"Firebase rejected the send (often a stale/uninstalled-app token): {e}",
        }


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