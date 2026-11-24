# DECISIONS — Coldprime Platform

- **Created:** 2026-11-24
- **Document hierarchy (per master §0/line 8):** `COLDPRIME_MASTER_INSTRUCTIONS.md` > `COLDPRIME_FEATURE_SPEC.md` > `ARCHITECTURE_AUDIT.md`
- **Current codebase baseline:** `ff45bc7` (deployed; all old 6-phase work complete)
- **Status:** awaiting Julius's Phase 0 confirmation. No platform code has been written yet.

---

## 1. Input register (master §2)

Legend: **BLOCKED** = needed from Julius/Accounting, no default allowed · **DEFAULTED** = a default is recorded and will be used unless Julius overrides · **RESOLVED** · **OPEN (decide by)**

| ID | Input | Needed before | Status | Notes / action |
|---|---|---|---|---|
| I-1 | Sample real quotations: client PDF + Excel BOQ/costing (e.g. CEC0622) | Phase 3 | **BLOCKED** | Pricing engine cannot be built without them (no default allowed). Ask for 2–3 recent quotations incl. at least one with revisions. |
| I-2 | Pricing rules: "supplier-discount spread", markup tables (materials/labor/lumps), rounding, discount-line behavior | Phase 3 | **BLOCKED** | Needs a written definition. Request a filled worksheet; if none exists, request a 60-min walkthrough session and I will write it up for sign-off. |
| I-3 | Terms 1–12 text, bank details, PCAB/TIN/registration per branch, client PDF layout reference | Phase 5 | **BLOCKED** | Request: current quotation PDF template (blank) + letterhead + bank details per branch. |
| I-4 | Approval thresholds: discount threshold (Sales Manager), PO approval matrix by amount, approvers | Phases 5, 8 | **BLOCKED** (placeholders permitted) | Will seed Setup with values marked `UNCONFIRMED`; approval chains stay disabled in production until confirmed. |
| I-5 | App split | Phase 1 | **RESOLVED** (2026-11-24) | **6 sections:** Sales · Design · Purchasing · Operations · Projects · Admin/Setup. Billing & Collections is a tab group inside Projects (C-11). |
| I-6 | First vendor price lists (names, formats, samples) | Phase 3 | **BLOCKED** (default allowed) | Default: seed from existing data only. **Current data is nearly empty** (1 vendor, 1 product, 1 vendor material) — see §2; a real price-list file is effectively required for a usable Phase 3. |
| I-7 | Accounting software (export layout) | Phase 6 | **BLOCKED** (default allowed) | Default: generic CSV/XLSX with documented columns until the software is named. |
| I-8 | Withholding-agent status + BIR e-invoicing coverage (Accounting) | Phase 6 | **BLOCKED** (default allowed) | Default: structured invoice fields + issuance log built, switched **off** per branch. B8 is Must in Phase 6; raise with Accounting at Phase 6 start. |
| I-9 | Field mode (mobile/offline) in v1? | End of Phase 6 | **OPEN** (decide by) | Default: **not in Release 1**; pulled forward as its own phase only if confirmed (master §Phase 10). |
| I-10 | Hosting target, private object storage, expected user count/roles, backup target | Phase 0 | **RESOLVED** (2026-11-24) | See §7. Vercel (stay) · **Supabase Storage** with signed URLs · **separate Supabase project** for staging · **PITR + nightly logical dumps** (RPO ≈ 5 min, RTO ≈ 2 h) · **11–30 users at R1 go-live** (~13 roles → permission sets) |

---

## 2. Current production data profile (read-only snapshot, 2026-11-24)

| Table | Rows |
|---|---|
| Users | 3 (1 HEAD_ADMIN, 2 STAFF) |
| Branches | 2 |
| Companies | 129 |
| Contacts | 15 |
| **Leads** | **0** |
| **Projects** | **0** |
| **Activities** | **0** |
| Products | 1 |
| Vendors / Vendor materials | 1 / 1 |
| Documents | 0 |
| Email logs / templates | 154 / 22 |
| Audit logs | 230 |
| Leads with `estimatedValue` / linked to company | 0 / 0 |

**Implications (record now, verify in Phase 0 `docs/DATA_AUDIT.md`):**
1. **C-1 (Lead → Opportunity) is low-risk today** — there are zero leads, so no `legacy_amount` reconciliation is needed unless data is entered before Phase 2. Recommend a temporary "no new deals" guideline or accept re-entry; decide with Julius.
2. **Phase 9 has no legacy projects** to migrate; Phase 3's item master has essentially nothing to migrate (1 product) — the real work is the new import (I-6).
3. The 129 companies are the only meaningful dataset; Phase 2 account-role work must handle them (type/industry mapping) — profile in `docs/DATA_AUDIT.md`.
4. 154 email logs + 230 audit rows must survive the Phase 2 table/model rename (`Lead` → `Opportunity` touches only the lead table; email logs unaffected).

---

## 3. Accepted deliberate changes from the spec (master §9)

