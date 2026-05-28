import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'breathe_esg_backend.settings')
django.setup()

from api.models import ActivityRecord, AuditLog

print(f"Deleting {AuditLog.objects.count()} AuditLogs...")
AuditLog.objects.all().delete()

print(f"Deleting {ActivityRecord.objects.count()} ActivityRecords...")
ActivityRecord.objects.all().delete()

print("Done.")
