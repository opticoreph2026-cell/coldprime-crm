# UI AUDIT — Coldprime CRM (Phase 0)

Purpose: confirm or correct spec `COLDPRIME_FEATURE_SPEC.md` §1 rows against the live UI.
Method: code inspection of the deployed app (commit `935e95f`). Live screenshots pending —
Julius to walk each screen and mark ✅ (matches spec) / ❌ (needs change) / ⬜ (not yet built).

Legend: **Keep** = ship as-is · **Change** = rework to shell pattern · **Remove** = delete ·
**Add** = new in Phase 1 shell.

## Shell (not yet built — Phase 1a)

| Spec §1 element | Current state | Verdict | Notes |
|---|---|---|---|
| Global header (search `/`, quick create `+`, notifications, branch switcher) | No global header; flat sidebar (`components/layout/sidebar.tsx`) | **Change** | Sidebar lists routes directly; no app launcher, no search, no notifications |
| App launcher (waffle) | Absent | **Add** | 6 sections: Sales, Design, Purchasing, Operations, Projects, Admin/Setup |
| Per-app tab bar with `▾` | Absent | **Add** | |
| Workspace console tabs persist across refresh | Absent | **Add** | |

## Existing screens (code-derived, needs live verification)

| Screen | Route | Current tabs/structure | Spec target | Verdict |
|---|---|---|---|---|
| Login | `/login` | Public, credential sign-in, rate-limited | Keep (auth re-read semantics) | ⬜ verify |
| Dashboard | `/dashboard` | Stats cards + quick actions incl. "Create an email template" | Home "My Day" + builders | **Change** |
| Companies list | `/companies` | Table view | List view (saved views, filters, column picker) | **Change** |
| Company detail | `/companies/[id]` | 8 tabs incl. Emails | Record page: highlights + Path + Details/Related/Files/Activity | **Change** |
| Contacts | (via companies) | — | Related list on company record | **Change** |
| Leads | `/leads` | Table | Lead object + Convert | **Add** (Phase 2) |
| Emails | `/emails` | Bulk Send / Templates / Sent History / Mailbox tabs | In-record composer; bulk send flag-gated off | **Change** |
| Email Templates | `/email-templates` | List + form | Setup → templates | **Change** |
| Import | `/import-export` | Workbook preview + merge | Import page → Setup wizard | **Change** |
| Users | `/users` | List | Setup → users + permission sets | **Change** |
| Statuses | `/admin/statuses` | Reorderable list | Setup → statuses + semantic stages | **Change** |
| Vendors | `/vendors` | + import | Vendor → item master / price book (Phase 3) | **Change** |
| Products | `/products` | + price-list import | Product → sell-side price book | **Change** |
| Reports | `/reports` | Weekly report + XLSX/PDF export | Report/dashboard builder (Phase 12) | **Change** |
| Activities | (embedded) | — | Activity timeline on record pages | **Change** |

## Keep / Change / Remove / Add (spec §1) — initial read

**Keep:** auth re-read semantics, route pattern, zod `parseOr400`, AuditLog/ImportBatch, email guard + IMAP, weekly report engine, vendor/product data, configurable statuses, cost gating, test discipline.

**Change:** flat sidebar → app shell; Lead row → Opportunity + real Lead; 8-tab company page → record page; tables → list views; standalone emails → in-record composer; dashboard → Home "My Day" + builders; Product → item master/price book; status-name checks → semantic stages; import page → Setup wizard; statuses/users → consolidated Setup.

**Remove:** empty `src/`, inline style helpers, `xlsx` CDN tarball (done → exceljs), duplicate template path, bulk send behind admin flag (done → flag-gated off), `SEED_KEY` (never implemented), in-memory rate limiter → shared store (done → Postgres), free-typed pipeline value.

**Add:** Lead object with Convert, quotation spine, item master + multi-vendor price book, purchasing requisition/RFQ/PO, operations warehouse/crews, projects Gantt, billing invoices/2307, permission sets + FLS, event outbox (done skeleton), report/dashboard builder, numbering series.

## Open questions for Julius (UI)

1. Confirm the 6-section app split (Sales · Design · Purchasing · Operations · Projects · Admin/Setup) with Billing inside Projects (C-5, accepted).
2. Confirm "Feed" (not "Chatter") for the activity timeline (C-7, accepted).
3. Which of the 20 existing screens are rebuilt in Phase 1 vs left as-is until their phase?
4. Login rate-limit policy (10 attempts/15 min/IP) — keep or adjust?

## Verification checklist (Julius walkthrough)

- [ ] Login page loads, rate limit returns 429 after 10 attempts
- [ ] Sidebar lists all expected routes
- [ ] Company detail has 8 tabs including Emails
- [ ] Emails page has Bulk Send / Templates / Sent History / Mailbox
- [ ] Reports page exports XLSX + PDF
- [ ] Dashboard shows stats + quick actions
- [ ] No Salesforce logos/icons/trademarked names in UI (lucide-react only)
