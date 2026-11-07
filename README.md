# Merchant Payment Health Monitor (Mock 2)

A resilient, deterministic Next.js + TypeScript + Tailwind web application providing payment lifecycle analysis, financial KPI tracking, and reconciliation audits for merchant support analysts.

---

## 1. Quick Start & Verification Commands

All commands can be executed from the repository root or inside `app/`:

```bash
# 1. Run all unit and boundary regression tests (12 tests)
npm test

# 2. Run TypeScript strict typecheck
npm run typecheck

# 3. Run ESLint (Next.js core-web-vitals)
npm run lint

# 4. Production build
npm run build

# 5. Start production server (runs on http://localhost:3000)
npm start
```

---

## 2. Canonical Data Architecture

- **Canonical Runtime Source (`app/data/`):** Authoritative source for all production ingestion, Next.js server rendering, and automated Vitest test suites.
- **Reference Export (`data/`):** Immutable copy preserved from the assessment brief.

### Ingested Datasets:
1. `payment_attempts.csv`: 228 rows (1 header + 227 data rows)
2. `payment_events.csv`: 266 rows (1 header + 265 data rows)

---

## 3. Verified Assessment Results

All values are exact, computed using deterministic integer-cent arithmetic:

| Metric | Verified Value |
|---|---|
| **Valid Payment Attempts** | **205** |
| **Captured Attempts** | **135** |
| **Failed Attempts** | **42** |
| **Pending Attempts** | **28** |
| **Capture Rate** | **65.85%** (`135 / 205`) |
| **Gross Captured USD** | **$61,005.39** (`6,100,539` cents) |
| **Accepted Refunds USD** | **$11,504.83** (`1,150,483` cents) |
| **Net Captured USD** | **$49,500.56** (`4,950,056` cents) |
| **Superseded Attempts / Events** | **9 / 2** |
| **Blank Attempt / Event IDs** | **2 / 1** |
| **Excluded Final Attempts / Events** | **11 / 14** |
| **Rejected Business Events** | **17** |

### Merchant Breakdown:
- **M-101:** 61 attempts, 33 captured, Gross: $16,853.19, Refunds: $4,108.73, Net: $12,744.46
- **M-202:** 44 attempts, 35 captured, Gross: $13,588.75, Refunds: $743.93, Net: $12,844.82
- **M-303:** 43 attempts, 27 captured, Gross: $11,567.78, Refunds: $2,893.79, Net: $8,673.99
- **M-404:** 57 attempts, 40 captured, Gross: $18,995.67, Refunds: $3,758.38, Net: $15,237.29

---

## 4. Key Design Decisions

1. **Structural CSV Ingestion & Precedence:**
   - Strict header validation: verifies exact expected columns for both files.
   - Detects misplaced/unclosed quotes and column count errors.
   - Preserves final-occurrence-before-validation semantics: a malformed final revision with an identifiable primary ID supersedes earlier rows and is then excluded, without falling back to earlier valid rows.
2. **Deterministic Ordinal Event Ordering:**
   - Replaced `localeCompare` with `compareOrdinal` (strict case-sensitive ASCII/Unicode code-point ordering `a < b ? -1 : a > b ? 1 : 0`).
   - Ascending `event_id` is defined as standard code-point collation, completely independent of OS/locale.
   - Supported by regression tests with mixed-case equal-timestamp refunds.
3. **Exact Aggregate Money Math (BigInt):**
   - Accumulations use exact `BigInt` arithmetic. No float precision loss even when sums exceed `Number.MAX_SAFE_INTEGER`.
   - Next.js props serializability is maintained by passing exact integer decimal strings (`string`) across the server/client boundary.
   - Tested against the regression case: `9007199254740991 + 2 = 9007199254740993` cents ($90,071,992,547,409.93).
4. **Calendar-Year & Leap-Year Correctness:**
   - Fixed `Date.UTC` treating years 0000–0099 as 1900–1999 using `dt.setUTCFullYear(y)`.
   - Proleptic Gregorian leap year evaluation validates 0000 (leap), 0096 (leap), 0100 (non-leap), 2024 (leap), 2026 (non-leap).
5. **Clean Failure & Loading Presentation:**
   - Missing or unreadable files render a user-friendly `ErrorState` card with clear title, explanation, recovery steps, and a functional "Retry Data Ingestion" button.
   - Zero filesystem paths or stack traces exposed to analysts.
   - `loading.tsx` provides instant, accessible skeleton feedback.
6. **Local Favicon Asset:**
   - Embedded SVG favicon (`icon.svg` & `favicon.ico`) served with HTTP 200 to prevent 404 console errors.

---

## 5. 1-Minute Demonstration Path

1. **Dashboard Overview:** Open [http://localhost:3000](http://localhost:3000). Verify headline KPI cards ($61,005.39 Gross, $11,504.83 Refunds, $49,500.56 Net, 65.85% Capture Rate).
2. **Data Quality Audit:** Click **"Data Quality Audit (56)"** in header. Inspect tabs for Superseded Duplicates (11), Excluded Final Records (28), and Rejected Business Events (17).
3. **Interactive Filtering:**
   - Filter by **Merchant: M-101**: Note instant updates across KPIs and breakdown table (61 attempts, $12,744.46 Net).
   - Filter by **Status: Failed**: Note captured count and financial totals safely drop to $0.00.
4. **Search & Zero-Match Handling:**
   - Search `PMT-00001` and click **"Details"** to view authoritative capture and refund timeline in modal.
   - Search `NONEXISTENT` to trigger the empty state and click **"Reset All Filters"**.
5. **Channel Breakdown & CSV Export:**
   - Toggle to **"By Channel"** to view QR vs Link vs Terminal performance.
   - Click **"Export Filtered CSV"** to download the active dataset.

