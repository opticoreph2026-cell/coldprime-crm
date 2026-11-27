import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Building2,
  CalendarPlus,
  FolderKanban,
  FolderPlus,
  Home,
  Mail,
  PencilRuler,
  Settings,
  ShoppingCart,
  Target,
  UserPlus,
  Wrench,
} from "lucide-react";

export type AppTab = {
  id: string;
  label: string;
  href: string;
  /** Module is on the roadmap but has no implementation yet. */
  planned?: boolean;
};

export type AppDefinition = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tile colour used by the app launcher. */
  color: string;
  defaultHref: string;
  tabs: AppTab[];
  /** When set, only these roles see the app in the launcher / palette. */
  roles?: string[];
  /** App is entirely on the roadmap (no live object yet). */
  planned?: boolean;
};

export function plannedHref(appId: string, moduleId?: string): string {
  return moduleId ? `/planned/${appId}/${moduleId}` : `/planned/${appId}`;
}

export const APPS: AppDefinition[] = [
  {
    id: "home",
    label: "Home",
    description: "Your day, tasks, and recent records",
    icon: Home,
    color: "#0176d3",
    defaultHref: "/dashboard",
    tabs: [{ id: "home", label: "Home", href: "/dashboard" }],
  },
  {
    id: "sales",
    label: "Sales",
    description: "Companies, contacts, leads, and outreach",
    icon: Briefcase,
    color: "#2e844a",
    defaultHref: "/companies",
    tabs: [
      { id: "companies", label: "Companies", href: "/companies" },
      { id: "contacts", label: "Contacts", href: "/contacts" },
      { id: "leads", label: "Leads", href: "/leads" },
      { id: "activities", label: "Activities", href: "/activities" },
      { id: "emails", label: "Emails", href: "/emails" },
    ],
  },
  {
    id: "design",
    label: "Design",
    description: "Quotations, drawings, and take-off",
    icon: PencilRuler,
    color: "#7526e3",
    defaultHref: plannedHref("design"),
    planned: true,
    tabs: [
      { id: "quotations", label: "Quotations", href: plannedHref("design", "quotations"), planned: true },
      { id: "drawings", label: "Drawings", href: plannedHref("design", "drawings"), planned: true },
      { id: "costing", label: "Costing", href: plannedHref("design", "costing"), planned: true },
    ],
  },
  {
    id: "purchasing",
    label: "Purchasing",
    description: "Vendors, products, and the price book",
    icon: ShoppingCart,
    color: "#a96404",
    defaultHref: "/vendors",
    tabs: [
      { id: "vendors", label: "Vendors", href: "/vendors" },
      { id: "products", label: "Products", href: "/products" },
      { id: "price-book", label: "Price Book", href: plannedHref("purchasing", "price-book"), planned: true },
      { id: "purchase-orders", label: "Purchase Orders", href: plannedHref("purchasing", "purchase-orders"), planned: true },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    description: "Warehouses, crews, and service delivery",
    icon: Wrench,
    color: "#0b827c",
    defaultHref: plannedHref("operations"),
    planned: true,
    tabs: [
      { id: "warehouses", label: "Warehouses", href: plannedHref("operations", "warehouses"), planned: true },
      { id: "inventory", label: "Inventory", href: plannedHref("operations", "inventory"), planned: true },
      { id: "crews", label: "Crews", href: plannedHref("operations", "crews"), planned: true },
      { id: "service", label: "Service Tickets", href: plannedHref("operations", "service"), planned: true },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    description: "Delivery schedule, reports, and billing",
    icon: FolderKanban,
    color: "#3a49da",
    defaultHref: "/projects",
    tabs: [
      { id: "projects", label: "Projects", href: "/projects" },
      { id: "reports", label: "Reports", href: "/reports" },
      { id: "billing", label: "Billing", href: plannedHref("projects", "billing"), planned: true },
    ],
  },
  {
    id: "admin",
    label: "Setup",
    description: "Users, statuses, templates, and data tools",
    icon: Settings,
    color: "#5c5c5c",
    defaultHref: "/users",
    roles: ["HEAD_ADMIN", "BRANCH_ADMIN"],
    tabs: [
      { id: "users", label: "Users", href: "/users" },
      { id: "statuses", label: "Statuses", href: "/admin/statuses" },
      { id: "templates", label: "Email Templates", href: "/email-templates" },
      { id: "import-export", label: "Import & Export", href: "/import-export" },
    ],
  },
];

export type QuickCreateAction = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
};

export const QUICK_CREATE: QuickCreateAction[] = [
  { id: "company", label: "New Company", href: "/companies", icon: Building2, keywords: "account client customer" },
  { id: "contact", label: "New Contact", href: "/contacts", icon: UserPlus, keywords: "person" },
  { id: "lead", label: "New Lead", href: "/leads", icon: Target, keywords: "prospect opportunity" },
  { id: "project", label: "New Project", href: "/projects", icon: FolderPlus, keywords: "job site" },
  { id: "activity", label: "Log Activity", href: "/activities", icon: CalendarPlus, keywords: "call meeting task follow-up" },
  { id: "email", label: "New Email", href: "/emails/compose", icon: Mail, keywords: "compose message" },
];

/** Apps the given role may see. Unknown roles see the non-admin apps. */
export function appsForRole(role?: string | null): AppDefinition[] {
  return APPS.filter((app) => !app.roles || (role != null && app.roles.includes(role)));
}

/** Longest-prefix match of a pathname to an app (falls back to Home). */
export function findApp(pathname: string): AppDefinition {
  let match: AppDefinition | undefined;
  let matchLength = -1;

  for (const app of APPS) {
    const candidates = [app.defaultHref, ...app.tabs.map((tab) => tab.href)];
    for (const href of candidates) {
      const path = href.split("?")[0];
      if ((pathname === path || pathname.startsWith(`${path}/`)) && path.length > matchLength) {
        match = app;
        matchLength = path.length;
      }
    }
  }

  return match ?? APPS[0];
}

/** True when `href` is the active tab for `pathname`. */
export function isTabActive(href: string, pathname: string): boolean {
  const path = href.split("?")[0];
  return pathname === path || pathname.startsWith(`${path}/`);
}
