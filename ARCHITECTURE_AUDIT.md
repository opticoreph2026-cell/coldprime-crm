# Coldprime CRM — Architecture Overview & Audit

- **Audited at:** commit `ff45bc7` (main, pushed & promoted to production `https://coldprime-crm.vercel.app`)
- **Scope:** full repository, data model, auth/branch security, validation & audit coverage, dependencies, tests, deployment
- **Method:** static analysis of all 48 API routes / 20 pages, `prisma validate`, `tsc --noEmit`, `eslint`, `vitest` (57 tests), 8 live production probes, `npm audit --omit=dev`

---

## 1. Executive summary

Coldprime CRM is a multi-branch sales CRM (companies → contacts → leads → projects, plus vendors, price lists, email outreach and weekly reporting) built as a single Next.js 16 App Router application on Vercel with Supabase PostgreSQL.

**Overall health: strong and shippable.** All six phases of the master instructions are complete, committed per-phase, deployed, and verified green:

| Gate | Result |
|---|---|
| `npx prisma validate` | ✅ pass |
| `npx tsc --noEmit` | ✅ pass |
| `npm run lint` | ✅ pass |
| `npm test` (vitest) | ✅ **57/57** |
| Live production probes (8 suites) | ✅ **all green** (phase4 15/15, products 22/22, emails 23/23, reports 17/17, layout 10/10, dashboard, validation 20/20, sweep clean) |
| Vercel production build | ✅ passes (local `npm run build` fails — win32 Turbopack/lightningcss native module, environment-only) |
| `npm audit --omit=dev` | ❌ **12 vulnerabilities (1 critical, 6 high, 4 moderate, 1 low)** — top remediation item |

**Top 3 actions:** (1) run `npm audit fix` + bump `next`→16.4.6 and `zod`→4.6.7; (2) add `logAudit` to the 11 mutation routes that lack it (user/status management especially); (3) resolve the 7 owner-blocked questions (sending domain, Rose format, margin link, SEED_KEY, doc conflicts, rate-limit ownership).

---

## 2. Architecture overview

### 2.1 Technology stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js **16.3.6** (App Router, RSC, Turbopack) + React **19.2** + TypeScript 5 | 20 pages, 48 API route handlers |
| Auth | NextAuth **v5 beta** (`lib/auth.ts`), Credentials provider, **bcryptjs**, JWT strategy | role/branch re-read from DB on every request |
| Database | PostgreSQL (Supabase pooler) via **Prisma 7.8** with *custom client* output at `lib/prisma/client` + `@prisma/adapter-pg` | 17 models, 5 enums, 13 SQL migrations |
| Validation | **zod 4** — one schema file per entity in `lib/validations/` | every JSON body validated (32/32 body routes) |
| Styling | **Tailwind CSS v4** (postcss) + custom CSS wrapped in `@layer components` | ~96% of inline styles converted to utilities; 21 residual style props are spread-helpers/dynamic by design |
| Email | **nodemailer** (Gmail SMTP send), **imapflow** + **mailparser** (IMAP reply detection), optional Resend fallback | daily Vercel cron reads the mailbox |
| Reports | **exceljs** (XLSX), **jspdf** + **jspdf-autotable** (PDF) | styled like the existing export |
| Charts/UI | recharts (dashboard), lucide-react (icons), sonner (toasts) | |
| Tests | **vitest 5** (unit) + `scripts/test-live-*.ts` (11 authenticated production probes) | |
| Deploy | **Vercel** (preview → manual `vercel promote`), crons in `vercel.json` | every push builds as Preview only |

### 2.2 Directory map

