import json
from channels.generic.websocket import AsyncWebsocketConsumer


class SensorConsumer(AsyncWebsocketConsumer):
    """
    ws://domain/ws/sensors/<household_id>/
    Every browser/mobile client viewing a household's dashboard connects here.
    """

    async def connect(self):
        self.household_id = self.scope['url_route']['kwargs']['household_id']
        self.group_name = f"sensors_{self.household_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Called when something sends a message to this group (from sensors/views.py)
    async def sensor_update(self, event):
        await self.send(text_data=json.dumps(event['data']))


class AlertConsumer(AsyncWebsocketConsumer):
    """
    ws://domain/ws/alerts/<household_id>/
    """

    async def connect(self):
        self.household_id = self.scope['url_route']['kwargs']['household_id']
        self.group_name = f"alerts_{self.household_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def alert_update(self, event):
        await self.send(text_data=json.dumps(event['data']))