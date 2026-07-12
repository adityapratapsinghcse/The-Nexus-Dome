from django.contrib import admin
from .models import Device, Command, EnergyLog, RFIDCard

admin.site.register(Device)
admin.site.register(Command)
admin.site.register(EnergyLog)
admin.site.register(RFIDCard)