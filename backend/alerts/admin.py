from django.contrib import admin
from .models import Alert, AccessLog

admin.site.register(Alert)
admin.site.register(AccessLog)