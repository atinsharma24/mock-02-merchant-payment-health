# 6. Interview questions and implementation change map

## A concise architecture answer

“The server component ingests two local CSVs into raw records with structural metadata. The lifecycle module selects last physical revisions before validation, joins events to retained attempts and derives a single payment outcome. The client component filters those derived records in memory; all six KPI cards, breakdown tables, table rows and export use the same subset. Audit arrays explain data removal separately. Money uses safe integer cents per payment and BigInt across payments.”

## Questions you should answer without opening the code

### Data correctness

**1. Why deduplicate before validating?** The contract makes the final physical revision authoritative even when invalid. Validating first would fall back to stale rows. Point to `lastAttemptMap`/`lastEventMap` before their final-validation loops.

**2. What is deduplicated: payment or event?** Both independently, using different primary IDs. A payment may have many retained event IDs. Choosing one capture per payment is an additional business rule.

**3. What happens to blank IDs?** Each blank row is separately audited, not grouped into a blank-key revision chain. Synthetic audit IDs identify those records.

**4. Why is a valid candidate event later rejected?** Shape, relationship and money validity do not guarantee business eligibility. Wrong capture amount, excess capture, pre-capture refund, uncaptured refund, or oversized refund can still be rejected.

**5. Is FAIL necessarily the final status?** No. Any eligible capture wins. Without capture, any valid FAIL yields failed. Without either, pending.

**6. Can a full refund make captured count fall?** No. Status stays captured; accepted refund amount increases and net decreases to zero.

**7. Why doesn't a refund before capture count?** Capture establishes the eligible financial starting point. A valid event after attempt creation may still predate capture and be rejected by the business phase.

**8. Can one event be partially refunded?** Refund events are accepted whole or rejected whole. “Partial refund” means an accepted event smaller than captured amount, not clipping an oversized event.

**9. What about an over-limit refund followed by a small one?** Rejection leaves remaining balance intact and iteration continues, so the later one may fit.

**10. How are event time ties resolved?** Ascending case-sensitive ID using JavaScript ordinal string comparison after timestamp. File order only controls revision authority, not chronological financial selection.

**11. Why parse dates manually?** Date normalization can accept impossible calendar dates; the contract requires exact UTC seconds and real dates. Regex/ranges/leap-year checks precede Date creation.

**12. Does zero mean invalid money is accepted?** No. Invalid parse result has valid=false; call sites exclude it. Per-payment uncaptured gross legitimately equals zero.

**13. Why safe Number per payment but BigInt in aggregates?** Valid individual cents and refund sums bounded by the individual capture stay safe. Cross-payment sums may exceed that bound.

**14. Why are aggregate fields strings?** Preserve exact integer values in a portable plain-data contract. Do not cast them to Number for arithmetic or display.

**15. Are leading zeros rejected?** No. Actual digit regex accepts them. Say what the implementation does, not what an older comment claimed.

**16. Is ordering truly Unicode code-point order?** String operators use UTF-16 code units. For the ASCII fixture IDs this matches intended ordinal order. It is deterministic without locale dependence.

### React and framework

**17. Why a server/client split?** Filesystem ingestion belongs on server; hooks, user interactions and downloads need a client boundary. The client never imports `fs` or loader.

**18. Does 'use client' mean no server-rendered HTML?** No. It marks a client component and its interactive boundary; Next can initially render its HTML before hydration.

**19. Is there a backend API?** No custom API routes. The route calls ingestion directly on the server, then provides serialized props.

**20. What keeps KPIs and table synchronized?** A single `filteredPayments` derived array drives every financial view, including export.

**21. Why useMemo?** Avoid redundant recalculation when unrelated UI state changes. Removing it would affect performance, not the rules or intended output.

**22. Are audit counts filtered too?** No; they refer to initialDataQuality, the full ingested snapshot. Be explicit about differing scope.

**23. How does reset work?** Replace all three filter fields with defaults. Breakdown and audit state are independent.

**24. Does retry revalidate a cache?** It reloads the document; the dynamically rendered route calls ingestion again. No bespoke cache revalidation or API retry is implemented.

**25. How are timestamps displayed?** Original normalized UTC text including T/Z in the table under a UTC label. No local-time conversion.

