import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from accounts.models import Membership


@database_sync_to_async
def user_belongs_to_household(user, household_id):
    if user is None or not user.is_authenticated:
        return False
    return Membership.objects.filter(user=user, household_id=household_id).exists()


class SensorConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.household_id = self.scope['url_route']['kwargs']['household_id']
        user = self.scope.get('user')

        allowed = await user_belongs_to_household(user, self.household_id)
        if not allowed:
            await self.close(code=4401)
            return

        self.group_name = f"sensors_{self.household_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def sensor_update(self, event):
        await self.send(text_data=json.dumps(event['data']))


class AlertConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.household_id = self.scope['url_route']['kwargs']['household_id']
        user = self.scope.get('user')

        allowed = await user_belongs_to_household(user, self.household_id)
        if not allowed:
            await self.close(code=4401)
            return

        self.group_name = f"alerts_{self.household_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def alert_update(self, event):
        # FIX: backend sends event['message'], not event['data']
        payload = dict(event['message'])
        payload['kind'] = 'alert'
        await self.send(text_data=json.dumps(payload))

    async def garage_prompt(self, event):
        # FIX: this handler didn't exist before — every car_detected
        # broadcast crashed the socket with AttributeError.
        payload = dict(event['message'])
        payload['kind'] = 'garage_prompt'
        await self.send(text_data=json.dumps(payload))

    async def garage_status_update(self, event):
        # Pushes garage_status changes that happen server-side after the
        # initial prompt (e.g. the ESP32 acking the open/deny command and
        # the status resetting to 'vacant') so the Security page updates
        # live instead of only on next page load.
        payload = dict(event['message'])
        payload['kind'] = 'garage_status'
        await self.send(text_data=json.dumps(payload))