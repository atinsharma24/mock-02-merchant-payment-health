# 8. Source index

Line numbers refer to this documentation branch after explanatory comments. Use source symbols as stable search targets. Links use GitHub-style line anchors; editors may support file navigation instead.

## app/.eslintrc.json

- [Open file](../app/.eslintrc.json)

## app/data/payment_attempts.csv

- [Open file](../app/data/payment_attempts.csv)

## app/data/payment_events.csv

- [Open file](../app/data/payment_events.csv)

## app/data/verify_baseline.py

- [Line 9](../app/data/verify_baseline.py#L9): `def parse_iso(ts):`
- [Line 18](../app/data/verify_baseline.py#L18): `def parse_amount(val):`

## app/lib/csv.ts

- [Line 8](../app/lib/csv.ts#L8): `export interface CSVRowRecord {`
- [Line 17](../app/lib/csv.ts#L17): `export function parseCSVRecords(content: string): CSVRowRecord[] {`
- [Line 171](../app/lib/csv.ts#L171): `export function validateHeaders(`
- [Line 197](../app/lib/csv.ts#L197): `export function parseCSV(content: string): string[][] {`

## app/lib/lifecycle.test.ts

- [Line 12](../app/lib/lifecycle.test.ts#L12): `describe('Payment Health Lifecycle Engine - Canonical Dataset Ingestion', () => {`
- [Line 20](../app/lib/lifecycle.test.ts#L20): `it('correctly processes canonical dataset and matches exact expected assessment results', () => {`
- [Line 86](../app/lib/lifecycle.test.ts#L86): `it('calculates channel breakdown accurately', () => {`
- [Line 102](../app/lib/lifecycle.test.ts#L102): `it('exports filtered payments as valid RFC-4180 CSV', () => {`
- [Line 109](../app/lib/lifecycle.test.ts#L109): `it('correctly filters by single merchant and updates all 6 KPIs and breakdown', () => {`
- [Line 133](../app/lib/lifecycle.test.ts#L133): `it('correctly filters by status', () => {`
- [Line 170](../app/lib/lifecycle.test.ts#L170): `it('correctly filters by payment ID search', () => {`
- [Line 188](../app/lib/lifecycle.test.ts#L188): `it('handles zero matches gracefully with all 6 KPIs zeroed and 0.00% capture rate', () => {`

## app/lib/lifecycle.ts

- [Line 35](../app/lib/lifecycle.ts#L35): `export function compareOrdinal(a: string, b: string): number {`
- [Line 46](../app/lib/lifecycle.ts#L46): `export function compareEventsChronologically<T extends { event_at_ms: number; event_id: string }>(`
- [Line 61](../app/lib/lifecycle.ts#L61): `export function parseIsoUtc(ts: string): { valid: boolean; ms: number } {`
- [Line 95](../app/lib/lifecycle.ts#L95): `export function parsePositiveInt(val: string): { valid: boolean; amount: number } {`
- [Line 107](../app/lib/lifecycle.ts#L107): `export interface LifecycleProcessingResult {`
- [Line 119](../app/lib/lifecycle.ts#L119): `export function processLifecycle(`
- [Line 576](../app/lib/lifecycle.ts#L576): `export function filterPayments(payments: DerivedPayment[], filters: FilterState): DerivedPayment[] {`
- [Line 604](../app/lib/lifecycle.ts#L604): `export function calculateKPIs(filteredPayments: DerivedPayment[]): FinancialKPIs {`
- [Line 636](../app/lib/lifecycle.ts#L636): `export function calculateMerchantBreakdown(filteredPayments: DerivedPayment[]): MerchantBreakdownRow[] {`
- [Line 679](../app/lib/lifecycle.ts#L679): `export function calculateChannelBreakdown(filteredPayments: DerivedPayment[]): ChannelBreakdownRow[] {`
- [Line 723](../app/lib/lifecycle.ts#L723): `export function exportPaymentsToCSV(payments: DerivedPayment[]): string {`
- [Line 757](../app/lib/lifecycle.ts#L757): `export function formatUSD(centsInput: string | bigint | number): string {`

## app/lib/loadData.ts

- [Line 16](../app/lib/loadData.ts#L16): `export const EXPECTED_ATTEMPTS_HEADER = [`
- [Line 24](../app/lib/loadData.ts#L24): `export const EXPECTED_EVENTS_HEADER = [`
- [Line 37](../app/lib/loadData.ts#L37): `export function getCanonicalDataDir(): string {`
- [Line 57](../app/lib/loadData.ts#L57): `export function loadAndProcessData(): LoadDataResult {`

## app/lib/synthetic.test.ts

- [Line 14](../app/lib/synthetic.test.ts#L14): `describe('Hand-computable Boundary Edge Cases & Readiness Regressions', () => {`
- [Line 15](../app/lib/synthetic.test.ts#L15): `it('1. Header validation: validates exact contract and detects malformed/renamed headers', () => {`
- [Line 31](../app/lib/synthetic.test.ts#L31): `it('1b. Final-occurrence-before-validation: malformed final row supersedes earlier valid row and is excluded without fallback', () => {`
- [Line 70](../app/lib/synthetic.test.ts#L70): `it('2. Deterministic ordinal comparator and mixed-case equal-timestamp refund test', () => {`
- [Line 132](../app/lib/synthetic.test.ts#L132): `it('3. Exact aggregate money calculations: 9007199254740991 + 2 cents totals 9007199254740993 and displays $90,071,992,547,409.93', () => {`
- [Line 188](../app/lib/synthetic.test.ts#L188): `it('4. Calendar-year parsing: year 0099 attempt followed by year 0100 capture, plus leap-year validations', () => {`

## app/lib/types.ts

- [Line 1](../app/lib/types.ts#L1): `export type MerchantId = 'M-101' | 'M-202' | 'M-303' | 'M-404';`
- [Line 2](../app/lib/types.ts#L2): `export type Channel = 'qr' | 'link' | 'terminal';`
- [Line 3](../app/lib/types.ts#L3): `export type EventType = 'CAPTURE' | 'FAIL' | 'REFUND';`
- [Line 4](../app/lib/types.ts#L4): `export type DerivedStatus = 'captured' | 'failed' | 'pending';`
- [Line 7](../app/lib/types.ts#L7): `export interface RawPaymentAttempt {`
- [Line 19](../app/lib/types.ts#L19): `export interface RawPaymentEvent {`
- [Line 31](../app/lib/types.ts#L31): `export interface ValidPaymentAttempt {`
- [Line 40](../app/lib/types.ts#L40): `export interface ValidPaymentEvent {`
- [Line 51](../app/lib/types.ts#L51): `export interface DerivedPayment {`
- [Line 65](../app/lib/types.ts#L65): `export interface SupersededRecord {`
- [Line 73](../app/lib/types.ts#L73): `export interface ExcludedFinalRecord {`
- [Line 81](../app/lib/types.ts#L81): `export interface RejectedBusinessEvent {`
- [Line 89](../app/lib/types.ts#L89): `export interface DataQualitySummary {`
- [Line 108](../app/lib/types.ts#L108): `export interface FinancialKPIs {`
- [Line 117](../app/lib/types.ts#L117): `export interface MerchantBreakdownRow {`
- [Line 127](../app/lib/types.ts#L127): `export interface ChannelBreakdownRow {`
- [Line 137](../app/lib/types.ts#L137): `export interface FilterState {`
- [Line 143](../app/lib/types.ts#L143): `export interface IngestionErrorDetails {`
- [Line 149](../app/lib/types.ts#L149): `export interface LoadDataResult {`

## app/package.json

- [Open file](../app/package.json)

## app/postcss.config.js

- [Open file](../app/postcss.config.js)

## app/src/app/globals.css

- [Open file](../app/src/app/globals.css)

## app/src/app/icon.svg

- [Open file](../app/src/app/icon.svg)

## app/src/app/layout.tsx

- [Line 4](../app/src/app/layout.tsx#L4): `export const metadata: Metadata = {`
- [Line 9](../app/src/app/layout.tsx#L9): `export default function RootLayout({`

## app/src/app/loading.tsx

- [Line 3](../app/src/app/loading.tsx#L3): `export default function Loading() {`

## app/src/app/page.tsx

- [Line 8](../app/src/app/page.tsx#L8): `export const dynamic = 'force-dynamic';`
- [Line 10](../app/src/app/page.tsx#L10): `export default function HomePage() {`

## app/src/components/DashboardClient.tsx

- [Line 36](../app/src/components/DashboardClient.tsx#L36): `interface DashboardClientProps {`
- [Line 41](../app/src/components/DashboardClient.tsx#L41): `export default function DashboardClient({`
- [Line 59](../app/src/components/DashboardClient.tsx#L59): `const filteredPayments = useMemo(() => {`
- [Line 64](../app/src/components/DashboardClient.tsx#L64): `const kpis = useMemo(() => {`
- [Line 69](../app/src/components/DashboardClient.tsx#L69): `const merchantBreakdown = useMemo(() => {`
- [Line 74](../app/src/components/DashboardClient.tsx#L74): `const channelBreakdown = useMemo(() => {`
- [Line 81](../app/src/components/DashboardClient.tsx#L81): `const handleResetFilters = () => {`
- [Line 91](../app/src/components/DashboardClient.tsx#L91): `const handleExportCSV = () => {`
- [Line 103](../app/src/components/DashboardClient.tsx#L103): `const getStatusBadge = (status: DerivedStatus) => {`
- [Line 129](../app/src/components/DashboardClient.tsx#L129): `const getChannelBadge = (channel: string) => {`
- [Line 155](../app/src/components/DashboardClient.tsx#L155): `const totalAnomalies =`

## app/src/components/ErrorState.tsx

- [Line 6](../app/src/components/ErrorState.tsx#L6): `interface ErrorStateProps {`
- [Line 12](../app/src/components/ErrorState.tsx#L12): `export default function ErrorState({ title, message, guidance }: ErrorStateProps) {`
- [Line 14](../app/src/components/ErrorState.tsx#L14): `const handleRetry = () => {`

## app/tailwind.config.js

- [Open file](../app/tailwind.config.js)

## app/tsconfig.json

- [Open file](../app/tsconfig.json)

## Supporting assets and configuration

- Root `package.json`: scripts delegate into app with npm --prefix; no separate root dependency installation is needed.
- `app/package.json`: framework/runtime/development dependencies and scripts; semver ranges describe allowed installs, while the lockfile pins resolved dependencies.
- `app/package-lock.json`: reproducible dependency resolution; generated package metadata, not app business logic.
- `app/.eslintrc.json`: Next core-web-vitals lint preset.
- `app/tsconfig.json`: strict checks, ES2020 target (BigInt support), bundler module resolution, Next plugin and generated route types.
- `app/tailwind.config.js`: content globs and default theme; no custom animation plugin.
- `app/postcss.config.js`: Tailwind and Autoprefixer pipeline.
- `app/src/app/icon.svg` and `app/public/favicon.ico`: local branding assets; no business logic.
- `.gitignore`: ignores dependencies, generated builds, environment files, caches and logs.
- Outer `data/` versus `app/data/`: reference copy versus normal runtime/test copy.
- `submission/`: present in the original checkout but no tracked application logic is sourced from it.
- `next-env.d.ts` and `.next/`: generated by Next tooling and ignored; do not confuse them with handwritten modules.