**26. Why do other merchants show zero after selecting M-101?** Breakdown functions initialize a fixed list of known categories and summarize only the filtered subset.

**27. Is the Details view a complete audit trail?** No. It contains selected capture and accepted refunds from DerivedPayment. Rejections live in the global panel, while FAIL events are not retained in the detail model.

**28. Is the dashboard real-time?** No. The data snapshot is read on a full server request; client filters reuse it. A badge does not implement streaming or polling.

### Engineering scrutiny

**29. What is the complexity?** Map-based scans O(A+E) plus per-payment capture/refund sorts bounded by O(E log E), memory O(A+E). Client filters and summaries are linear in payment count; DOM rendering and payload size also matter.

**30. Where could production fail first?** Blocking synchronous ingestion per request, shipping raw audits, rendering all rows, no auth/access control, no real deployment validation. These are reasons to scope the demo correctly.

**31. What does the test suite prove?** Current fixture totals/filter calculations and selected synthetic regressions. It is not comprehensive property testing, automated browser coverage, or full RFC conformance testing.

**32. Is export universally safe/correct?** No. Fixture export works, but text quoting does not escape embedded quotes or mitigate formula execution; Number decimal formatting has extreme-value precision limitations.

**33. Could TypeScript replace runtime validation?** No. CSV text is untrusted runtime input; casts and interfaces disappear at runtime.

**34. Why no database?** The task is read-only analysis of small local exports. A database is unnecessary for this scope; persistent concurrent ingestion would change that decision.

**35. How would you improve maintainability?** Propose smaller UI components, a generic breakdown helper, stronger discriminated unions, exact shared export formatting, and better test coverage. Do not imply these changes already exist.

**36. How would you add a merchant?** Update type union, runtime valid set, fixed breakdown list, UI select options, tests and data contract together. Changing only the dropdown would not accept the data.

**37. How would you make data refresh without losing filters?** Introduce an explicit refresh flow/client router refresh with clear snapshot semantics and verify reconciliation of stale detail state. Current full reload resets local filters.

**38. What happens when exports disagree during replacement?** Reads are sequential, not an atomic two-file snapshot. A concurrent replacement can mix versions. Immutable/versioned snapshots are a proposed remedy.

## “Where would you change it?” map

| Requested change | Primary edit sites | Verification to add |
| --- | --- | --- |
| New validation rule | `processLifecycle`, parser/helper if needed | Final revision and malformed input cases |
| Change capture precedence | Capture selection in `processLifecycle` | FAIL/capture combinations and ties |
| Change refund rule | Refund loop and derived totals | Before capture, exact fit, reject then accept |
| New status | types, status derivation, filter options, badge | Every status branch and KPI treatment |
| New filter | FilterState, filterPayments, state/control/reset | AND combinations, empty, export consistency |
| New KPI | FinancialKPIs, calculateKPIs, card JSX | Empty subset, status scope, large totals |
| New breakdown | Types, aggregation helper, memo/toggle/table | Reconciliation with global filtered KPIs |
| Export correction | exportPaymentsToCSV | Round-trip quotes/newlines, formula IDs, extreme cents |
| Ingestion error display | loadData result, ErrorState | Missing/empty/schema/read failure |
| More complete payment detail | DerivedPayment and processLifecycle, modal JSX | Event provenance and rejected/FAIL histories |
| Keyboard-accessible dialog | selectedPayment JSX/event handlers | Focus enter/return, trap, Escape, accessible names |
| Large dataset handling | Loader architecture and dashboard table | Payload, latency, pagination consistency |

## Live debugging drill

1. Search a payment ID in the two inner CSVs to see all physical revisions.
2. Inspect last-ID map selection before reasoning about values.
3. Check selected final attempt validity and event references.
4. Determine row-valid candidate events, selected capture and refund order.
5. Compare DerivedPayment against the UI Details view.
6. If totals differ, inspect active filters and passed subset before changing financial math.
7. If data seems unchanged after editing, confirm inner canonical path and full reload.

Useful commands from mock root:

```bash
rg -n 'PMT-00008|EVT-01008' app/data/*.csv
rg -n 'selectedCapture|remainingCapturedCents' app/lib/lifecycle.ts
rg -n 'filteredPayments|handleExportCSV' app/src/components/DashboardClient.tsx
```
