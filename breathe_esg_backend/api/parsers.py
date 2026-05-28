import csv
import io
import math
from datetime import datetime, date
from decimal import Decimal
from django.db.models import Q
from .models import ActivityRecord, AuditLog, Tenant

# High-fidelity IATA Airport Coordinates for Haversine Calculations
IATA_COORDINATES = {
    'JFK': (40.6413, -73.7781),  # New York, USA
    'LHR': (51.4700, -0.4543),   # London, UK
    'CDG': (49.0097, 2.5479),    # Paris, France
    'SIN': (1.3644, 103.9915),   # Singapore
    'SFO': (37.6213, -122.3790), # San Francisco, USA
    'HND': (35.5494, 139.7798),  # Tokyo, Japan
    'BOM': (19.0896, 72.8656),   # Mumbai, India
    'DEL': (28.5562, 77.1000),   # Delhi, India
    'BLR': (13.1986, 77.7066),   # Bengaluru, India
}

# Grid Subregion Emission Intensity Factors (kg CO2e per kWh)
GRID_EMISSION_FACTORS = {
    'US_PLANT_4402': Decimal('0.1160'), # US eGRID NYUP Subregion
    'DE_PLANT_091': Decimal('0.3800'),  # German National Grid
    'DEFAULT': Decimal('0.3500'),       # Global default grid average
}

