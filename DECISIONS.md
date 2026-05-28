# Architectural & Product Decisions

During the development of this prototype, we faced several ambiguities regarding how to handle dirty data, ingestion methods, and user flows. Here is how we resolved them:

## 1. Ingestion Mechanism
**Decision:** We chose **CSV File Uploads** via the React frontend as the primary ingestion mechanism.
**Why:** While direct API integrations (e.g., hitting the Concur API) are ideal, enterprise clients often start by downloading flat CSV extracts from legacy systems (like SAP) or utility portals because IT security policies block direct third-party API access. A file drop zone is the most realistic "day one" onboarding experience for an ESG analyst.

## 2. Handling Missing or Corrupt Dates
**Decision:** If a date is missing or fails to parse (e.g., SAP provides a corrupt `BUDAT`), we **fail the row loudly** instead of guessing or using a fallback date.
**Why:** GHG accounting is strictly time-bound. Assigning emissions to the wrong quarter or year due to a fallback date is a compliance violation. Failed rows remain in the dashboard so analysts can manually fix the date and provide a correction reason.

## 3. Strict Parser Strategies vs. Dynamic Mapping
**Decision:** We implemented distinct, hardcoded parser functions (`ingest_sap_data`, `ingest_utility_data`, `ingest_travel_data`) rather than a dynamic drag-and-drop column mapper.
**Why:** Dynamic column mappers are incredibly prone to user error (e.g., mapping "Amount" to Distance instead of Fuel Volume). By enforcing a strict expected schema for each source, we guarantee data integrity. If a client's format varies slightly, it is safer to update the parser code than to trust a non-engineer to map columns correctly.

## 4. Outlier Detection
**Decision:** We implemented a static threshold for anomaly detection (e.g., flagging fuel uploads > 50,000 L).
**Why:** Analysts need a way to prioritize their review. Highlighting massive anomalies as `SUSPICIOUS` ensures that a typo (like an extra zero in an SAP export) doesn't completely skew the company's annual carbon footprint.

## Questions for the PM
If time permitted, I would ask the PM:
1. *How do we handle overlapping utility bills?* If a bill spans Jan 15 to Feb 15, do we prorate the emissions across the two months, or attribute it to the month the bill was issued?
2. *Should clients be able to edit their own data?* Currently, analysts review and correct data. Should clients have a self-service correction portal?
