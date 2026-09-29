"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ReactNode, useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/companies", label: "Companies", icon: "🏢" },
  { href: "/contacts", label: "Contacts", icon: "👤" },
  { href: "/leads", label: "Leads", icon: "🎯" },
  { href: "/projects", label: "Projects", icon: "📋" },
  { href: "/activities", label: "Activities", icon: "📞" },
  { href: "/emails", label: "Emails", icon: "✉️" },
  { href: "/email-templates", label: "Email Templates", icon: "📝" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/import-export", label: "Import / Export", icon: "📥" },
  { href: "/vendors", label: "Vendors", icon: "🔧" },
  { href: "/products", label: "Products", icon: "📦" },
];

const adminNavItems = [
  { href: "/users", label: "Users", icon: "👥" },
  { href: "/admin/statuses", label: "Statuses", icon: "🏷️" },
];

export function Sidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [switching, setSwitching] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const user = session?.user;
  const isHeadAdmin = user?.role === "HEAD_ADMIN";
  const isBranchAdmin = user?.role === "BRANCH_ADMIN";
  const canManageUsers = isHeadAdmin || isBranchAdmin;

  useEffect(() => {
    if (isHeadAdmin) {
      fetch("/api/branches")
        .then((r) => r.json())
        .then((res) => setBranches(res.data || []))
        .catch(() => setBranches([]));
    }
  }, [isHeadAdmin]);

  const handleBranchSwitch = async (branchId: string) => {
    setSwitching(true);
    try {
      await fetch("/api/auth/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: branchId || null }),
      });
      router.refresh();
    } catch {
      console.error("Failed to switch branch");
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 bg-slate-900 text-white flex items-center gap-3 z-[45] h-[52px] px-4 py-0">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu" className="bg-transparent text-white text-xl cursor-pointer border-0 px-1 py-0"
          >
            ☰
          </button>
          <div>
            <div className="font-bold leading-[1.1] text-[14.4px]">COLDPRIME</div>
            <div className="text-slate-400 text-[9.6px]">{user?.branchName || "All Branches"}</div>
          </div>
        </div>
      )}

      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-[rgba(15,23,42,0.5)] z-[48]"
        />
      )}

      {(!isMobile || mobileOpen) && (
      <aside
        className="w-[240px] bg-slate-900 text-slate-200 flex flex-col shrink-0"
        style={ isMobile
            ? { position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 49, overflowY: "auto" as const }
            : {} }
      >
        {isMobile && (
          <div className="flex justify-end pb-0 px-3 pt-2">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu" className="bg-transparent text-slate-400 text-xl cursor-pointer border-0"
            >
              ✕
            </button>
          </div>
        )}
        <div className="px-4 py-5 border-b border-b-slate-800">
          <div className="text-base font-bold text-white">
            COLDPRIME
          </div>
          <div className="text-slate-400 mt-0.5 text-[11.2px]">
            Enterprises Corporation
          </div>
          {user && (
            <div className="text-blue-500 mt-1 font-medium text-[11.2px]">
              {user.branchName || "All Branches"}
            </div>
          )}
        </div>

        {/* Branch Switcher for HEAD_ADMIN */}
        {isHeadAdmin && (
          <div className="px-4 py-2 border-b border-b-slate-800">
            <label className="text-slate-500 uppercase tracking-wider text-[10.4px]">
              Active Branch
            </label>
            <select
              value={user?.activeBranchId || ""}
              onChange={(e) => handleBranchSwitch(e.target.value)}
              disabled={switching} className="w-full mt-1 px-2 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 text-xs rounded"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <nav className="p-2 flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm no-underline mb-0.5 transition ${active ? "text-white bg-blue-800" : "text-slate-400 bg-transparent"}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {canManageUsers && (
            <>
              <div className="bg-slate-800 mx-3 my-2 h-[1px]" />
              {adminNavItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm no-underline mb-0.5 transition ${active ? "text-white bg-blue-800" : "text-slate-400 bg-transparent"}`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User Info + Logout */}
        {user && (
          <div className="px-4 py-3 border-t border-t-slate-800">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="rounded-full bg-blue-800 flex items-center justify-center text-xs font-semibold text-white w-7 h-7">
                {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
                  {user.name}
                </div>
                <div className="text-slate-500 text-[10.4px]">
                  {user.role?.replace("_", " ")}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout} className="w-full p-1.5 bg-transparent text-slate-400 border border-slate-700 text-xs cursor-pointer transition rounded"
              onMouseEnter={(e) => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
            >
              Sign Out
            </button>
          </div>
        )}

        <div className="px-4 py-2 border-t border-t-slate-800 text-slate-600 text-[10.4px]">
          Coldprime CRM v2.0
        </div>
      </aside>
      )}
      <main className={`flex-1 overflow-auto ${isMobile ? "pt-[52px]" : "pt-0"}`}>{children}</main>
    </div>
  );
}
