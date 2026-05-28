# Product Requirement Document (PRD)
## Enterprise ESG Ingestion, Normalization, & Audit Platform

> **Document Status:** SIGNED & APPROVED  
> **Target Timeline:** 2-Day Accelerated Prototype (Today & Tomorrow)  
> **Primary Persona:** Senior Sustainability & Compliance Analyst  
> **Design Theme:** Simple, Professional Enterprise (Light Green & White)  
> **Core Stack:** Django REST Framework (DRF) + React (Vite) + TailwindCSS  

---

## 1. Executive Summary & Vision

### 1.1 Objective
Breathe ESG is onboarding a new enterprise client whose activity and emissions data is isolated across three disparate legacy systems: SAP exports, utility portal CSVs, and corporate travel logs. 

This platform serves as the **unified, non-slop compliance engine** that ingests raw corporate activity data, standardizes it into a unified carbon-equivalent ($CO_2e$) schema, maps it to standard GHG Protocol Scopes, and provides a secure, audit-ready verification dashboard for analysts. Once verified, data is cryptographically locked to ensure complete database immutability.

### 1.2 "Anti-Slop" Philosophy
We reject generic AI-generated templates, dummy variables, and "toy data." Every architectural decision in this document is selected to mirror real-world corporate data systems, handling inconsistent formats, non-calendar billing cycles, missing travel distance fields, and multi-tenant security barriers. 
The system operates under a **"Double-Entry Traceability"** pattern: the raw payload is stored in its exact incoming state (e.g., intact German SAP headers) to serve as a verifiably untampered "black box" side-by-side with its normalized, parsed equivalent.

---

## 2. Technical Stack Specification

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ENTERPRISE SYSTEM ARCHITECTURE                  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [ React (Vite) Frontend ]  ───(JWT / REST APIs)───► [ Django REST ]  │
│         │                                                   │          │
│         ▼                                                   ▼          │
│   Tailwind CSS                                        PostgreSQL /     │
│   Theme: Light Green & White                          SQLite DB        │
│   (Grid System / Tabular Numbers)                     (Multi-Tenant)   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Backend Core
* **Framework:** **Django 5.x** + **Django REST Framework (DRF)**.
* **Database:** **PostgreSQL** (production) / **SQLite** (local rapid prototyping).
* **API Pattern:** RESTful HTTP JSON API.
* **Task Queue:** Celery + Redis (for handling complex asynchronous ingestion files and distance calculations).

### 2.2 Frontend Core
* **Framework:** **React 18+** with **Vite** (for fast build times and hot reloading).
* **Styling:** **TailwindCSS** configured with a strict "No AI-Slop" Enterprise palette:
  * Primary: Deep Forest Green (`#1E3F20` / `rgb(30, 63, 32)`)
  * Secondary/Success: Mint Green (`#2E7D32` / `rgb(46, 125, 50)`)
  * Surface Neutral: Crisp White (`#FFFFFF`) with soft Sage Gray borders and backgrounds (`#F4F8F4`).
  * Tabular Typography: `font-mono` and `font-variant-numeric: tabular-nums` for precise column alignments.

---

## 3. Real-World Source Format Specifications (No Toy Data)

### 3.1 SAP MM (Materials Management) Fuel & Procurement (Scope 1)
* **Real-World Shape:** Flat CSV or OData payloads mimicking standard SAP MM tables (`MSEG` - Document Segment: Material, `EKPO` - Purchasing Document Item).
* **Exact Column Mappings (German Legacy Headers):**
  * `BUDAT` (Posting Date) $\rightarrow$ Date format `YYYYMMDD` (e.g., `20260430`).
  * `WERKS` (Plant Code) $\rightarrow$ Meaningless alphanumeric identifier (e.g., `US_PLANT_4402`).
  * `MATNR` (Material Number) $\rightarrow$ String ID (e.g., `DIESEL_NO2_01`).
  * `MENGE` (Quantity) $\rightarrow$ Raw floating-point number.
  * `MEINS` (Base Unit of Measure) $\rightarrow$ SAP units: `L` (Liters), `TO` (Metric Tons), `GAL` (US Gallons).
* **Real Ingestion Complication:** The ingestion engine must translate these German headers, resolve the plant code `WERKS` via a client lookup table to identify regional emission profiles, and normalize the varying units to standard metric masses or volumes.

### 3.2 Utility Portal Electricity Data (Scope 2)
* **Real-World Shape:** Portal CSV billing exports typically compiled from utility providers.
* **Exact Column Mappings:**
  * `Account_Number` $\rightarrow$ Unique identifier for utility billing.
  * `Meter_Number` $\rightarrow$ Physical meter ID.
  * `Billing_Start_Date` $\rightarrow$ ISO-8601 Date (`YYYY-MM-DD`).
  * `Billing_End_Date` $\rightarrow$ ISO-8601 Date (`YYYY-MM-DD`).
  * `Usage_kWh` $\rightarrow$ Numeric energy reading.
  * `Tariff_Code` $\rightarrow$ Standard energy rate classification (e.g., `E-19_COMMERCIAL`).
