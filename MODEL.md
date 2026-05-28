# Data Model Architecture

The data model for Breathe ESG was designed with a focus on **data integrity, auditability, and clear boundaries**. We prioritized a sharp, strict schema over a flexible schema to ensure that compliance data is defensible during an audit.

## Multi-Tenancy
We implemented logical multi-tenancy at the row level rather than isolated databases. 
- **`Tenant` Model**: Represents a client organization.
- Every `User` and `ActivityRecord` is strictly bound to a `Tenant` via a Foreign Key.
- **Access Control**: The Django ViewSets strictly filter `ActivityRecord.objects.filter(tenant=request.user.tenant)`. This ensures cross-tenant data leakage is impossible at the ORM layer. Analysts can be assigned to multiple tenants for review purposes via a Many-to-Many relationship (`assigned_tenants`).

## Scope 1/2/3 Categorization & Source-of-Truth
- The `ActivityRecord` table is the central source of truth. 
- Rather than throwing away the client's messy original data, we store the **exact original row** in a `raw_payload` `JSONField`. If an auditor ever questions how a number was derived, we can produce the exact raw dictionary that came from the client's source system.
- `scope_category` and `source_system` are immutable fields assigned at the moment of ingestion by the respective parser.

## Unit Normalization
To prevent analytical errors downstream, we normalize all quantities into base scientific units at the point of ingestion:
- **Volume**: Liters (L)
- **Distance**: Kilometers (km)
- **Energy**: Kilowatt-hours (kWh)
- The raw value and raw unit are preserved (`raw_value`, `raw_unit`), but the `normalized_value` and `normalized_unit` are what we use to calculate the `calculated_co2e_kg`. This separation prevents double-conversion bugs.

## Audit Trail & Locking
ESG data is financial data. It must be auditable.
- **`AuditLog` Table**: Any manual correction made by an analyst triggers a double-entry log in the `AuditLog` table, capturing the exact field changed, the old value, the new value, the timestamp, the user, and a required `reason`.
- **Immutability**: Once an analyst approves a record, `is_locked` is set to `True`. The Django model's `clean()` method physically prevents any further `save()` operations on a locked record, ensuring it cannot be tampered with prior to a final audit.