C-1 (Lead→Opportunity moved to Phase 2), C-2 (Phase 1 split 1a/1b, registry for 3 objects first), C-3 (release cut line R1 = Phases 0–6), C-4 (central access policy layer + path-by-path test matrix, incl. audit masking/search/exports/reports), C-5 (B8 e-invoicing Must in Phase 6, default off), C-6 (S10/Q12→Phase 12; S13→Phase 2; S12/P11/O10 deferred), C-7 ("Feed" not "Chatter"), C-8 (custom-field indexing design + 50k-row benchmark in Phase 1b), C-9 (input→phase mapping), C-10 (extra blocking inputs §2), C-11 (one website, 6 sections, Billing inside Projects).

All accepted as written. No reinterpretation.

---

## 4. Release cut line (master §4) — proposed, awaiting confirmation

| Release | Phases | Content | Go-live |
|---|---|---|---|
| R1 — Revenue spine | 0–6 | Shell, permissions/FLS, Setup, Lead→Opportunity→quotation→customer PO→Won→invoices/collections/2307 | **Yes (first production)** |
| R2 — Design & Purchasing | 7–8 | Design requests/schedules/take-offs/VE; requisition→RFQ→canvass→PO→receiving | Yes |
| R3 — Delivery | 9–10 | Projects full, Operations, field mode (if I-9) | Yes |
| R4 — Intelligence | 11–13 | Automations, builders, targets, hardening | Yes |

Confirmed by OpenCode as the working plan; awaiting Julius's explicit approval before Phase 1 planning.

---

## 5. Working agreements (acknowledged)

- One phase at a time; no phase starts before the previous exit gate is met **and Julius confirms**.
- Stop-and-ask triggers: unwritten pricing rules, tax/BIR questions, permission/threshold decisions, destructive migrations, document conflicts.
- Every mutation keeps the pattern: auth → branch → permission → zod → scoped query → 404 → audit.
- FLS server-side only; cost never in client DTOs without capability.
- Forward-only migrations, rehearsed on a production-shaped copy, with rollback notes.
- Tests ship with code (unit, golden pricing, E2E, access matrix); no skipped/failing tests at a gate.
- No new inline-style helpers; no hard-coded status names/tax rates/thresholds/numbering.
- Original branding; "Feed" not "Chatter"; no Salesforce marks in UI.
- Docs are deliverables; phase report in `docs/PHASE_REPORTS/phase-N.md`.

---

## 6. Change log

| Date | Change | By |
|---|---|---|
| 2026-11-24 | File created; input register seeded; data profile recorded; cut line proposed | OpenCode |
| 2026-11-24 | I-10 resolved by Julius (hosting, storage, staging, backups, headcount) | Julius |
| 2026-11-24 | DOC-01 conflicts resolved in Phase 0 (templates path, bulk send flag, SEED_KEY) | OpenCode |

---

## 7. Infrastructure decisions (I-10 resolved 2026-11-24)

| Topic | Decision | Implication / owner action |
|---|---|---|
| Hosting | **Stay on Vercel** for R1 | CI builds on ubuntu runners (removes the win32 local-build gap). Optional: custom domain in Phase 0. |
| Object storage | **Supabase Storage** (private buckets + signed URLs) | Owner: create bucket(s) `documents`, `drawings`, `attachments` in the Supabase project; service-role key stays server-side only. |
| Staging | **Separate Supabase project** | Owner: provision project + copy schema (migrations 001–014 replayed), then add `STAGING_DATABASE_URL` in Vercel/CI. |
| Backups | **PITR + nightly logical dumps** | Owner: enable PITR on the production plan; dumps go to Supabase Storage with 30-day retention. RPO ≈ 5 min, RTO ≈ 2 h. Restore drill documented in `docs/RUNBOOK_BACKUP.md` (Phase 0). |
| Users | **11–30 at R1 go-live** | Build permission sets for the ~13 spec roles; paginated list views remain required but 50k-row benchmark is a safety margin, not a current volume. |
| Rate limiting | **DEFAULTED:** Postgres-backed fixed-window limiter (`RateLimit` table), no new vendor | Meets the shared-store requirement across serverless instances. Alternative if preferred: Upstash Redis / Vercel KV. Flag for confirmation. |

---

## 8. Document conflicts resolved (DOC-01)

| Conflict | Resolution (Phase 0) |
|---|---|
| Templates at `/api/emails/templates/` vs `/api/email-templates/` | Only `/api/emails/templates/` exists (GET/POST + `[id]`). `/email-templates` is a **UI page**, not an API path. No alias needed. |
| "No bulk sending" vs shipped `bulk-send` | Kept behind an **env flag**, off by default: `BULK_SEND_ENABLED=true` to enable. Route returns 403 and the /emails UI hides the tab when disabled. The platform replaces it with per-record sends from Phase 5. |
| `SEED_KEY` | Never implemented and **not used**. Seeding runs through local scripts only (`npm run seed`, `scripts/seed-*.ts`); no HTTP seed endpoint exists. Removed from design intent. |
| Login rate-limit ownership (10 / 15 min / IP) | Phase 0 moves the limiter to a shared Postgres store (see §7); policy values stay as implemented until Phase 1 permission work. |

