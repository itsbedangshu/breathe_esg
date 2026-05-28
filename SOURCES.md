# Data Sources & Research

Part of the challenge was researching what real-world enterprise data actually looks like and designing parsers capable of handling its messiness.

## 1. SAP (Fuel and Procurement)
**Research & Choice:** SAP ERP systems are notoriously rigid. Data is typically exported via SAP MM (Materials Management) or FI (Financial Accounting) modules. We chose to model a **flat file export (CSV)** from an SAP ALV grid.
**What we learned:** SAP uses German abbreviations natively. Dates are often exported as un-hyphenated strings (`YYYYMMDD`), and units of measure (MEINS) can be highly specific (e.g., `TO` for metric tonnes). 
**Our Sample Data:** Features headers like `BUDAT` (Posting Date), `WERKS` (Plant), `MATNR` (Material Number), and `MENGE` (Quantity). 
**Real-world failure points:** In a real deployment, a client might export a file using a comma decimal separator (`1.000,50`) instead of a period, which would break our `Decimal` parsing if not localized properly.

## 2. Utility Data (Electricity)
**Research & Choice:** Facilities teams often scrape data from local utility web portals. We chose to model a **Portal CSV Export**.
**What we learned:** Utility bills rarely align perfectly with calendar months (e.g., Jan 14 to Feb 12). They contain meter numbers, tariff codes, and raw kWh usage.
**Our Sample Data:** Features standard headers like `Account_Number`, `Meter_Number`, `Billing_Start_Date`, `Billing_End_Date`, and `Usage_kWh`.
**Real-world failure points:** Utilities frequently revise bills retroactively due to estimated meter readings. Our system currently ingests a row as a net-new record; in reality, we would need logic to identify and overwrite/version previous estimated bills with the new actuals.

## 3. Corporate Travel (Flights/Transport)
**Research & Choice:** Platforms like Concur or Navan provide reporting tools for corporate sustainability leads. We modeled a **Concur-style Flat File Extract**.
**What we learned:** Flight records often only provide the cabin class (Economy/Business) and IATA airport codes (e.g., JFK to LHR), completely omitting the actual flight distance. 
**Our Sample Data:** Includes `Trip_ID`, `Employee_ID`, `Origin_IATA`, `Destination_IATA`, and `Class`. 
**Real-world failure points:** Our parser calculates the Haversine great-circle distance between two airports using a hardcoded coordinate dictionary. In reality, flights do not travel in straight lines, and a real deployment would require an integration with an aviation API (like OAG or Cirium) to account for routing inefficiencies and exact flight paths.