# Fuel conversion densities and constants
DIESEL_EPA_FACTOR = Decimal('2.68')     # kg CO2e per Liter
HEAVY_FUEL_EPA_FACTOR = Decimal('3.15')  # kg CO2e per Liter

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Computes the great-circle distance between two points in kilometers.
    """
    r = 6371.0 # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.asin(math.sqrt(a))
    return r * c

def parse_decimal(value, default=None):
    if not value or str(value).strip() == '':
        return default
    try:
        # Strip commas or random spacing
        clean_val = str(value).replace(',', '').strip()
        return Decimal(clean_val)
    except:
        return None

def parse_date(value, date_format='%Y-%m-%d'):
    if not value or str(value).strip() == '':
        return None
    try:
        return datetime.strptime(str(value).strip(), date_format).date()
    except:
        return None

def ingest_sap_data(file_content, tenant, user):
    """
    Ingests SAP MM Procurement/Fuel CSV.
    Headers: BUDAT,WERKS,MATNR,MENGE,MEINS,LIFNR
    """
    csv_file = io.StringIO(file_content)
    reader = csv.DictReader(csv_file)
    records_created = []

    for row in reader:
        raw_payload = dict(row)
        budat = row.get('BUDAT', '').strip()
        werks = row.get('WERKS', '').strip()
        matnr = row.get('MATNR', '').strip()
        menge_raw = row.get('MENGE', '').strip()
        meins = row.get('MEINS', '').strip()
        lifnr = row.get('LIFNR', '').strip()

        # Initialize base model fields
        record = ActivityRecord(
            tenant=tenant,
            source_system='SAP',
            scope_category='Scope 1',
            raw_payload=raw_payload,
            raw_unit=meins,
            plant_code=werks
        )

        # Parse Date (BUDAT is YYYYMMDD in SAP MM exports)
        parsed_date = parse_date(budat, '%Y%m%d')
        if parsed_date:
            record.period_start = parsed_date
            record.period_end = parsed_date
        else:
            record.status = 'FAILED'
            record.status_reason = f"Corrupt date format: '{budat}' (Expected YYYYMMDD)"
            record.save()
            records_created.append(record)
            continue

        # Parse quantity
        qty = parse_decimal(menge_raw)
        if qty is None:
            record.status = 'FAILED'
            record.status_reason = f"Invalid raw quantity format: '{menge_raw}'"
            record.save()
            records_created.append(record)
            continue

        record.raw_value = qty

        # Normalization and unit conversion logic
        # target unit is Liters (L) for liquid fuels
        normalized_val = qty
        normalized_unit = 'L'

        if meins == 'GAL':
            # 1 Gallon = 3.78541 Liters
            normalized_val = qty * Decimal('3.78541')
            normalized_unit = 'L'
        elif meins == 'TO': # Metric Tons
            # 1 Ton of Diesel ~ 1190 Liters (approx density 0.84 kg/L)
            normalized_val = qty * Decimal('1190.0000')
            normalized_unit = 'L'
        elif meins != 'L':
            record.status = 'FAILED'
            record.status_reason = f"Unsupported SAP unit of measure: '{meins}'"
            record.save()
            records_created.append(record)
            continue

        record.normalized_value = normalized_val
        record.normalized_unit = normalized_unit

        # Emission calculation using standard EPA factor
        # Diesel standard factor is 2.68 kg CO2e/Liter
        factor = DIESEL_EPA_FACTOR
        if 'HEAVY' in matnr:
            factor = HEAVY_FUEL_EPA_FACTOR

        calculated_co2e = normalized_val * factor
        record.calculated_co2e_kg = calculated_co2e

        # Anomaly / Validation grading
        # Rule: Outlier threshold if fuel exceeds 50,000 Liters
        if normalized_val > Decimal('50000.0000'):
            record.status = 'SUSPICIOUS'
            record.status_reason = f"Outlier detected: Fuel quantity ({normalized_val:.2f} L) exceeds standard baseline threshold (50k L)."
        else:
            record.status = 'PENDING'

        record.save()

        # Log initial creation in Audit Log
        AuditLog.objects.create(
            tenant=tenant,
            record=record,
            action='INGEST',
            reason="Initial ingestion via SAP MM parser pipeline",
            performed_by=user
        )
        records_created.append(record)

    return records_created

def ingest_utility_data(file_content, tenant, user):
    """
    Ingests Electricity Utility Portal CSV.
    Headers: Account_Number,Meter_Number,Billing_Start_Date,Billing_End_Date,Usage_kWh,Tariff_Code
    """
    csv_file = io.StringIO(file_content)
    reader = csv.DictReader(csv_file)
    records_created = []

    for row in reader:
        raw_payload = dict(row)
        acc_num = row.get('Account_Number', '').strip()
        meter_num = row.get('Meter_Number', '').strip()
        start_dt_str = row.get('Billing_Start_Date', '').strip()
        end_dt_str = row.get('Billing_End_Date', '').strip()
        usage_raw = row.get('Usage_kWh', '').strip()
        tariff = row.get('Tariff_Code', '').strip()

        record = ActivityRecord(
            tenant=tenant,
            source_system='UTILITY',
            scope_category='Scope 2',
            raw_payload=raw_payload,
            raw_unit='kWh',
            normalized_unit='kWh',
            plant_code=meter_num # Mapping Meter Number as facility reference
        )

        # Parse dates
        start_date = parse_date(start_dt_str, '%Y-%m-%d')
        end_date = parse_date(end_dt_str, '%Y-%m-%d')

        if not start_date or not end_date:
            record.status = 'FAILED'
            record.status_reason = f"Corrupt billing date format: Start='{start_dt_str}', End='{end_dt_str}'"
            record.save()
            records_created.append(record)
            continue

        record.period_start = start_date
        record.period_end = end_date

        # Check date inversion
        if end_date < start_date:
            record.status = 'FAILED'
            record.status_reason = f"Inverted date interval: End date ({end_date}) is prior to Start date ({start_date})"
            record.save()
            records_created.append(record)
            continue

        # Parse usage
        usage = parse_decimal(usage_raw)
        if usage is None:
            record.status = 'FAILED'
            record.status_reason = f"Invalid raw usage value format: '{usage_raw}'"
            record.save()
            records_created.append(record)
            continue

        record.raw_value = usage
        record.normalized_value = usage

        # Emissions calculation using eGRID regional factors
        # Try finding a factor by looking up matching plant/meter code or default
        grid_factor = GRID_EMISSION_FACTORS.get(meter_num, GRID_EMISSION_FACTORS.get('DEFAULT'))
        calculated_co2e = usage * grid_factor
        record.calculated_co2e_kg = calculated_co2e

        # Anomaly checks:
        # Rule 1: Check duplication overlapping billing dates for same meter
        overlaps = ActivityRecord.objects.filter(
            tenant=tenant,
            source_system='UTILITY',
            plant_code=meter_num,
            status='PENDING'
        ).filter(
            Q(period_start__range=(start_date, end_date)) | 
            Q(period_end__range=(start_date, end_date))
        ).exists()

        # Rule 2: Absolute consumption spike threshold (> 20,000 kWh)
        if overlaps:
            record.status = 'SUSPICIOUS'
            record.status_reason = f"Billing overlap detected: Meter '{meter_num}' has another pending record in this date range."
        elif usage > Decimal('20000.0000'):
            record.status = 'SUSPICIOUS'
            record.status_reason = f"Outlier consumption: Electricity usage ({usage:.2f} kWh) exceeds safe maximum standard baseline (20,000 kWh)."
        else:
            record.status = 'PENDING'

        record.save()

        # Log creation
        AuditLog.objects.create(
            tenant=tenant,
            record=record,
            action='INGEST',
            reason="Initial ingestion via Utility Electricity Portal parser",
            performed_by=user
        )
        records_created.append(record)

    return records_created

def ingest_travel_data(file_content, tenant, user):
    """
    Ingests Concur Flight Travel Logs CSV.
    Headers: Employee_ID,Segment_Departure_Airport,Segment_Arrival_Airport,Cabin_Class,Distance_km,Hotel_Room_Nights
    """
    csv_file = io.StringIO(file_content)
    reader = csv.DictReader(csv_file)
    records_created = []

    for row in reader:
        raw_payload = dict(row)
        emp_id = row.get('Employee_ID', '').strip()
        dep = row.get('Segment_Departure_Airport', '').strip().upper()
        arr = row.get('Segment_Arrival_Airport', '').strip().upper()
        cabin = row.get('Cabin_Class', '').strip().upper()
        distance_raw = row.get('Distance_km', '').strip()
        hotel_nights_raw = row.get('Hotel_Room_Nights', '').strip()

        record = ActivityRecord(
            tenant=tenant,
            source_system='TRAVEL',
            scope_category='Scope 3',
            raw_payload=raw_payload,
            plant_code=emp_id # Map Employee ID as tracking unit reference
        )

        # Base travel limits check
        hotel_nights = 0
        if hotel_nights_raw:
            try:
                hotel_nights = int(parse_decimal(hotel_nights_raw, 0))
            except:
                pass

        # Handle flight segment validation
        # If departure/arrival is missing and hotelnights is 0, it's failed
        if not dep or not arr:
            if hotel_nights > 0:
                # Hotel stay only segment
                record.raw_value = Decimal(hotel_nights)
                record.raw_unit = 'Nights'
                record.normalized_value = Decimal(hotel_nights)
                record.normalized_unit = 'Nights'
                
                # Standard lodging factor is 15.0 kg CO2e per night
                calculated_co2e = Decimal(hotel_nights) * Decimal('15.00')
                record.calculated_co2e_kg = calculated_co2e
                record.status = 'PENDING'
                record.period_start = date.today()
                record.period_end = date.today()
                record.save()
                records_created.append(record)
                continue
            else:
                record.status = 'FAILED'
                record.status_reason = "Corrupt travel segment: Departure/Arrival airports cannot be empty."
                record.save()
                records_created.append(record)
                continue

        record.raw_unit = 'km'
        record.normalized_unit = 'km'
        record.period_start = date.today()
        record.period_end = date.today()

        # Distance calculation
        dist = parse_decimal(distance_raw)
        calculated_flag = False

        if dist is None:
            # Fallback coordinate lookup
            coords_dep = IATA_COORDINATES.get(dep)
            coords_arr = IATA_COORDINATES.get(arr)

            if coords_dep and coords_arr:
                dist = Decimal(str(haversine_distance(
                    coords_dep[0], coords_dep[1],
                    coords_arr[0], coords_arr[1]
                )))
                calculated_flag = True
            else:
                # Missing coordinates fallback average
                record.status = 'SUSPICIOUS'
                record.status_reason = f"Distance lookup failed: IATA mapping missing for segment '{dep}' $\\rightarrow$ '{arr}'. Defaulted to average."
                dist = Decimal('1000.0000') # default average flight distance

        record.raw_value = dist
        record.normalized_value = dist

        # Cabin class multipliers
        # Business seat requires 2.9x the footprint of economy
        multipliers = {
            'ECONOMY': Decimal('1.00'),
            'PREM_ECONOMY': Decimal('1.60'),
            'BUSINESS': Decimal('2.90'),
            'FIRST': Decimal('4.00'),
        }
        multiplier = multipliers.get(cabin, Decimal('1.00'))

        # Standard flight carbon footprint constant: 0.15 kg CO2e per km
        flight_emissions = dist * Decimal('0.15') * multiplier
        hotel_emissions = Decimal(hotel_nights) * Decimal('15.00')

        record.calculated_co2e_kg = flight_emissions + hotel_emissions

        # Anomaly checks
        if cabin not in multipliers:
            record.status = 'SUSPICIOUS'
            record.status_reason = f"Unknown cabin class: '{cabin}'. Defaulted to Economy multiplier."
        elif record.status != 'SUSPICIOUS':
            record.status = 'PENDING'

        record.save()

        # Log audit entry
        AuditLog.objects.create(
            tenant=tenant,
            record=record,
            action='INGEST',
            reason=f"Initial ingestion via travel log parser {'(calculated distance)' if calculated_flag else ''}",
            performed_by=user
        )
        records_created.append(record)

    return records_created
