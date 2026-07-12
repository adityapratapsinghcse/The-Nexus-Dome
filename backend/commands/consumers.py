async def garage_prompt(self, event):
        await self.send_json({"kind": "garage_prompt", **event["message"]})