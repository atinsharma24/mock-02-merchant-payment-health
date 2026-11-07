# R1-02 — Merchant Payment Health Monitor

**Type:** Original, synthetic ScanPay Interview Sprint practice task; not an official ScanPay question.
**Time limit:** 60 minutes, including demonstrating a working web application.
**Tools:** Any IDE, language, permitted libraries, and AI coding agent.
**Status:** Do not open until the candidate explicitly says `START MOCK 2`.

## Business objective

A merchant support analyst needs a compact read-only web application to review payment attempts, captures, failed attempts, partial refunds, and net captured revenue for multiple merchants. The supplied exports contain out-of-order lifecycle events, repeated export rows, bad input records, and refund anomalies. Build a trustworthy and usable analyst console.

## Input files and data contract

Both UTF-8 CSV files are in `data/`. Identifiers are case-sensitive after trimming surrounding whitespace. CSV fields may be quoted. Physical file order matters **only** for the authoritative-record rules.

**`payment_attempts.csv`**

| Column | Meaning |
| --- | --- |
| `payment_id` | Attempt identifier; may repeat in export revisions |
| `merchant_id` | Exactly one of `M-101`, `M-202`, `M-303`, `M-404` |
| `created_at_utc` | UTC timestamp `YYYY-MM-DDTHH:MM:SSZ` |
| `amount_cents` | Strictly positive, safe, base-10 integer USD cents |
| `channel` | Exactly `qr`, `link`, or `terminal` |

**`payment_events.csv`**

| Column | Meaning |
| --- | --- |
| `event_id` | Export event identifier; may repeat in revisions |
| `payment_id` | References a retained, valid attempt |
| `event_type` | Exactly `CAPTURE`, `FAIL`, or `REFUND` |
| `event_at_utc` | UTC timestamp, same format |
| `amount_cents` | `CAPTURE` and `REFUND`: positive safe integer cents; `FAIL`: empty |

Only real calendar timestamps in the exact specified UTC format qualify: impossible dates and malformed timestamps are invalid. Decimal, exponent, zero, negative, whitespace-only, and unsafe integer monetary values are invalid. All financial amounts are USD and must not be mixed with other currencies.

## Authoritative export and payment-lifecycle rules

1. **Deduplication:** Separately for each CSV, retain the **last physical occurrence** of every nonempty primary ID (`payment_id` or `event_id`). Earlier rows are superseded. If the selected final row is invalid, exclude it; **do not fall back to earlier valid rows**. Blank IDs cannot form groups. Validate **after** choosing the final occurrence.
2. **Validity and relationships:** Retain only well-formed payments. Exclude malformed final event rows, events referencing nonexistent/excluded payments, and events timestamped before their referenced attempt's `created_at_utc`.
3. **Captures and status:** A `CAPTURE` is eligible only when its amount equals the payment attempt's amount. Each payment contributes to captured gross at most once: if multiple eligible captures exist, take the chronologically earliest, breaking equal-timestamp ties by ascending `event_id`. Other capture events have no financial effect. A payment is **captured** if an eligible capture exists; otherwise **failed** if it has at least one valid `FAIL`; otherwise **pending**. Capture wins over FAIL, regardless of event file order.
4. **Refunds:** Refunds count only for captured payments, dated at or after the selected capture. Consider them by ascending timestamp, breaking ties by ascending `event_id`. Accept an entire positive refund only when it fits within the remaining captured amount. An over-limit refund is rejected without blocking later valid refunds. Partial or full refunds **do not** change the payment's captured status.
5. **Financial integrity:** Ignore rejected data/events in computations. Never count a payment or its capture twice; never treat invalid monetary input as zero. The data-quality summary must expose discarded or rejected records at a useful level.

## Mandatory acceptance criteria — four

**A. Ingestion and derived payment lifecycle.** Load the two CSV exports, obey the data contract, canonical-record selection, validation, status precedence, and refund rules. Display a data-quality summary including superseded duplicates, excluded final payments/events, and rejected business events.

**B. Financial KPI cards.** Show six calculations for the *currently filtered set of payments*: (1) valid payment attempts, (2) captured attempts, (3) capture rate = captured / attempts (0% for zero attempts), (4) gross captured USD, (5) accepted refunds USD, and (6) net captured USD = gross minus accepted refunds. Use integer cents for accumulation and display USD with exactly two decimals. A fully refunded payment remains captured.

**C. Interactive analyst workflow.** Implement merchant filter (`all` or one merchant), derived-status filter (`all`, `captured`, `failed`, `pending`), and text search by payment ID. Show a payment table with identifier, merchant, channel, attempt creation time, derived status, original amount, accepted refunds, and net captured amount. All six KPIs and table contents must stay consistent with active filters. Handle zero matches clearly.

**D. Breakdown and functional presentation.** Provide a breakdown by merchant (at least attempt count, captured count, and net USD), consistent with the currently active filters. The application must run and be usable on desktop and mobile, with clear labels and meaningful loading/error/empty states. No mandatory control may be decorative or inert.

## Optional improvements (not scored in place of mandatory criteria)

Only after all mandatory functionality works: filtered CSV export, channel breakdown, time trend, or event-rejection drill-down.

## Deadline, submission and review

- Finish the app and demonstrate its required flows within **60 minutes total**.
- Source must be accessible under this mock's `app/` directory or a clearly identified equivalent path. Show run/test/build commands and the real results.
- Demonstrate filters and business totals and clearly report incomplete or unverified requirements.
- No feature or code modifications after the deadline count for the timed score.
- A short architecture and code defense follows submission. GitHub, production deployment, and a long architecture document are **not official requirements of this Round 1 mock**.
- The evaluator will check independently derived expected values and adversarial cases **within this published data contract**, without adding surprise features.

**Assessment note:** This is a deliberately hard practice exercise, not a leaked or confirmed ScanPay interview task.
