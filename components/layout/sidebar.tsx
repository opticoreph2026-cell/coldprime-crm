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
  { href: "/import-export", label: "Import / Export", icon: "📥" },
  { href: "/vendors", label: "Vendors", icon: "🔧" },
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
        .catch(() => setBranches([
          { id: "branch_cebu", name: "Cebu Office" },
          { id: "branch_manila", name: "Manila Office" },
        ]));
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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {isMobile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 52, background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "0 16px", zIndex: 45 }}>
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{ background: "transparent", border: "none", color: "#fff", fontSize: "1.25rem", cursor: "pointer", padding: "0 4px" }}
          >
            ☰
          </button>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.1 }}>COLDPRIME</div>
            <div style={{ fontSize: "0.6rem", color: "#94a3b8" }}>{user?.branchName || "All Branches"}</div>
          </div>
        </div>
      )}

      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", zIndex: 48 }}
        />
      )}

      {(!isMobile || mobileOpen) && (
      <aside
        style={{
          width: 240,
          background: "#0f172a",
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile
            ? { position: "fixed" as const, top: 0, left: 0, bottom: 0, zIndex: 49, overflowY: "auto" as const }
            : {}),
        }}
      >
        {isMobile && (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.5rem 0.75rem 0" }}>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.25rem", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}
        <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
            COLDPRIME
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>
            Enterprises Corporation
          </div>
          {user && (
            <div style={{ fontSize: "0.7rem", color: "#3b82f6", marginTop: 4, fontWeight: 500 }}>
              {user.branchName || "All Branches"}
            </div>
          )}
        </div>

        {/* Branch Switcher for HEAD_ADMIN */}
        {isHeadAdmin && (
          <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #1e293b" }}>
            <label style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Active Branch
            </label>
            <select
              value={user?.activeBranchId || ""}
              onChange={(e) => handleBranchSwitch(e.target.value)}
              disabled={switching}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "0.375rem 0.5rem",
                background: "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                borderRadius: 4,
                fontSize: "0.75rem",
              }}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <nav style={{ padding: "0.5rem", flex: 1 }}>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  color: active ? "#fff" : "#94a3b8",
                  background: active ? "#1e40af" : "transparent",
                  marginBottom: 2,
                  transition: "all 0.15s",
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {canManageUsers && (
            <>
              <div style={{ height: 1, background: "#1e293b", margin: "0.5rem 0.75rem" }} />
              {adminNavItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.625rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      textDecoration: "none",
                      color: active ? "#fff" : "#94a3b8",
                      background: active ? "#1e40af" : "transparent",
                      marginBottom: 2,
                      transition: "all 0.15s",
                    }}
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
          <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #1e293b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 6 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#1e40af",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#fff",
              }}>
                {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </div>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>
                  {user.role?.replace("_", " ")}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "0.375rem",
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid #334155",
                borderRadius: 4,
                fontSize: "0.75rem",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
            >
              Sign Out
            </button>
          </div>
        )}

        <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid #1e293b", fontSize: "0.65rem", color: "#475569" }}>
          Coldprime CRM v2.0
        </div>
      </aside>
      )}
      <main style={{ flex: 1, overflow: "auto", paddingTop: isMobile ? 52 : 0 }}>{children}</main>
    </div>
  );
}
