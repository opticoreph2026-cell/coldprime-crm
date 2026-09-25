# Coldprime CRM

Customer Relationship Management system for **Coldprime Enterprises Corporation** — Cebu Region.

Coldprime is THE HVAC/IAQ vendor. Companies/leads/projects are **clients**. Upstream suppliers live in a separate **Vendor** domain.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the database URL:

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection string. For Gmail sending also set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `CRON_SECRET`.

### 3. Setup Database

```bash
npx prisma generate
npx prisma db push
```

If `prisma db push` cannot run locally, apply schema changes with a raw-SQL script under `scripts/` (see `scripts/db-*.ts`).

### 4. Seed Initial Data

```bash
npm run seed
```

This creates (idempotent — safe to re-run):
- Default admin user (admin@coldprime.ph / Coldprime2026!)
- Branches, status definitions, sample data

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Checks

```bash
npx tsc --noEmit   # typecheck
npm run lint       # eslint (0 errors)
npm audit          # dependency vulnerabilities
```

## Default Login

- **Email:** admin@coldprime.ph
- **Password:** Coldprime2026!

## Features

### Company Management
- Master company list (no duplicates)
- Industry classification
- Contact information
- Status tracking (StatusDefinition-driven)
- Duplicate detection
- Outreach status: EMAILED / REPLIED (updated by send + reply detection)

### Contact Management
- Multiple contacts per company
- Position, email, mobile, landline
- Contact preference

### Lead Management
- Lead tracking with statuses from existing workflow
- Priority levels
- Follow-up scheduling
- Source tracking

### Project Management
- HVAC project lifecycle tracking
- Installation, Testing, Commissioning status
- Project location and type
- Date tracking (quotation, start, target, actual completion)

### Activity Logging
- Phone calls, emails, meetings, site visits
- Follow-up scheduling
- Activity history per company/project

### Email Outreach
- Compose single emails (Gmail SMTP primary, Resend fallback)
- Email templates (branch-scoped, shared library)
- Bulk send with CC, case-insensitive dedup
- Sent history / logs with statuses (SENT / FAILED / PENDING)
- Mailbox tab: Inbox + Sent via Gmail IMAP
- Reply detection (cron + manual) → company outreach → REPLIED
- Daily send budget (default 450, Gmail free = 500)

### Vendors (suppliers)
- HVAC / IAQ equipment and materials suppliers
- Vendor contacts and material price list
- Separate from Client domain (Company/Lead/Project = clients)

### Multi-branch & Roles
- Branch-scoped data isolation (Cebu + others)
- HEAD_ADMIN / BRANCH_ADMIN / staff roles
- Per-request session revalidation of role and active status

### Excel Import
- Import existing CRM 2026.xlsx workbook
- Preview before importing
- Duplicate detection and merging
- Validation and error reporting

### Excel Export
- Customer Database (formatted .xlsx)
- Project Report
- Activity Report
- Professional headers, filters, freeze panes

### PDF Reports
- Weekly Accomplishment Report
- Summary statistics
- Activity tables
- Lead tables

## Project Structure

```
coldprime-crm/
├── app/
│   ├── api/
│   │   ├── activities/ companies/ contacts/ dashboard/
│   │   ├── emails/            # send, bulk-send, templates, logs, mailbox, check-replies
│   │   ├── export/ import/ leads/ projects/ reports/
│   │   ├── status-definitions/ users/ vendors/ branches/
│   │   └── auth/
│   ├── activities/ companies/ contacts/ dashboard/
│   ├── emails/                # Sent History, Compose, Mailbox
│   ├── import-export/ leads/ projects/ vendors/
│   ├── loading.tsx error.tsx  # global fallbacks
│   ├── layout.tsx page.tsx
├── components/layout/sidebar.tsx
├── lib/
│   ├── branch.ts auth.ts audit.ts status.ts
│   ├── email.ts reply-check.ts mailbox.ts
│   ├── excel/ import.ts export.ts
│   └── prisma/                # generated client
├── middleware.ts              # auth, cron Bearer, login rate limit
├── prisma/ schema.prisma seed.ts
├── scripts/                   # db-*.ts migrations, test-*.ts
├── eslint.config.mjs
├── .env.example
└── README.md
```

## Excel Import Guide

1. Go to **Import / Export**
2. Select a workbook (.xlsx/.xls)
3. Click **Preview** (rows, duplicates, validation errors)
4. Click **Import Valid Records**

### Supported Sheets

| Sheet | Purpose |
|-------|---------|
| Customer | Master company list |
| Xedes | Contact data with activity info |
| Raiza | Contact list with statuses |
| Ellaine & Nhecel | Contact info with business types |
| Sheet6 | Simple business list |

### Exported Formats

| Export | Format | Content |
|--------|--------|---------|
| Customer Database | .xlsx | All companies with contacts |
| Project Report | .xlsx | All projects with status |
| Activity Report | .xlsx | Recent activities |
| Weekly Accomplishment | .pdf | Summary report |

## Database

PostgreSQL tables include: companies, contacts, leads, projects, activities, status_definitions, import_batches, users, branches, vendors (+ contacts/materials), email_templates, email_logs, audit_logs.

## Environment Variables

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | NextAuth JWT secret |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail SMTP |
| `EMAIL_FROM_NAME` | From display name |
| `EMAIL_DAILY_CAP` | Soft daily send limit (default 450) |
| `CRON_SECRET` | Bearer token for reply-check cron |
| `RESEND_API_KEY` | Optional Resend fallback |

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Prisma ORM
- **Excel:** SheetJS (import, SheetJS CDN), ExcelJS (export)
- **PDF:** jsPDF + jspdf-autotable
- **Auth:** NextAuth v5 (JWT)
- **Email:** Nodemailer (Gmail SMTP), Gmail IMAP (mailbox/replies)
