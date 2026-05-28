from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone
from api.models import Tenant, UserProfile, ActivityRecord, AuditLog

class Command(BaseCommand):
    help = 'Seeds initial multi-tenant enterprise ESG mock data'

    def handle(self, *args, **options):
        self.stdout.write("Seeding Breathe ESG Platform mock database...")

        # 1. Clear existing objects to keep database fresh
        AuditLog.objects.all().delete()
        ActivityRecord.objects.all().delete()
        UserProfile.objects.all().delete()
        User.objects.all().delete()
        Tenant.objects.all().delete()

        # 2. Create Tenants (Corporate Clients)
        gc = Tenant.objects.create(name="GreenCorp Industries", domain="greencorp.com")
        ev = Tenant.objects.create(name="EcoVest Global", domain="ecovest.com")
        self.stdout.write(f"Created Tenants: {gc.name}, {ev.name}")

        # 3. Create Users with REAL email/password credentials
        # ── ADMIN ──
        admin_user = User.objects.create_user(
            username='admin',
            email='admin@breathe.com',
            password='admin123'
        )
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()
        admin_profile = UserProfile.objects.create(user=admin_user, tenant=gc, role='ADMIN')
        # Admin gets access to all tenants
        admin_profile.assigned_tenants.set([gc, ev])
        self.stdout.write("  Created ADMIN: admin@breathe.com / admin123")

        # ── ANALYST ──
        analyst_user = User.objects.create_user(
            username='analyst1',
            email='analyst1@breathe.com',
            password='analyst123'
        )
        analyst_profile = UserProfile.objects.create(user=analyst_user, tenant=gc, role='ANALYST')
        # Analyst starts with access to GreenCorp only (admin can add more later)
        analyst_profile.assigned_tenants.set([gc])
        self.stdout.write("  Created ANALYST: analyst1@breathe.com / analyst123")

        # ── CLIENT ──
        client_user = User.objects.create_user(
            username='client1',
            email='client1@breathe.com',
            password='client123'
        )
        client_profile = UserProfile.objects.create(user=client_user, tenant=gc, role='CLIENT')
        self.stdout.write("  Created CLIENT: client1@breathe.com / client123")

        # 4. Cleared all mock activity records to ensure a clean slate for fresh uploads
        self.stdout.write("Pruned pre-populated mock ESG ledger entries. Database is now pristine and ready for fresh uploads!")

        self.stdout.write(self.style.SUCCESS("Successfully seeded multi-tenant mock data!"))
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== LOGIN CREDENTIALS ==="))
        self.stdout.write("  ADMIN:   admin@breathe.com     / admin123")
        self.stdout.write("  ANALYST: analyst1@breathe.com  / analyst123")
        self.stdout.write("  CLIENT:  client1@breathe.com   / client123")
