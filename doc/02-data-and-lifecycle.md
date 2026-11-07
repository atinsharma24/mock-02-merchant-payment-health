# 2. Data contracts and payment lifecycle

## Input versus derived data

An **attempt** records intent: payment ID, merchant, creation UTC time, amount in cents, channel. An **event** records a lifecycle action: event ID, referenced payment, type, UTC time, amount except for FAIL. A **derived payment** combines the retained attempt with selected capture, accepted refunds, status, and net. The attempt's original amount is not automatically revenue.

Runtime files are `app/data/payment_attempts.csv` and `app/data/payment_events.csv`. Outer `data/` contains reference copies. Normal root and inner-app commands resolve the inner copies. Editing only outer exports will not change the normal dashboard.

## Validation contract

| Field | Runtime behavior |
| --- | --- |
| Primary IDs | Trim; nonempty; case-sensitive map key. No enforced `PMT-`/`EVT-` pattern |
| Merchant | Trim, then membership in M-101/M-202/M-303/M-404 |
| Channel | Trim, then exactly qr/link/terminal |
| Event type | Trim, then exactly CAPTURE/FAIL/REFUND |
| Timestamp | Trim at lifecycle call site; exact four-digit-year UTC seconds string; real Gregorian date |
| Attempt/capture/refund money | Trim; ASCII digits only; positive safe integer |
| FAIL money | Empty after trimming |
| Structure | A selected final row with quote error or non-five column count is excluded |
| Relationship | Event must reference a valid retained attempt and be at/after its creation |

`parsePositiveInt` actually accepts digit strings with leading zeroes, for example `"0007"` becomes 7. Its updated comment reflects that behavior. It rejects `0`, `-1`, `1.5`, `1e5`, `+1`, empty/whitespace, and integers larger than 9007199254740991. Invalid parser results contain numeric zero as a sentinel alongside `valid: false`; call sites check validity and exclude the record, rather than treating it as a legitimate zero amount.

## The six phases of processLifecycle

### Phase 1: attempt revision selection

Walk raw attempts in physical export order. Blank trimmed IDs go directly to `blankAttempts`, with a synthetic audit ID. For a repeated nonempty ID, record the previous candidate in `supersededAttempts`, then overwrite its map entry. After three occurrences, two earlier rows are superseded. This counts discarded rows, not distinct duplicated IDs.

**Do not validate first.** If a good row is followed by an invalid final revision, the entire payment is excluded. A “find last valid row” strategy would restore stale data and violate the contract. Map replacement does not move an existing key to a new insertion position, so output payment order follows first appearance of each identifier, not latest revision time.

### Phase 2: selected attempt validation

For each selected final attempt, checks run in order: quote errors, column count, merchant, channel, date, amount. First failed check produces one exclusion reason and returns from that `forEach` callback. Valid records enter `validAttemptsMap` with normalized text and parsed numeric fields.

Each invalid selected record gets one primary reason, even if several fields are wrong. Absence of a second audit reason does not imply the other fields were valid.

### Phase 3: event revision selection and validation

Events independently repeat the same final-occurrence selection keyed by `event_id`. Event validation runs quote errors, column count, referenced payment, type, timestamp, before-attempt relation, then type-specific money. An event for an excluded payment cannot resurrect it. Two different event IDs for one payment remain separate candidate events; event-ID deduplication is distinct from capture selection.

A “valid candidate event” has passed row/relationship checks, but may still fail a business rule. This distinction explains why the valid candidate count includes later rejected captures/refunds.

### Phase 4: grouping and authoritative capture

Initialize an empty event bucket for every valid attempt so attempts with no events remain visible and pending. Group valid candidates by `payment_id`. Examine CAPTURE events: equal amount is eligible, mismatch is a business rejection. Sort eligible captures by timestamp ascending then ordinal `event_id`; select only the first. All later eligible captures are recorded as duplicate business rejections with no financial effect.

For ordinary ASCII IDs, the comparator is case-sensitive character order (`A < a`). JavaScript string `<`/`>` actually uses UTF-16 code-unit lexicographic ordering. It is independent of locale, but calling it full Unicode code-point order for all possible supplementary characters would be inaccurate.

### Phase 5: status and refunds

Status precedence is:

```text
selected eligible capture exists -> captured
otherwise any valid FAIL exists  -> failed
otherwise                       -> pending
```

This is not “last event wins.” File order and FAIL chronology do not override a valid capture. Valid FAILs on captured payments are not labeled business rejections; they simply do not win precedence.

Uncaptured payments reject all candidate refunds. Captured payments sort refunds by the same timestamp/ID comparator. For each refund:

1. If before the selected capture, reject it.
2. Otherwise if its full amount fits remaining capture balance, accept it and subtract it.
3. Otherwise reject it and leave the remaining balance unchanged; continue with the next refund.

Equality is allowed: at-capture-time refunds qualify, and a refund equal to the remaining balance fully refunds the payment. There is no partial acceptance of an oversized event. Refunds never change the derived status from captured.

### Phase 6: output

Create a `DerivedPayment` per valid attempt and place it in both output array and lookup map. Attach only selected capture and accepted refunds, not all valid events. Build the quality summary from row counts and collected audit arrays. The loader returns the array and summary; the map is useful in tests but omitted from route props.

## Financial invariants

For each payment:

```text
gross = selected_capture ? attempt.amount_cents : 0
0 <= accepted_refund_cents <= gross
net_captured_cents = gross - accepted_refund_cents
0 <= net_captured_cents <= gross
```

For any filtered set F:

```text
attempts = F.length
captured = count(status == captured)
capture rate = attempts == 0 ? 0 : captured / attempts * 100
gross = sum(original amount for captured payments)
refunds = sum(accepted refunds for captured payments)
net = gross - refunds
```

Using original amount for captured gross is valid because selected capture equality has already been enforced. Failed and pending payments retain their original attempted amount in the table, but contribute zero captured revenue.

## Audit accounting

For the supplied snapshot:

- Attempt rows: `227 = 9 superseded + 2 blank + 11 excluded final + 205 valid`.
- Event rows: `265 = 2 superseded + 1 blank + 14 excluded final + 248 valid candidates`.
- Within those 248 candidates, 17 business rejections are a later classification; do not add them again to the input reconciliation equation.
- Header audit badge: `9 + 2 + 2 + 1 + 11 + 14 + 17 = 56`.
- “Excluded Final” UI tab includes blank rows: `2 + 1 + 11 + 14 = 28`.

The quality panel always describes the whole ingested snapshot. Merchant/status/search filters change financial views, not these audit counts. This is how the current code works; the UI could make that scope clearer.