```
middleware.ts           # login rate limit (10/15 min/IP), public paths, cron bearer gate
app/                    # App Router
  <page>/page.tsx       # 20 pages: dashboard, companies(+[id] 8 tabs), contacts, leads,
                        #   projects, activities, vendors(+[id]), products, emails(compose/sent),
                        #   email-templates, import-export, reports, users, admin/statuses, login
  api/**/route.ts       # 48 REST handlers (JSON + formData imports)
  globals.css           # theme vars + @layer components (.btn*, card, table helpers)
components/
  layout/sidebar.tsx    # branch-aware nav (no hardcoded branch IDs)
  ui/index.tsx          # Button, Table, Badge, Modal, ConfirmDialog, PageHeader, FormField,
                        #   Card, Pagination, SearchInput, Empty/Loading/Error states
  providers.tsx         # session + sonner provider
lib/
  branch.ts             # getBranchFilter / requireBranchId / requireRole / requireAuth
  auth.ts, auth.config.ts
  audit.ts              # logAudit → AuditLog
  prisma.ts             # singleton client (custom Prisma 7 client in lib/prisma/client)
  validations/*.ts      # 14 zod schema files + parseOr400/readJson helpers
  dates.ts, reports/*   # Manila-time date math, weekly report builder/PDF/XLSX, KPI map
  email/guard.ts        # anti-spam rules (opt-out, caps, 7-day/Nurture, tags, linter)
  email/templates.ts, email.ts, imap.ts, mailbox.ts, reply-check.ts
  excel/{import,export}.ts, price-list.ts, cost.ts, status.ts, enums.ts, types.ts
prisma/schema.prisma    # 17 models; migrations/001–013 (*.sql, applied via scripts/db-run-migration.ts)
scripts/                # db utils/migrations, seeds, import-masterlist, 11 live probes, style converter
types/                  # models.ts (canonical shared types; lib/types.ts re-export shim)
src/                    # empty (leftover — safe to delete)
```

### 2.3 Request flow (layering)

```
browser/cron
  → middleware.ts            rate-limit credentials POST · allow /login,/api/auth · verify Bearer CRON_SECRET for cron
  → route handler (app/api/*)
      1. requireAuth()               401 + DB re-check of user.isActive
      2. getBranchFilter()/requireBranchId()/requireRole()   branch scoping (41/48 routes)
      3. parseOr400(schema, await readJson(request))         zod → 400 with field-level errors
      4. prisma query (branch-scoped; entity lookups 404 on branch mismatch)
      5. logAudit({branchId, action, entity, entityId})      AuditLog (27/38 mutation routes)
      6. NextResponse.json
  → NextResponse
```

Reads are scoped by `getBranchFilter()` (HEAD_ADMIN with no active branch → `{}` = all branches). Writes require `requireBranchId()` (always a concrete branch). Entity-level guards compare the row's `branchId` and return **404** (not 403) to avoid leaking existence across branches.

### 2.4 Data model (17 models, 5 enums)

- **Identity:** `Branch` (slug/domain), `User` (bcrypt password, `branchId` home branch, `activeBranchId` for HEAD_ADMIN switching, `role` ∈ `UserRole`, `isActive`, signature)
- **CRM core:** `Company` (type, accreditation timestamps/outreach status, 3 mobiles + 3 landlines), `Contact` (**emailOptOut**), `Lead` (status/priority/value/follow-ups, branch-scoped), `Project` (quotation→start→completion lifecycle), `Activity` (typed timeline rows — the source for weekly-report KPIs), `StatusDefinition` (per-branch configurable lead/project statuses w/ sortOrder), `Document` (polymorphic file links), `ImportBatch` (import provenance)
- **Audit:** `AuditLog` (userId, **branchId NOT NULL**, action, entity, entityId, ipAddress)
- **Reporting:** `WeeklyReportNote` (per user × weekStart highlights/blockers)
- **Email:** `EmailTemplate` (category, isActive), `EmailLog` (fromUserId, toEmail, subject, sentAt, `deletedAt` soft delete, errorCode)
- **Supply chain:** `Vendor` → `VendorContact` / `VendorMaterial` (unit price, validity, lead time), `Product` (sell price book, `leadTimeDays`, price validity)

**Multi-tenancy:** every business row carries `branchId`; the branch is enforced in the API layer (not the DB), which keeps queries simple but means *every new route must apply the guard* — the audit checks this (§3.2).

### 2.5 Auth & authorization model

