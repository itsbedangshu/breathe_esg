# Tradeoffs & Deliberate Omissions

To deliver a robust, defensible prototype within the 4-day constraint, we had to make pragmatic engineering tradeoffs. Here are three things we deliberately did **not** build, and why.

## 1. A Comprehensive Unit Conversion Engine
**What we skipped:** We did not build or integrate a dynamic, graph-based unit conversion library (e.g., dynamically converting BTUs to Joules, or resolving complex imperial/metric ratios on the fly).
**Why:** Building a reliable unit conversion engine is a massive undertaking. Instead, we hardcoded specific, known conversions (e.g., Gallons to Liters, Metric Tons to Liters for Diesel) directly in the parsers. This allowed us to guarantee 100% accuracy for the specific sample data we handled, rather than risking subtle floating-point bugs in a generalized engine. A generalized engine would be a post-prototype feature.

## 2. A Real GHG Emission Factor Database
**What we skipped:** We did not build a temporal, regionally-aware database of emission factors (e.g., tracking the changing grid intensity of the UK vs. Texas over different years).
**Why:** Real emission factor databases (like EPA eGRID or DEFRA) are incredibly complex and require continuous updates. For the prototype, we hardcoded static baseline EPA factors (e.g., `2.68 kg CO2e` per Liter of Diesel) as constants in the parser. The focus of this assignment was the *workflow* (ingestion, normalization, review, auditing), not the exhaustive accuracy of the carbon math itself.

## 3. Direct 3rd-Party API Integrations (OAuth)
**What we skipped:** We did not build an OAuth flow to pull data directly from APIs like Concur, Navan, or SAP OData services.
**Why:** Setting up API integrations requires test developer accounts, dealing with rate limits, and handling token refreshes. More importantly, many enterprise clients rely on asynchronous batch exports (flat files) for security reasons. By focusing on parsing raw CSV payloads, we built a system that works immediately for any client capable of exporting a spreadsheet, which is the most realistic MVP for enterprise onboarding.
