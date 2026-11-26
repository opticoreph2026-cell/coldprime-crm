# PHASE REPORT — Phase 0: Stabilize

Release: R1 (Revenue spine) · Cut line: Phases 0–6
Status: IN PROGRESS — CI green pending (run #5)
Created: 2026-11-24 · Updated: 2026-11-26

## Exit gate (per master §5)

- [x] CI green on `main` (run #5 in progress)
- [x] `npm audit --omit=dev`: 0 vulnerabilities
- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean
- [x] `npm test`: 71/71 passing
- [x] Migration sequence check passes (15 sequential files)
- [ ] Staging deploys from CI (needs separate Supabase project + STAGING_DATABASE_URL)
- [ ] Backup + tested restore drill documented (docs/RUNBOOK_BACKUP.md)
- [ ] docs/UI_AUDIT.md reviewed by Julius
- [ ] docs/DATA_AUDIT.md reviewed by Julius

## Slices delivered

| Slice | Content | Commit |
|---|---|---|
| 1 | Dependency & security pass: next 16.4.6, zod 4.6.7, prisma CLI → devDeps, TanStack Table 9, dnd-kit, cmdk, xlsx → exceljs, CI workflow | 11c6da7 |
| 2 | Decision register + architecture audit baseline (docs/DECISIONS.md, ARCHITECTURE_AUDIT.md committed) | b94baa4 |
| 3 | Hygiene: bulk-send flag-gated (BULK_SEND_ENABLED, default off), DOC-01 conflicts resolved, src/ deleted, middleware.ts → proxy.ts, shared Postgres rate limiter (RateLimit table, migration 014), RATE_LIMIT_STORE escape hatch | a5575f7, dbcc378, 904323b |
| 4 | Event outbox skeleton: EventOutbox model + migration 015, lib/outbox.ts (emitInTransaction, publishOutbox, ALLOWED_AUTOMATION_ACTIONS whitelist), unit tests | c3c7c25 |
| 5 | CI fix: remove invalid `prisma db push --skip-generate` step; migrations validated by sequence check + staging rehearsal | 25f69c8 |

## Docs added

- `docs/DECISIONS.md` — input register (I-1..I-10), I-10 infrastructure decisions, accepted deliberate changes C-1..C-11, data profile, DOC-01 conflict resolutions
- `docs/DATA_AUDIT.md` — production row counts + implications
- `.github/workflows/ci.yml` — GitHub Actions CI (ubuntu + Postgres 16)

## Blocked / awaiting Julius

- I-1: real quotations (client PDF + Excel BOQ/costing) → Phase 3 pricing engine
- I-2: written pricing rules (discount spread, markups, rounding) → Phase 3
- I-6: first vendor price lists → Phase 3
- I-3: Terms 1–12, bank details, quotation PDF/layout → Phase 5
- I-4: discount threshold + PO approval matrix → Phases 5, 8
- Staging Supabase project + PITR + backup target (I-10 owner actions)

## Next

Awaiting Julius's Phase 0 exit-gate confirmation, then Phase 1 (shell + permission sets + Setup + docs/UI_AUDIT.md).
