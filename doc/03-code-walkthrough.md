# 3. Backend and shared code walkthrough

Use the [source index](08-source-index.md) for exact line links. The explanations below use symbol names so they survive future line shifts.

## app/lib/types.ts

Types separate untrusted input from validated domain records. `MerchantId`, `Channel`, `EventType`, and `DerivedStatus` are unions of allowed strings. A TypeScript cast such as `as MerchantId` does not validate CSV data; the corresponding runtime Set membership check does.

`RawPaymentAttempt` and `RawPaymentEvent` retain **string** amounts and timestamps because parsing has not established their validity. Optional underscore metadata carries source line, column count, and malformed quote diagnostics from the CSV parser. Direct unit-test callers can omit metadata; the engine then cannot reject based on absent structure information.

`ValidPaymentAttempt` adds parsed epoch milliseconds and safe numeric cents. `ValidPaymentEvent.amount_cents` is optional because FAIL has no amount. This is one interface rather than a discriminated union, so TypeScript alone does not encode “CAPTURE always has amount”; validation and later non-null assertions establish that assumption.

`DerivedPayment` is the dashboard row model. It preserves normalized attempt fields, selected capture if any, accepted refund events, their summed cents, and net cents. It omits FAIL events and rejected/superseded events.

`SupersededRecord` and `ExcludedFinalRecord` preserve a shallow copy of raw fields plus explanation and optional location. `RejectedBusinessEvent` has normalized event identifiers/type/amount and reason, without the same source-line/raw payload contract. `DataQualitySummary` contains separate arrays and input/valid counts.

`FinancialKPIs`, `MerchantBreakdownRow`, and `ChannelBreakdownRow` carry exact aggregate money as strings. Counts and percentage remain numbers. `FilterState` centralizes merchant/status/search choices. `LoadDataResult` has boolean success and optional data/error; consumers must check both. A discriminated union could encode impossible success-without-data combinations more strongly, but is not currently used.

## app/lib/csv.ts

### CSVRowRecord

Each record has its starting physical `line`, `fields`, malformed quote flag, and optional reason. A logical record may contain embedded newlines.

### parseCSVRecords(content)

This is a character scanner, not `split(',')` or line splitting. Important local variables:

| Variable | Meaning |
| --- | --- |
| `records` | Completed logical records |
| `currentRowFields` | Completed fields in the active record |
| `currentField` | Text accumulated for the active field |
| `insideQuotes` | Whether commas/newlines are literal data |
| `currentLine`, `rowStartLine` | Physical line accounting and diagnostic location |
| `rowMalformedQuotes`, `rowMalformedReason` | Structural errors carried forward rather than silently dropping the row |
| `i`, `len` | Scanner cursor and input boundary |

Inside quotes, `""` contributes one literal quote and advances twice; an unmatched quote closes the field. Unexpected nonseparator characters immediately after closing mark malformed structure. Quoted LF/CRLF is included in field text and updates physical line tracking. Outside quotes, comma commits a field; CR/LF commits the field and row and resets per-row state. A quote at an empty field starts quoted mode; a quote inside an unquoted field marks a misplaced quote.

At EOF, open quoted mode is marked malformed, and a nonempty pending row is emitted. Trailing all-whitespace records are removed. Interior blank rows remain and later become blank-ID audit records. `quoteOpened` and `fieldHadQuotes` are currently assigned but do not participate in subsequent decisions; they are redundant state, not extra correctness checks.

Retaining malformed records matters: if an identifiable final revision is malformed, its ID still supersedes the prior revision before exclusion. Dropping bad records in the parser could violate final-occurrence semantics.

The existing parser header used a broad RFC-compliance description; chapter 7 explains why the implementation and tests do not establish full arbitrary-CSV compliance.

### validateHeaders(actualHeader, expectedHeader)

Returns `{valid: false, error}` on wrong count or the first ordered name mismatch; trims each actual header field. Same column names in another order fail. It compares values, not `CSVRowRecord.malformedQuotes`; the loader currently does not separately reject malformed header quote flags.

### parseCSV(content)

Compatibility wrapper discards metadata and returns `string[][]`. Production ingestion uses `parseCSVRecords`, not this wrapper. Avoid switching the loader to it because that would lose structural diagnostics and source lines.

## app/lib/loadData.ts

`EXPECTED_ATTEMPTS_HEADER` and `EXPECTED_EVENTS_HEADER` encode the five-column schemas. Column mapping relies on this ordered header contract.

### getCanonicalDataDir()

Checks existence of `cwd/app/data`, then `cwd/data`, then returns a path relative to `__dirname`. Normal npm root scripts run the inner app and resolve its `data/`. The first two branches support ordinary root/app invocations. The fallback depends on compiled runtime layout and is not a separately verified deployment strategy. It selects an existing directory before checking individual required files; it does not retry another directory if the selected directory lacks one file.

### loadAndProcessData()

