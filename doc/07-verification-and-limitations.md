# 7. Running, verification, and known limitations

## Worktree isolation

Base commit: `4556b122378f18ae1866348abfe0fc0694d51fa3`. Original repository: `../mock-02-merchant-payment-health` on `main`. Study worktree: `../mock-02-architecture-docs` on `docs/mock-02-architecture`. The new `doc/` directory is inside the Mock 2 repository on that branch; it intentionally does not appear in the untouched main checkout.

Git worktrees share repository metadata/object storage, so creating a branch/commit registers new refs in the shared repository. They have separate working files, HEAD and index; the original branch pointer and files must remain unchanged. Final checks compare original main/HEAD to the base and require an empty original status.

## Commands

From this worktree's root, install with `npm --prefix app ci` if dependencies are absent, then:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

Root scripts delegate into app/. Default dev/start uses port 3000. To inspect the separate worktree without colliding with an existing app, after building:

```bash
cd app
./node_modules/.bin/next start -p 3102
```

To run the independent reference calculation against **runtime** exports:

```bash
cd app
python3 data/verify_baseline.py
```

The Python script uses working-directory-relative `data/` paths. Running from the outer mock root selects reference exports instead. Python's date support is not identical to the JavaScript engine (notably year zero); this script is an independent fixture cross-check, not a full oracle for all possible contract dates. It prints values rather than asserting them and assumes well-shaped input enough to index columns.

## Existing test inventory

`lifecycle.test.ts` loads actual app/data through ingestion and has seven test cases: exact canonical results, channel reconciliation, export header/row count, merchant filtering, status filtering, ID substring search, zero matches.

`synthetic.test.ts` has five cases: header checks, malformed selected final attempt without fallback, mixed-case equal-time refund ordering, aggregate precision above safe Number range, years 0099/0100 and leap-year validation. The CSV record parser is imported in this test file but not comprehensively exercised by parser-specific tests.

The export test checks its current fixture header/line count; its test title's broad RFC claim is stronger than the assertions. Tests of a helper are not browser-interaction tests. No automated end-to-end browser suite is checked into this repository.

## Limitations established by code inspection

1. **CSV parser edge cases:** no comprehensive RFC conformance suite. At EOF a quoted empty field with no other data can fail the emission condition, and trailing all-empty records are discarded even if structural diagnostics exist. Header quote diagnostics are not separately rejected. Some unusual repeated quote constructions can escape the intended closing-quote checks. Keep claims limited to implemented parser features and tested inputs.
2. **CSV export:** wrapping text in quotes without doubling embedded quotes is insufficient for arbitrary IDs. IDs have no prefix restriction, so formula-leading text is also possible in spreadsheet consumers. USD export uses Number division/toFixed rather than exact integer formatting; extreme safe-cent values can lose a cent in decimal output. LF output lacks an explicit CRLF policy. These were documented, not behaviorally changed in this branch.
3. **Audit confidentiality and size:** raw invalid rows are included in client props. Hiding them in JSX does not prevent browser inspection. Synthetic fixture data has no production access-control requirement, but production personal/payment data would require a different review.
4. **Snapshot scope:** audit counts are global, financial views filtered. No live updates, upload flow, persistence, database, authentication, custom API, mutation, or gateway integration.
5. **Ingestion operational behavior:** synchronous reads/computation each dynamic request; no atomic pair-of-files read, cache, schema version registry or structured production logging. Fallback directory resolution depends on runtime layout. Unexpected exceptions are not converted by a route-level custom error boundary.
6. **Accessibility:** search lacks an explicit visible label/aria-label; modal lacks dialog semantics, focus management and Escape handling; icon-only close lacks accessible label. Loading skeleton lacks an explicit status announcement. These require improvements and assistive-technology validation before accessibility claims.
7. **UI scale and cleanup:** all rows render at once; both breakdowns compute regardless of visible tab; object URLs are not revoked after export; large values/long IDs need further layout testing. Detail overlay has no full event history.
8. **Types:** optional result fields and optional event amount rely on checked invariants rather than discriminated unions. Unused parser flags/imports remain. A comments-only task deliberately does not refactor these.

## Evidence for this documentation branch

See [verification results](verification-results.md) for executed commands, browser observations, and limitations of those checks. Never infer success from this command list alone. The branch preserves executable behavior; source-token comparison against the base supplements tests to verify that edits to TypeScript/TSX were comments only.