* **Real Ingestion Complication:** Billing intervals rarely align with clean calendar months (e.g., a bill running from March 12 to April 11). The normalizer must dynamically prorate this consumption to clean calendar months by calculating a daily consumption rate:
  $$\text{Daily Consumption} = \frac{\text{Usage\_kWh}}{\text{Billing\_End\_Date} - \text{Billing\_Start\_Date}}$$
  This daily value is then distributed proportionally across the respective calendar months.

### 3.3 Corporate Travel Logs - Flights & Hotels (Scope 3)
* **Real-World Shape:** Standard flight segment ledger exported from platforms like Navan or SAP Concur.
* **Exact Column Mappings:**
  * `Employee_ID` $\rightarrow$ String identification.
  * `Segment_Departure_Airport` $\rightarrow$ IATA airport code (e.g., `JFK`).
  * `Segment_Arrival_Airport` $\rightarrow$ IATA airport code (e.g., `LHR`).
  * `Cabin_Class` $\rightarrow$ Cabin class limits: `ECONOMY`, `PREM_ECONOMY`, `BUSINESS`, `FIRST`.
  * `Distance_km` $\rightarrow$ Real distance value. If missing, calculated programmatically.
  * `Hotel_Room_Nights` $\rightarrow$ Integer representing lodging duration (for Hotel scope elements).
