# Mock 2: architecture and code defense handbook

This handbook explains the **actual implementation** of Merchant Payment Health Monitor at base commit `4556b122378f18ae1866348abfe0fc0694d51fa3`. Documentation and explanatory comments live on `docs/mock-02-architecture` in a separate Git worktree. Application behavior is intentionally unchanged. This is study material prepared after the implementation, not evidence of work completed within the timed mock.

## Reading order

1. [Architecture and request flow](01-architecture.md): understand the system before individual statements.
2. [Data contracts and lifecycle](02-data-and-lifecycle.md): the business rules that determine correctness.
3. [Backend and shared code walkthrough](03-code-walkthrough.md): every major utility, type, and ingestion function.
4. [React and interface walkthrough](04-react-and-ui.md): rendering, state, filters, exports, audit, and details.
5. [Worked examples and reconciliation](05-worked-examples.md): trace supplied records and compute outcomes yourself.
6. [Interview questions and change map](06-code-defense.md): explain decisions and locate implementation quickly.
7. [Testing, running, and limitations](07-verification-and-limitations.md): actual checks and honest boundaries.
8. [Source symbol index](08-source-index.md): clickable file/line references generated after comments were added.

Read the original [brief](../BRIEF.md) alongside chapter 2. Read chapter 7 before claiming the app handles arbitrary production data.

## The explanation to memorize first

“The server reads two local CSV exports. It preserves their physical order to choose the final revision of each identifier before validating it. Valid events are joined to retained attempts, then each payment gets one authoritative capture, a status, and chronological bounded refunds. The server sends derived payments and audit information to a client dashboard. One filtered payment array drives the six KPIs, both breakdowns, the table, and export. Per-payment money stays in safe integer cents; aggregates use BigInt and decimal strings.”

## Find a concern quickly

| Concern | Implementation | Explanation |
| --- | --- | --- |
| Route and refresh policy | `app/src/app/page.tsx` | Chapters 1, 4 |
| Read files, schema, raw row metadata | `app/lib/loadData.ts` | Chapter 3 |
| Quotes, line endings, source lines | `app/lib/csv.ts` | Chapter 3 |
| Final occurrence, validation, lifecycle | `processLifecycle` in `app/lib/lifecycle.ts` | Chapters 2, 3 |
| Time, money, event ordering | `parseIsoUtc`, `parsePositiveInt`, `compareEventsChronologically` | Chapters 2, 3 |
| Filter and sum | `filterPayments`, `calculateKPIs`, breakdown functions | Chapters 3, 4 |
| UI controls and local state | `app/src/components/DashboardClient.tsx` | Chapter 4 |
| Ingestion error and retry | `ErrorState.tsx` | Chapters 3, 4 |
| Regression evidence | `app/lib/*.test.ts` | Chapter 7 |

## Study sessions

- **15 minutes:** this introduction, architecture diagram, lifecycle phase list, baseline totals, limitations.
- **45 minutes:** all of chapters 1–5, then explain `PMT-00008`, `PMT-00120`, and an over-limit refund without reading.
- **90 minutes:** open each source function beside its explanation; answer chapter 6 aloud; run the checks in chapter 7.

Do not memorize line numbers. Memorize file and symbol names; use the index or `rg -n 'symbol' app` when scrutinizing the code.
