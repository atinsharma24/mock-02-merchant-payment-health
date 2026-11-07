# 5. Worked examples and reconciliation

## Canonical snapshot totals

| Metric | Value |
| --- | --- |
| Valid attempts | 205 |
| Captured / failed / pending | 135 / 42 / 28 |
| Capture rate | 135 ÷ 205 × 100 = 65.85% displayed |
| Gross cents / USD | 6100539 / $61,005.39 |
| Accepted refund cents / USD | 1150483 / $11,504.83 |
| Net cents / USD | 4950056 / $49,500.56 |

| Merchant | Attempts | Captured | Gross USD | Refund USD | Net USD |
| --- | ---: | ---: | ---: | ---: | ---: |
| M-101 | 61 | 33 | 16,853.19 | 4,108.73 | 12,744.46 |
| M-202 | 44 | 35 | 13,588.75 | 743.93 | 12,844.82 |
| M-303 | 43 | 27 | 11,567.78 | 2,893.79 | 8,673.99 |
| M-404 | 57 | 40 | 18,995.67 | 3,758.38 | 15,237.29 |

These numbers are specific to committed inner CSV files. They are not hardcoded into application calculations. Tests pin them as regression expectations. See chapter 7 for checks actually executed during this documentation work.

## Trace A: PMT-00019 disappears despite an earlier valid attempt

The early row has amount 99900. A later row for the same payment has `unavailable`. Revision selection supersedes the earlier row; money validation excludes the final one. Therefore PMT-00019 is absent from the derived payment list. Its capture event references an excluded attempt and is excluded as an event relationship failure. Restoring the earlier amount would be incorrect.

PMT-00087 and PMT-00143 follow the same invalid-final-attempt pattern. This is why 208 ordinary numbered attempts become 205 valid payments, in addition to explicit bad rows being removed.

## Trace B: PMT-00008 has an invalid final capture revision

The attempt itself is valid for 1299 cents. `EVT-01008` initially supplies an equal-amount capture, but its final occurrence says `broken`. The first event revision is superseded and the final event is excluded. The payment has no retained eligible capture or FAIL, so it becomes pending. Its otherwise valid refund EVT-01009 is a business rejection on an uncaptured payment. Original amount stays $12.99, accepted refunds and net are $0.00.

This demonstrates event-ID revision selection, payment status, and business rejection are three separate steps.

## Trace C: PMT-00120 remains captured after full refund

Attempt amount: 49999 cents. Select capture EVT-01144 for the same amount. Sort refunds by timestamp:

| Refund | Amount cents | Remaining before | Decision | Remaining after |
| --- | ---: | ---: | --- | ---: |
| EVT-01145 | 24999 | 49999 | Accept | 25000 |
| EVT-01146 | 25000 | 25000 | Accept | 0 |
| EVT-01147 | 49999 | 0 | Reject | 0 |

Gross $499.99; accepted refunds $499.99; net $0.00; status captured. A zero-net filter is not implemented and is not equivalent to failed status.

## Trace D: PMT-00048 rejects an oversized later refund

Capture EVT-01058: 14999 cents. Refund EVT-01059: 5249 cents -> accept, leaving 9750. Refund EVT-01060: 14999 -> reject whole event because it exceeds remaining balance. Final accepted refunds $52.49 and net $97.50. The engine does not clip the second refund to $97.50.

## Trace E: capture wins over FAIL

PMT-00068 has a FAIL shortly after creation, then eligible capture EVT-01084, then refund EVT-01086. The valid capture determines captured status. Amount is 799 cents, refund 479, net 320 cents. FAIL does not subtract money or erase the capture.

PMT-00187 similarly has both FAIL and capture. The code examines eligible captures and existence of any FAIL; it does not replay status as a last-write-wins log.

## Trace F: duplicates versus amount mismatch

PMT-00041's later attempt revision changes channel to qr. Its selected capture EVT-01051 is 149999 cents; EVT-01052 is 150098 and is rejected for mismatch. By contrast PMT-00027 has two distinct equal-amount capture IDs: earliest EVT-01030 wins; EVT-01031 is rejected as a duplicate eligible capture. Both yield one capture, but for different reasons.

## Synthetic example: reject does not block later acceptance

Create a valid 10000-cent attempt and matching capture. Chronological refunds 8000, 3000, 2000 behave as follows: accept 8000, reject 3000 against 2000 remaining, then accept 2000. Accepted sum is 10000, not 8000 and not 13000. Inside the callback, rejection returns without decrementing remaining balance; iteration continues.

## Synthetic example: tie ordering changes accepted event

Capture 10000. At identical timestamp, refund `E-ref-a` requests 8000 and `E-ref-B` requests 5000. Ordinal sorting puts uppercase B before lowercase a, regardless of file order. Accept B's 5000, reject a's 8000, net 5000. The synthetic regression test checks this case. A locale-sensitive comparator could change financial acceptance and therefore is inappropriate here.

## Synthetic example: aggregate overflow

Two independent captured attempts have 9007199254740991 and 2 cents, each individually safe. Adding with Number yields 9007199254740992, losing a cent; summing BigInt values yields 9007199254740993. KPI output string is `"9007199254740993"`; `formatUSD` displays `$90,071,992,547,409.93`. This regression validates aggregate arithmetic and display, not the CSV export's separate Number-based decimal path.

## Empty-set example

A search with no matches yields `[]`. KPIs are 0 attempts, 0 captured, 0.00%, and all monetary cards $0.00. Merchant breakdown still has four zero rows, channel breakdown three. Table becomes an empty-state message with Reset All Filters. Export button is hidden. The global audit panel retains snapshot anomalies.
