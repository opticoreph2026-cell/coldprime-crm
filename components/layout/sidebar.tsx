"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/companies", label: "Companies", icon: "🏢" },
  { href: "/contacts", label: "Contacts", icon: "👤" },
  { href: "/leads", label: "Leads", icon: "🎯" },
  { href: "/projects", label: "Projects", icon: "📋" },
  { href: "/activities", label: "Activities", icon: "📞" },
  { href: "/import-export", label: "Import / Export", icon: "📥" },
];

export function Sidebar({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 240,
          background: "#0f172a",
          color: "#e2e8f0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid #1e293b" }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
            COLDPRIME
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>
            Enterprises Corporation
          </div>
        </div>
        <nav style={{ padding: "0.5rem", flex: 1 }}>
          {navItems.map((item) => {
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
        </nav>
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #1e293b", fontSize: "0.7rem", color: "#64748b" }}>
          Coldprime CRM v1.0
        </div>
      </aside>
      <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
    </div>
  );
}