- **Session:** JWT (`next-auth` v5) containing userId/role/branch; `jwt`/`session` callbacks **re-read role, branch and active-user status from the DB every request**, so demotions/lockouts take effect immediately instead of at token expiry.
- **Guards:** `requireAuth` (401, re-validates `isActive`), `getBranchFilter` (read scope; HEAD_ADMIN may hold `{}` = all branches), `requireBranchId` (write scope, falls back `activeBranchId || branchId`), `requireRole([...])` (admin-only surfaces: user CRUD, statuses…).
- **Middleware:** public paths `/login`, `/api/auth`; **login rate limit 10 attempts/15 min per IP** on the credentials callback (429); cron endpoint accepts `Authorization: Bearer $CRON_SECRET`.
- **Privilege separation:** `switch-branch` is **HEAD_ADMIN-only** (403 otherwise) and validates the target branch exists — verified not exploitable for cross-tenant reads. Vendor **cost fields are stripped for STAFF** (`lib/cost.ts`), price-list import likewise role-aware.
- **Password hygiene:** bcryptjs compare in `authorize`; `scripts/rotate-admin-password.ts` for rotation.

### 2.6 Key subsystems

1. **Weekly Accomplishment Report** — `lib/dates.ts` (Manila-time week math, month-crossing ranges) + `lib/reports/weekly.ts` builds KPI rows from `AuditLog`/`Activity` pipeline moves, `weekly-xlsx.ts`/`weekly-pdf.ts` export, `/reports` UI with range picker + per-week notes (`WeeklyReportNote`). 25 unit tests cover the 1.11 acceptance list.
2. **Products & price book** — `Product` sell prices vs `VendorMaterial` costs; CSV/XLSX import with preview + `rawData` cell capture; price validity & lead-time columns; cost-gated for STAFF.
3. **Email outreach** — templates (6 seeded), compose with `{{tag}}` substitution, SMTP send → `EmailLog`, **anti-spam `lib/email/guard.ts`** (opt-out block/append, single recipient, daily cap `EMAIL_DAILY_CAP` default 30, 7-day + Nurture throttles, unknown-tag rejection, spam/ALL-CAPS/link linter, free-mail & attachment warnings — 19 tests), soft delete + purge, contact opt-out mark/undo, bulk send with tag validation, **IMAP reply check** via daily cron (01:00) updating `lastRepliedAt`.
4. **Import/Export** — master-list Google-Sheet import (`scripts/import-masterlist.ts`), generic `/api/import` with zod `importActionSchema`, products/vendors imports, Excel export of companies/contacts/leads.
5. **Dashboard** — this-week stats computed with Manila boundaries (notIn Won/Lost active leads), setup checklist, pipeline chart (recharts).
6. **Admin** — user CRUD (role validation, HEAD_ADMIN assigns roles/branches), status-definition CRUD + reorder, profile self-service, branch switcher.

### 2.7 Frontend architecture

Single shared layout (`app/layout.tsx`) with fixed app shell (only tables scroll), branch-aware `sidebar.tsx`, and a component library in `components/ui/index.tsx`. Styling is Tailwind v4 utilities layered over `@layer components` custom CSS (so future utilities always win over component classes). All 20 pages were converted from inline styles to utilities by `scripts/convert-inline-styles.mjs` (96%; the 21 remaining style props are `inputStyle/btnStyle/tabStyle/labelStyle` spreads and runtime-computed values).

### 2.8 Deployment & operations

- **Repo → Vercel:** pushes to `main` build as *Preview*; production requires manual `vercel promote` (project branch setting).
- **Database migrations:** `prisma db push`/`migrate dev` hang in this environment, so schema changes are hand-written SQL in `prisma/migrations/001–013` applied via `scripts/db-run-migration.ts`, followed by `npx prisma generate`. `scripts/db-schema-audit.ts` detects schema drift.
- **Cron:** `vercel.json` → `GET /api/emails/check-replies` daily at 01:00 with `CRON_SECRET`.
- **Env vars:** `DATABASE_URL`, `AUTH_SECRET`, `AUTH_ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GMAIL_USER`/`GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME`, `EMAIL_DAILY_CAP` (optional), `CRON_SECRET`, `RESEND_API_KEY` (optional). `.env.example` documents all of them. **`SEED_KEY` from the instructions was never implemented** (seeding uses local scripts).
- **Seeding:** `npm run seed` hangs in this environment; focused scripts are used instead (`seed-email-templates.ts`, `seed-lead-statuses.ts`, `seed-accreditation-template.ts`).