1. Resolve directory and required filenames.
2. Missing file returns `Export CSV Files Missing` with filenames and recovery advice.
3. Read both files inside try/catch. Read failure returns `Cannot Read Export Files` without filesystem paths/stack trace.
4. Parse records. No records returns `Empty Export File` for the appropriate input.
5. Validate attempts and events header values. On mismatch return the appropriate `Invalid ... Export Header` result.
6. Slice off header and map each positional field. Missing fields become empty strings **in the raw layer**, with column count retained, so this does not create valid monetary zeroes. Store all structure metadata.
7. Call `processLifecycle`; return success with payments and quality summary.

Only file reads have a catch block. This is an expected-ingestion-error result design, not a universal catch-all error boundary. Header-only exports are accepted as zero-record datasets; fully empty exports are errors.

## app/lib/lifecycle.ts helpers

### compareOrdinal / compareEventsChronologically

`compareOrdinal` returns -1/0/1 using ordinary string `<`/`>`. The event comparator first subtracts epoch milliseconds; equal times use IDs. `sort` mutates temporary eligible-capture/refund arrays, not the input event arrays. Equal IDs should already be collapsed by revision selection.

### parseIsoUtc(ts)

Regex enforces exact year/month/day/hour/minute/second shape with literal T/Z; timezone offsets, fractional seconds, and shortened components fail. Parsed month and clock ranges are checked. Leap years follow divisible-by-4 except centuries unless divisible-by-400. Month-specific day range rejects normalization-prone impossible dates such as February 30. Constructing a Date and applying `setUTCFullYear(y)` avoids JavaScript's legacy 1900 remapping for numeric years 0–99. The timestamp helper itself does not trim; its ingestion call sites do.

### parsePositiveInt(val)

Trim, test digits, convert to Number, require safe positive integer. Return `{valid, amount}`. There is no parseFloat/parseInt partial acceptance of suffixes, exponent notation, decimals, or negatives.

### processLifecycle(rawAttempts, rawEvents)

This is the core engine; chapter 2 walks its phases. Important containers to recognize immediately:

- `lastAttemptMap` / `lastEventMap`: unvalidated authoritative revision candidates with original index.
- `validAttemptsMap`: retained valid attempts used for relationship lookup.
- `validCandidateEvents`: row-valid events, including later business rejections.
- `eventsByPayment`: buckets initialized for every valid payment.
- `eligibleCaptures`, `selectedCapture`: equal-amount candidates and the one financial winner.
- `acceptedRefunds`, `acceptedRefundCents`, `remainingCapturedCents`: chronological refund acceptance state.
- `derivedPayments`, `paymentsMap`: output list and ID lookup.

`return` inside `forEach` skips that callback, not the whole engine. This is crucial in rejecting one oversized refund while still evaluating subsequent refunds. Non-null assertions (`!`) express invariants established earlier: for example, captured status was assigned only if a capture exists. `rf.amount_cents || 0` is redundant defensive fallback for already validated REFUND records; it is not the ingestion policy for invalid money.

### filterPayments(payments, filters)

Returns a new array, keeping original objects/order. Merchant and status use exact equality unless `all`. Search trims and lowercases query and payment ID, then uses substring matching. All active constraints combine with AND. Identity grouping is case-sensitive even though user search is case-insensitive. Query normalization is currently repeated within the per-payment predicate rather than hoisted.

### calculateKPIs(filteredPayments)

Uses array length for denominator. Counts captured rows, converts safe per-row amounts/refunds with BigInt, then subtracts aggregate refunds from gross. Converts final totals to strings, leaves percentage unrounded until UI `.toFixed(2)`. BigInt must be introduced **before** sums; converting an already rounded Number sum cannot recover lost cents.

### calculateMerchantBreakdown / calculateChannelBreakdown

Initialize all four/three known categories to zero. Scan filtered payments and increment attempts; increment captured/gross/refunds only for captured rows. Return fixed-order rows with strings for money and zero rate for empty categories. Categories with zero matches remain visible. Both functions have similar implementations; a generic grouping helper is a possible later refactor, not necessary to explain the current design.

### exportPaymentsToCSV(payments)

Produces one header and one row per passed derived payment. IDs and other text are wrapped in quotes; numeric USD fields use `/100` and `.toFixed(2)`. This exports **derived filtered payments**, not raw exports or rejection logs. There is no file I/O here: it returns text and the browser handles download. Current implementation does not escape embedded quotes or mitigate spreadsheet formulas and does not use exact BigInt formatting for extreme individual values. See limitations before defending broad export correctness.

### formatUSD(centsInput)

Convert input string/bigint/number to BigInt, record sign, work with absolute cents. Dollars are integer division by 100; two-digit fraction is remainder modulo 100. Group dollars with en-US formatting, then compose sign, $, dollars and fraction. Input is assumed an exact integer; arbitrary decimal strings or unsafe Number inputs are outside its safe contract. Use it for money, not rates.
