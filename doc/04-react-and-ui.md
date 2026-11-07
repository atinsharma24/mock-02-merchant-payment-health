# 4. React and interface walkthrough

## app/src/app/page.tsx

`HomePage` is the `/` server component. It calls the synchronous loader and selects error or success UI. `force-dynamic` means later full page requests can ingest updated files; it does not poll or stream file changes into an already open dashboard. The route does not use React hooks or browser APIs.

## app/src/app/layout.tsx

`RootLayout` imports global CSS, exports page title/description metadata, declares English document language, and wraps all route content in html/body. It establishes page-wide background and antialiasing. It does not hold business state.

## app/src/app/loading.tsx

The route segment loading component shows navigation, six KPI placeholders, filter placeholders and table rows. Tailwind pulse styling supplies visual loading feedback. It is a framework loading fallback, not a custom “isLoading” state that every filter triggers. Because ingestion is synchronous and small, the skeleton may be too brief to observe. The component currently has no dedicated status role or loading announcement text; do not claim audited screen-reader accessibility.

## app/src/components/ErrorState.tsx

A client component because its retry handler calls `window.location.reload()`. Props title/message/guidance come from ingestion. It presents the error and recovery steps; retry reloads the whole document so server ingestion executes again. It does not repair files, silently invent data, or retry a custom API. `ArrowRight` is an unused import; it has no visible behavior.

## DashboardClient: state inventory

`'use client'` is needed for hooks, handlers, Blob downloads and DOM APIs.

| State | Initial value | What changing it does |
| --- | --- | --- |
| `filters` | merchant all, status all, empty search | Recomputes payment subset and all financial views |
| `showDataQuality` | false | Opens/closes global audit panel |
| `dqTab` | all | Chooses visible anomaly category |
| `breakdownView` | merchant | Switches merchant/channel table |
| `selectedPayment` | null | Opens a details overlay for one derived payment |

`initialPayments` and `initialDataQuality` are props loaded from the server, not separate mutable state copies. Controls cannot edit original records. No localStorage, URL query synchronization, cross-tab synchronization, or persistence is implemented; reload returns filters to defaults.

## Derived state and why all financial views agree

```text
initialPayments + filters
        |
        v
useMemo(filterPayments) -> filteredPayments
        |                    |                |                 |
        v                    v                v                 v
      kpis            merchantBreakdown channelBreakdown   table/export
```

The filtered memo depends on `[initialPayments, filters]`. Each summary memo depends on `[filteredPayments]`. The array is the one shared source for every financial view; storing independent KPI state would create a risk that a filter update refreshed a table but left totals stale. `useMemo` caches calculations between renders when dependencies retain identity; it is a performance convenience, not a correctness mechanism or server cache.

Functional updates `setFilters(prev => ({...prev, merchant: value}))` retain the other two filters. The select-value casts satisfy TypeScript but do not parse arbitrary trusted server inputs; these controls have fixed options. Search updates on each keystroke, with no debounce. `hasActiveFilters` is derived, not separate state. `handleResetFilters` replaces all three values together.

## Component-local functions

- `handleResetFilters`: reset merchant/status/search; does not close audit/details or change breakdown tab.
- `handleExportCSV`: get filtered CSV string, create UTF-8 Blob, object URL, temporary anchor and date-based filename, click, remove anchor. It currently does not revoke the object URL afterward.
- `getStatusBadge`: captured/failed/pending -> labeled color/icon span. It displays a computed status; it does not compute lifecycle status.
- `getChannelBadge`: qr/link/terminal -> icon and label; fallback renders supplied string.
- `totalAnomalies`: sum lengths of seven global audit arrays. It remains 56 for the canonical dataset even after filtering.

## Rendered sections in source order

1. Sticky navigation: title, snapshot-ingestion badge, audit toggle and anomaly count. “Live Data Contract Ingested” is presentation text; no live feed exists.
2. Conditional audit panel: global source counts, tabs and scrollable anomaly lists. Superseded lists, excluded lists (including blanks), and business rejections have distinct branches. Raw/sourceLocation data is retained in models but not fully exposed by this view.
3. Six KPI cards: valid attempts, captured attempts, capture rate to two decimals, gross/refunds/net through `formatUSD`. “Filtered Set” appears when filters are active.
4. Filters: labeled merchant/status selects, payment-ID search, showing count, reset button when active.
5. Breakdown: merchant/channel toggle, table with attempt/capture/rate/gross/refund/net values. Known categories stay as zero rows when filtered away.
6. Payments: count, export button only for nonempty subset, empty-state reset or table. Creation time is the original normalized UTC string, including T/Z, under a UTC heading; no browser timezone conversion occurs.
7. Conditional details overlay: selected payment, merchant/channel/status and amounts, authoritative capture and accepted refund list, close controls.

The table uses `payment_id` as stable React key; accepted refunds use `event_id`. Revision selection ensures uniqueness. Audit row lists often use prefixed index keys because repeated superseded records can share IDs; these lists are static for a loaded snapshot.

## Details overlay scope

Clicking Details stores the full derived payment object. It opens immediately without a fetch. It displays **applied financial events**, not a complete event history: no FAIL timeline, all raw revisions, or rejected event timeline. Closing sets selectedPayment to null. Changing filters programmatically while an overlay is open would not clear that selection; the overlay is independent state.

There is no focus trap, Escape handler, aria-modal/dialog role, accessible name on the icon-only close button, or backdrop-click close handler. These are real improvement areas, not guarantees supplied by the word “modal.”

## Styling and responsive design

`globals.css` includes Tailwind layers, default foreground/background and a system font stack. Tailwind scans source/component/lib paths configured in `tailwind.config.js`; PostCSS runs Tailwind and Autoprefixer. There is no design-system package. `lucide-react` supplies SVG icons.

KPI grid goes from two columns to three at `sm` and six at `lg`. Filters stack at narrower widths and become a row at `md`. Tables sit in `overflow-x-auto` wrappers: they can scroll horizontally rather than fitting every column on a phone. Header rows wrap and certain helper labels hide on small screens. Fixed pixel minimum widths, long financial totals and the overlay still need actual mobile inspection; responsive classes alone do not establish every viewport is perfect.

The details `animate-in/fade-in/zoom-in` class names have no animation plugin configured here, so those names alone do not prove the intended transition is generated. Tailwind's built-in `animate-pulse` is available for the loading skeleton.

## Follow one interaction end to end

Select M-101 -> select handler changes only `filters.merchant` -> filtered memo returns 61 payments -> KPI memo reports 33 captured and $12,744.46 net -> merchant breakdown preserves four rows with other merchants zero -> payment table shows 61 -> export contains those same 61. No filesystem read happens until reload.

Then select failed -> constraints combine with AND -> only failed M-101 payments remain -> valid attempt count reflects that subset -> captured, gross, refunds and net are zero. Audit badge remains global. This is the clearest demonstration of both consistent financial scope and separate audit scope.