### 2.9 Testing strategy

- **Unit (vitest, 57 tests / 6 files):** `dates.test.ts` (13), `reports/weekly.test.ts` (12), `email/guard.test.ts` (19), `cost.test.ts` (3), `excel/import.test.ts` (3), `price-list.test.ts` (7).
- **Live probes (11 scripts):** login, dashboard, emails, layout, phase4, products, reports, restructure, statuses, sweep (all-endpoint 5xx scan), validation. They run against production with real credentials and are re-run after every promote.
- **Gates before each phase commit:** `tsc --noEmit`, `eslint`, `npm test`, `prisma validate`, then post-deploy probes.

---

## 3. Audit findings

### 3.1 Strengths

- **Consistent, defensive route pattern** — auth → branch scope → zod → scoped query → 404-on-mismatch → audit; applied uniformly across 48 routes.
- **Session freshness** — role/branch/isActive re-read from DB on every request (revocation works immediately).
- **100% body validation** — every JSON body passes through a zod schema with field-level 400s; query params validated where they drive logic (`from/to/userId/format`).
- **Tenant isolation verified** — cross-branch reads return 404; HEAD_ADMIN all-branches view (`{}`) is deliberate and the only bypass; `switch-branch` is HEAD_ADMIN-only.
- **Email compliance** — opt-out enforced at send time and appended to content; caps and throttles tested (19 tests); soft-delete + purge semantics.
- **Test depth for the domain** — date/timezone edge cases (Manila boundaries, month crossings) and pipeline-move KPI semantics are unit-tested, then re-verified live.
- **Observability** — `AuditLog` on 27 mutations, `ImportBatch` provenance, schema-drift probe, endpoint sweep probe.
- **Documented known issues** — local build failure, rate limiter limitations and env quirks are all written down rather than hidden.

### 3.2 Findings

