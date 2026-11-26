# DATA AUDIT — Coldprime CRM (Phase 0)

Snapshot of the production database at commit `c3c7c25` (2026-11-26), read-only via Prisma.

## Row counts

| Table | Rows | Notes |
|---|---|---|
| users | 3 | 1 HEAD_ADMIN, 2 STAFF |
| branches | 2 | Cebu, Manila |
| companies | 129 | The only meaningful legacy dataset |
| contacts | 15 | |
| leads | 0 | Empty — C-1 Lead→Opportunity migration is near-trivial if nothing is entered before Phase 2 |
| projects | 0 | Empty — Phase 9 has no legacy projects to migrate |
| activities | 0 | |
| products | 1 | Stub — Phase 3 item master has essentially nothing to migrate |
| vendors | 1 | Stub |
| vendor_materials | 1 | Stub |
| documents | 0 | |
| email_logs | 154 | Must survive any table/model rename |
| email_templates | 22 | |
| audit_logs | 230 | Must survive any migration |
| leads with estimatedValue | 0 | |
| leads linked to company | 0 | |

## Implications

1. **C-1 (Lead → Opportunity, Phase 2) is low-risk.** Zero leads exist, so there is no `legacy_amount` reconciliation unless data is entered before Phase 2. Recommend a temporary "no new deals in the CRM" guideline, or acceptance of re-entry — Julius's call.
2. **Phase 3 item master has nothing to migrate** (1 product / 1 vendor / 1 material). The real work is the new price-list import (I-6).
3. **129 companies are the legacy dataset.** Phase 2 account-role work must map them (type/industry). Profile in detail before Phase 2.
4. **email_logs (154) + audit_logs (230) must survive migrations.** The Phase 2 Lead table rename does not touch these tables.
5. **No projects/activities/leads/documents** — the CRM is effectively a company directory + email system today. Phase 2 (deal spine) starts from a clean slate.

## Migration state

Migrations `prisma/migrations/001–015.sql` (sequential, verified by `npm run db:check`). The schema source of truth is `prisma/schema.prisma` (17 models + RateLimit + EventOutbox).
