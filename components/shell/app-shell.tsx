"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  LayoutGrid,
  LogOut,
  MapPin,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { AppLauncher } from "./app-launcher";
import { CommandPalette } from "./command-palette";
import {
  QUICK_CREATE,
  appsForRole,
  findApp,
  isTabActive,
} from "@/lib/apps";

type MenuId = "create" | "notifications" | "branch" | "user" | "tabs" | null;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const user = session?.user;

  const [menu, setMenu] = useState<MenuId>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [switching, setSwitching] = useState(false);

  const role = user?.role ?? null;
  const apps = appsForRole(role);
  const activeApp = findApp(pathname);
  const ActiveIcon = activeApp.icon;
  const canSetup = role === "HEAD_ADMIN" || role === "BRANCH_ADMIN";
  const isHeadAdmin = role === "HEAD_ADMIN";

  const roleLabel = (role ?? "STAFF").replace(/_/g, " ");
  const initials = (user?.name || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const activeBranchName = user?.activeBranchId
    ? branches.find((b) => b.id === user.activeBranchId)?.name ?? user?.branchName ?? "Branch"
    : "All Branches";

  useEffect(() => {
    setMenu(null);
    setLauncherOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isHeadAdmin) return;
    fetch("/api/branches")
      .then((r) => r.json())
      .then((res) => setBranches(res.data || []))
      .catch(() => setBranches([]));
  }, [isHeadAdmin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleMenu = (id: Exclude<MenuId, null>) => {
    setMenu((current) => (current === id ? null : id));
  };

  const switchBranch = async (branchId: string) => {
    setSwitching(true);
    try {
      await fetch("/api/auth/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branchId || null }),
      });
      setMenu(null);
      router.refresh();
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-shell">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[90] focus:rounded focus:bg-white focus:px-3 focus:py-1.5 focus:text-sm focus:text-brand focus:shadow"
      >
        Skip to content
      </a>

      <header className="relative z-40 flex h-12 shrink-0 items-center gap-1 border-b border-line bg-white px-2">
        <button
          type="button"
          className="shell-icon-btn"
          aria-label="Open App Launcher"
          aria-haspopup="dialog"
          onClick={() => {
            setMenu(null);
            setLauncherOpen(true);
          }}
        >
          <LayoutGrid size={18} />
        </button>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded px-1.5 py-1 no-underline hover:bg-shell"
        >
          <span className="text-[15px] font-bold tracking-tight text-ink">COLDPRIME</span>
          <span className="hidden rounded bg-brand-light px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand sm:inline">
            CRM
          </span>
        </Link>

        <span className="mx-2 hidden h-5 w-px bg-line sm:block" />

        <div className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
          <ActiveIcon size={15} className="shrink-0 text-brand" />
          <span className="truncate font-medium text-ink">{activeApp.label}</span>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="hidden h-8 w-[300px] items-center gap-2 rounded border border-line bg-shell px-2.5 text-[13px] text-ink-muted hover:bg-[#ecebea] lg:flex xl:w-[340px]"
        >
          <Search size={15} />
          <span className="truncate">Search Coldprime...</span>
          <kbd className="ml-auto rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-medium xl:inline">
            Ctrl K
          </kbd>
        </button>

        <button
          type="button"
          className="shell-icon-btn lg:hidden"
          aria-label="Search"
          onClick={() => setPaletteOpen(true)}
        >
          <Search size={18} />
        </button>

        <div className="relative">
          <button
            type="button"
            className="shell-icon-btn"
            aria-label="Quick create"
            aria-haspopup="menu"
            aria-expanded={menu === "create"}
            onClick={() => toggleMenu("create")}
          >
            <Plus size={19} />
          </button>
          {menu === "create" && (
            <MenuPanel width="w-56">
              <p className="shell-menu-label">Create</p>
              {QUICK_CREATE.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.id} href={action.href} className="shell-menu-item">
                    <Icon size={16} className="text-brand" />
                    {action.label}
                  </Link>
                );
              })}
            </MenuPanel>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            className="shell-icon-btn"
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={menu === "notifications"}
            onClick={() => toggleMenu("notifications")}
          >
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
          </button>
          {menu === "notifications" && (
            <MenuPanel width="w-80">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <p className="text-[13px] font-semibold text-ink">Notifications</p>
                <span className="text-[11px] text-ink-muted">0 new</span>
              </div>
              <div className="px-3 py-6 text-center">
                <Bell size={22} className="mx-auto mb-2 text-[#c9c7c5]" />
                <p className="text-[13px] font-medium text-ink">You&rsquo;re all caught up</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Follow-ups and approvals will appear here.
                </p>
              </div>
              <Link href="/activities" className="shell-menu-item border-t border-line">
                View activities
              </Link>
            </MenuPanel>
          )}
        </div>

        {isHeadAdmin && (
          <div className="relative">
            <button
              type="button"
              className="shell-icon-btn hidden max-w-[190px] gap-1.5 lg:flex"
              aria-label="Switch branch"
              aria-haspopup="menu"
              aria-expanded={menu === "branch"}
              onClick={() => toggleMenu("branch")}
              disabled={switching}
            >
              <MapPin size={15} />
              <span className="truncate text-[12px] font-medium">{activeBranchName}</span>
              <ChevronDown size={13} />
            </button>
            {menu === "branch" && (
              <MenuPanel width="w-60">
                <p className="shell-menu-label">Active branch</p>
                <button
                  type="button"
                  className="shell-menu-item"
                  onClick={() => switchBranch("")}
                >
                  <span className="flex w-4 justify-center">
                    {!user?.activeBranchId && <Check size={14} className="text-brand" />}
                  </span>
                  All Branches
                </button>
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    className="shell-menu-item"
                    onClick={() => switchBranch(branch.id)}
                  >
                    <span className="flex w-4 justify-center">
                      {user?.activeBranchId === branch.id && (
                        <Check size={14} className="text-brand" />
                      )}
                    </span>
                    <span className="truncate">{branch.name}</span>
                  </button>
                ))}
              </MenuPanel>
            )}
          </div>
        )}

        {canSetup && (
          <Link href="/users" className="shell-icon-btn" aria-label="Setup" title="Setup">
            <Settings size={18} />
          </Link>
        )}

        <div className="relative ml-0.5">
          <button
            type="button"
            className="flex h-8 items-center gap-1 rounded px-1 hover:bg-shell"
            aria-label="User menu"
            aria-haspopup="menu"
            aria-expanded={menu === "user"}
            onClick={() => toggleMenu("user")}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {initials || "?"}
            </span>
            <ChevronDown size={13} className="text-ink-muted" />
          </button>
          {menu === "user" && (
            <MenuPanel width="w-64">
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {user?.name ?? "Signed in"}
                </p>
                <p className="truncate text-[11px] text-ink-muted">{user?.email}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-ink-muted">
                  {roleLabel} · {activeBranchName}
                </p>
              </div>
              {canSetup && (
                <Link href="/users" className="shell-menu-item">
                  <Settings size={15} className="text-ink-muted" />
                  Setup
                </Link>
              )}
              <Link href="/activities" className="shell-menu-item">
                <Bell size={15} className="text-ink-muted" />
                My activities
              </Link>
              <button
                type="button"
                className="shell-menu-item text-danger"
                onClick={() => signOut({ callbackUrl: "/login" })}
                disabled={status === "loading"}
              >
                <LogOut size={15} />
                Sign out
              </button>
            </MenuPanel>
          )}
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-30" onMouseDown={() => setMenu(null)} aria-hidden="true" />
      )}

      <nav
        aria-label="App navigation"
        className="no-scrollbar flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-line bg-white px-1"
      >
        {activeApp.tabs.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          return (
            <Link
              key={`${activeApp.id}-${tab.id}`}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`shell-tab ${active ? "shell-tab-active" : ""}`}
            >
              {tab.label}
              {tab.planned && (
                <span className="rounded bg-shell px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
        <div className="flex-1" />
        <div className="relative flex items-center">
          <button
            type="button"
            className="shell-icon-btn"
            aria-label="All tabs"
            aria-haspopup="menu"
            aria-expanded={menu === "tabs"}
            onClick={() => toggleMenu("tabs")}
          >
            <ChevronDown size={16} />
          </button>
          {menu === "tabs" && (
            <MenuPanel width="w-72" maxHeight>
              {apps.map((app) => (
                <div key={app.id} className="border-b border-line py-1 last:border-b-0">
                  <p className="shell-menu-label flex items-center gap-1.5">
                    <app.icon size={12} className="text-ink-muted" />
                    {app.label}
                  </p>
                  {app.tabs.map((tab) => (
                    <Link
                      key={`${app.id}-${tab.id}`}
                      href={tab.href}
                      className="shell-menu-item pl-7"
                    >
                      {tab.label}
                      {tab.planned && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                          Soon
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ))}
            </MenuPanel>
          )}
        </div>
      </nav>

      <main id="main-content" className="min-h-0 flex-1 overflow-hidden">
        {children}
      </main>

      <AppLauncher
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        apps={apps}
        onSearch={() => setPaletteOpen(true)}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        apps={apps}
      />
    </div>
  );
}

function MenuPanel({
  children,
  width = "w-56",
  maxHeight = false,
}: {
  children: React.ReactNode;
  width?: string;
  maxHeight?: boolean;
}) {
  return (
    <div
      role="menu"
      className={`absolute right-0 top-[calc(100%+6px)] z-50 overflow-y-auto rounded-md border border-line bg-white py-1 shadow-[0_4px_16px_rgba(0,0,0,0.16)] ${width} ${
        maxHeight ? "max-h-[70vh]" : ""
      }`}
    >
      {children}
    </div>
  );
}
