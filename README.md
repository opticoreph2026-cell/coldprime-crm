# Coldprime CRM

Customer Relationship Management system for **Coldprime Enterprises Corporation** — Cebu Region.

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

Edit `.env` with your PostgreSQL connection string.

### 3. Setup Database

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed Initial Data

```bash
npm run seed
```

This creates:
- Default admin user (admin@coldprime.ph / Coldprime2026!)
- Status definitions from the existing Excel workflow

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Default Login

- **Email:** admin@coldprime.ph
- **Password:** Coldprime2026!

## Features

### Company Management
- Master company list (no duplicates)
- Industry classification
- Contact information
- Status tracking
- Duplicate detection

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
│   │   ├── activities/       # Activity CRUD
│   │   ├── companies/        # Company CRUD
│   │   ├── contacts/         # Contact CRUD
│   │   ├── dashboard/        # Dashboard stats
│   │   ├── export/           # Excel export
│   │   ├── import/           # Excel import
│   │   ├── leads/            # Lead CRUD
│   │   ├── projects/         # Project CRUD
│   │   ├── reports/          # PDF reports
│   │   └── status-definitions/
│   ├── activities/           # Activities UI
│   ├── companies/            # Companies UI
│   ├── contacts/             # Contacts UI
│   ├── dashboard/            # Dashboard UI
│   ├── import-export/        # Import/Export UI
│   ├── leads/                # Leads UI
│   ├── projects/             # Projects UI
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── layout/
│       └── sidebar.tsx       # Sidebar navigation
├── lib/
│   ├── excel/
│   │   ├── export.ts         # Excel export engine
│   │   └── import.ts         # Excel import engine
│   └── prisma.ts             # Prisma client singleton
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed script
├── .env.example
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

## Excel Import Guide

### Importing CRM 2026.xlsx

1. Go to **Import / Export** page
2. Enter the full file path to `CRM 2026.xlsx`
3. Click **Preview** to see:
   - Total rows per sheet
   - Duplicate companies detected
   - Validation errors
4. Click **Import Valid Records** to import

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

Uses PostgreSQL. Tables:

- `companies` — Master company list
- `contacts` — Contact persons
- `leads` — Lead tracking
- `projects` — Project management
- `activities` — Activity/follow-up log
- `status_definitions` — Configurable statuses
- `import_batches` — Import history
- `admin_users` — User accounts

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Prisma ORM
- **Excel:** ExcelJS (export), SheetJS (import)
- **PDF:** jsPDF + jspdf-autotable
- **Auth:** NextAuth v5