| ID | Severity | Area | Finding | Recommendation |
|---|---|---|---|---|
| **SEC-01** | 🔴 **Critical/High** | Dependencies | `npm audit --omit=dev`: **12 vulns (1 critical, 6 high, 4 moderate, 1 low)**. `next@16.3.6` is in the vulnerable range 16.0.0–16.4.4 (critical: image-opt RCE/SSRF w/ SVG, SSG/ISR cache poisoning, `use cache` leaks) → **16.4.6 available**; `zod@4.6.5` high (ReDoS/memory on large collections) → **4.6.7**; `sharp` high (librsvg CVE); `effect`/`@prisma/config` high (ReDoS — Prisma CLI build-time only, fix needs breaking prisma downgrade); `nodemailer@10.0.10` moderate (addressparser); `fast-uri`, `ip-address`, `source-map-js`, `dompurify` moderate/low | Run `npm audit fix` (non-breaking: covers next, zod, sharp, nodemailer, fast-uri, ip-address, source-map-js, dompurify), then bump `next` to `^16.4.6` and `zod` to `^4.6.7`. Track Prisma upstream for the `effect` advisory (build-time, not runtime). |
| **AUD-01** | 🟠 Medium | Audit coverage | **11 of 38 mutation routes never call `logAudit`:** `users` POST/PUT/DELETE, `status-definitions` POST/PUT/DELETE + `reorder`, `reports/notes` PUT, `import` POST, `emails/templates` POST, `profile` PUT, `auth/switch-branch` POST, `emails/check-replies` (cron) | Add audit entries at least for **users, status-definitions, reports/notes, import, email templates** (state-changing, admin-visible). `profile`/`switch-branch`/cron can be accepted as self-actions or logged cheaply. |
| **SEC-02** | 🟠 Medium | Security | Login rate limiter is an **in-memory `Map` per serverless instance** — resets on cold start/deploy and is ineffective across instances behind a load balancer (documented as best-effort) | Move to Upstash Redis / Vercel KV, or accept and document explicitly for the owner. |
| **SEC-03** | 🟡 Low | Information disclosure | `GET /api/branches` returns **all active branches** (id/name/slug) to any authenticated user — needed for labels but also feeds the switcher UI | Filter to the user's own branch for non-HEAD_ADMIN, or accept (names are visible in shared reports anyway). |
| **SEC-04** | 🟡 Low | Security | Cron bearer check uses plain `===` (timing-unsafe) and only when `CRON_SECRET` is set — if the env var is missing the endpoint falls back to session auth (safe, but cron then 401s) | Compare with `crypto.timingSafeEqual`; assert `CRON_SECRET` is set in Vercel env. |
| **QA-01** | 🟡 Low | Build | Local `npm run build` fails: `Cannot find module 'lightningcss.win32-x64-msvc.node'` (Turbopack win32). Vercel builds pass — environment-only | Reinstall `node_modules` / `npm rebuild lightningcss`; otherwise rely on Vercel + `tsc` gate (current practice). |
| **QA-02** | 🔵 Info | Code hygiene | 21 inline `style={{` props remain (by design: `inputStyle/btnStyle/tabStyle/labelStyle/cardStyle` spreads, `card.color`/width-template runtime values); empty `src/` directory; `xlsx` installed from a CDN tarball (can't be patched by npm audit) | Optional: replace style helpers with component props; delete `src/`; pin/mirror the sheetjs tarball. |
| **TEST-01** | 🔵 Info | Test coverage | Company-detail **Emails tab** (newest UI feature) has no probe assertion; no browser-level E2E (probes assert HTTP + markup only) | Extend `test-live-phase4.ts` or add a probe asserting the Emails tab renders for a company with logs. |
| **DOC-01** | 🔵 Info | Process | Doc/repo conflicts unresolved: `bulk-send` exists vs “no bulk sending”; templates at `/api/emails/templates/` vs `/api/email-templates/`; `SEED_KEY` documented but never implemented; login rate limit ownership (10/15 min) undecided | Reconcile the master instructions with the shipped behavior, or change behavior to match the doc. |
| **OPS-01** | 🔵 Info | Ops | Every push needs a manual `vercel promote` (project production-branch setting); `npm run seed` and `prisma db push` hang in this environment (mitigated by scripts) | Set production branch = `main` in Vercel to auto-deploy; keep migration scripts as the documented path. |

### 3.3 Coverage metrics

| Metric | Value |
|---|---|
| API route handlers | 48 (20 GET, 38 mutation handlers) |
| JSON bodies validated with zod | **32 / 32 (100%)** |
| Routes with `getBranchFilter`/`requireBranchId`/`requireRole` | **41 / 48**; the other 7 all authenticate via `auth()` and are self/list-scoped (verified) |
| Mutation routes calling `logAudit` | **27 / 38 (71%)** — gap = AUD-01 |
| Prisma models / enums / migrations | 17 / 5 / 13 (`001`–`013`) |
| Pages / shared UI components | 20 / 12 (Button, Table, Badge, Modal, …) |
| Unit tests / live probe suites | **57 / 11** |
| Known TODO/FIXME markers | 0 (only a comment inside generated Prisma client) |
| Dependency vulnerabilities | **12** (1 critical, 6 high, 4 moderate, 1 low) |

---

## 4. Prioritized backlog

**P0 — do next**
1. `npm audit fix` + `next@^16.4.6`, `zod@^4.6.7` (SEC-01); re-run probes after promote.

**P1 — this month**
2. Add `logAudit` to users / status-definitions / reports-notes / import / email-templates (AUD-01).
3. Decide on rate-limiter store (SEC-02) and confirm `CRON_SECRET` is set in Vercel (SEC-04).

**P2 — when convenient**
4. Probe for the company Emails tab (TEST-01); filter `GET /api/branches` (SEC-03); delete empty `src/` (QA-02).

**Owner decisions (blocked)**
5. Sending-domain SPF/DKIM · “Accomplishment Report Rose” format sheet · Product↔VendorMaterial margin link · `SEED_KEY` removal · doc conflicts (bulk-send, template path) · rate-limit ownership.

---

*Generated by OpenCode on 2026-11-24 from repository state `ff45bc7`.*