* **Real Ingestion Complication:** Travel logs frequently omit direct flight distances. The ingestion engine must support fallback coordinate lookups (IATA code coordinate map) and perform a great-circle calculation using the **Haversine Formula**:
  $$d = 2r \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$
  Where $r = 6371\text{ km}$ (Earth's radius), and seat class emissions must be scaled by standard multipliers (e.g., Business class has $2.9\times$ the spatial/weight footprint of Economy).

---

## 4. Normalization & Carbon Calculation Logic

Every record processed by the platform is converted into a standard emission target: **Kilograms of $CO_2$ Equivalent ($kg\ CO_2e$)**.

```
  ┌────────────────────────────────────────────────────────┐
  │                 CARBON CONVERSION FLOW                 │
  └───────────────────────────┬────────────────────────────┘
                              │
     ┌────────────────────────┼────────────────────────┐
     ▼                        ▼                        ▼
[ Scope 1 (Fuel) ]      [ Scope 2 (Grid) ]      [ Scope 3 (Travel) ]
  • Convert Liters        • Prorate dates to      • Lookup IATA coords
    or Tons to standard     calendar months         • Calculate distance
    volume (Liters)       • Map facility code       via Haversine
  • Apply EPA Fuel          to regional eGRID     • Scale by Cabin Class
    Factor (kg/L)           emission rate (kg/kWh)  factor (kg/pkm)
     │                        │                        │
     └────────────────────────┼────────────────────────┘
                              ▼
           ┌──────────────────────────────────────┐
           │  ActivityRecord.calculated_co2e_kg  │
           └──────────────────────────────────────┘
```

### 4.1 Scope 1: Fuel Conversion (SAP Input)
* **Standard Target Unit:** Liters ($L$).
* **Conversion Constants:**
  * Metric Tons Diesel $\rightarrow$ Liters: $1\text{ metric ton} \approx 1190\text{ Liters}$ (density of ~0.84 kg/L).
  * Gallons Diesel $\rightarrow$ Liters: $1\text{ US Gallon} \approx 3.78541\text{ Liters}$.
* **Emission Factor (EPA/DEFRA Standard):**
  * Diesel (No. 2): $2.68\text{ kg } CO_2e / \text{Liter}$.
* **Formula:**
  $$\text{Emissions } (kg\ CO_2e) = \text{Volume in Liters} \times 2.68$$

### 4.2 Scope 2: Electricity Grid Conversion (Utility Input)
* **Standard Target Unit:** Kilowatt-Hours ($kWh$).
* **Emission Factors (Grid Subregions):**
  * Factory Code `US_PLANT_4402` (eGRID Subregion NYUP): $0.116\text{ kg } CO_2e / kWh$.
  * Factory Code `DE_PLANT_091` (German Grid Average): $0.380\text{ kg } CO_2e / kWh$.
* **Formula:**
  $$\text{Emissions } (kg\ CO_2e) = \text{Prorated Monthly Consumption } (kWh) \times \text{Regional Grid Factor}$$

### 4.3 Scope 3: Flight Seat Class Scaling (Travel Input)
* **Standard Target Unit:** Passenger-Kilometers ($pkm$).
* **Seating Class Carbon Multipliers (DEFRA Standard):**
  * `ECONOMY`: $1.0\times$ baseline ($0.15\text{ kg } CO_2e / pkm$).
  * `PREM_ECONOMY`: $1.6\times$ baseline ($0.24\text{ kg } CO_2e / pkm$).
  * `BUSINESS`: $2.9\times$ baseline ($0.435\text{ kg } CO_2e / pkm$).
  * `FIRST`: $4.0\times$ baseline ($0.60\text{ kg } CO_2e / pkm$).
* **Formula:**
  $$\text{Emissions } (kg\ CO_2e) = \text{Distance } (km) \times \text{Base Factor } (0.15) \times \text{Class Multiplier}$$

---

## 5. Database Schema & Multi-Tenant Integrity

### 5.1 Strict Multi-Tenancy Strategy
* **Database Level Constraint:** Every entity is directly tied to a `Tenant` model via a foreign key `tenant_id`.
* **Django Middleware Security:** To enforce complete logical isolation and prevent "slop queries" from leaking other customers' data, a dynamic request middleware injects a tenant filter constraint on **all** read and write operations.
* **Encryption Guard:** Approved records (`is_locked = True`) are blocked at the Django model level `save()` method, throwing a validation error on any modifications.

### 5.2 Database Schemas (Model Details)

```python
# Django Model Schemas Outline

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    role = models.CharField(max_length=50, choices=[('ANALYST', 'Analyst'), ('AUDITOR', 'Auditor')])

class ActivityRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    source_system = models.CharField(max_length=50) # 'SAP' | 'UTILITY' | 'TRAVEL'
    scope_category = models.CharField(max_length=50) # 'Scope 1' | 'Scope 2' | 'Scope 3'
    
    # Double-Entry Payload Track
    raw_payload = models.JSONField() # Unaltered input payload stored as JSON
    raw_value = models.DecimalField(max_digits=15, decimal_places=4)
    raw_unit = models.CharField(max_length=50)
    
    # Normalized Core Metrics
    normalized_value = models.DecimalField(max_digits=15, decimal_places=4)
    normalized_unit = models.CharField(max_length=50)
    calculated_co2e_kg = models.DecimalField(max_digits=15, decimal_places=4)
    
    # Interval Details
    period_start = models.DateField()
    period_end = models.DateField()
    plant_code = models.CharField(max_length=100)
    
    # Status Audit States
    status = models.CharField(max_length=50, default='PENDING') # PENDING, SUSPICIOUS, FAILED, APPROVED
    status_reason = models.TextField(blank=True, null=True)
    is_locked = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    record = models.ForeignKey(ActivityRecord, on_delete=models.CASCADE)
    action = models.CharField(max_length=50) # INGEST, EDIT, APPROVE, REJECT
    field_modified = models.CharField(max_length=100, blank=True, null=True)
    original_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    reason = models.TextField()
    performed_by = models.ForeignKey(User, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
```

---

## 6. High-Precision Validation & Anomaly Detection Rules

The parser automatically grades incoming activity rows before showing them to the sustainability analyst:

1. **`FAILED` Criteria:**
   * Unparseable datatypes (e.g., non-numeric values in consumption fields).
   * Missing critical keys (e.g., flight record with neither airport codes nor raw distance).
   * Inverted billing intervals (`Billing_End_Date` < `Billing_Start_Date`).
2. **`SUSPICIOUS` Criteria:**
   * **The 150% Consumption Threshold:** Energy or fuel usage exceeds the running 12-month average for that specific facility or plant by $>150\%$.
   * **Duplicate Meter overlapping:** Two utility records for the same physical `Meter_Number` overlap in their billing dates.
   * **Missing Cabin Class Multiplier:** Cabin class omitted from flight logs, requiring fallback to default Economy scaling (flagged for manual sign-off).
3. **`PENDING` Criteria:**
   * Data successfully converted, formatted, and computed with no anomalies found. Waiting for analyst sign-off.
4. **`APPROVED` Criteria:**
   * Locked database row, `is_locked = True`, immune to any API modifications.

---

## 7. Scope & Clear Tradeoffs (TRADEOFFS.md Blueprint)

### 7.1 Deliverable Features (Fully Built & In-Scope)
* **Secure Login Screen:** Standard Django session and JWT-based analyst login with strict tenant boundary enforcement.
* **CSV Bulk Upload Ingestion:** Simple, reliable CSV parser pages representing the three exact SAP, Utility, and Travel file mappings detailed in Section 3.
* **Spreadsheet Reconciliation Dashboard:** Clean enterprise-grade Light Green and White grid. Displays raw uploaded entries next to normalized metrics with inline anomaly edits.
* **Auditor Timeline drawer:** A side-out timeline showing the full database audit log footprint of the selected row.
* **Immutable approvals:** Database row locks triggered dynamically upon Analyst sign-off.

### 7.2 Explicitly Out-of-Scope (Excluded for Practicality)
To deliver a robust, non-slop product within the accelerated 2-day timeline, three deliberate engineering tradeoffs have been made:
1. **Third-Party SAML SSO Integration:** Standard secure login accounts will be used instead of custom SAML or active corporate directories.
2. **Direct Enterprise SAP API Connections:** SAP datasets will be uploaded via flat CSV reports representing SAP MM outputs, rather than building live BAPI endpoint integrations.
3. **AI PDF Bill Parsing:** Energy bills will be parsed via standard structured portal exports (CSVs) instead of volatile, error-prone OCR models.
