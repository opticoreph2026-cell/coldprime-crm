import React from "react";

export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{title}</h1>
        {subtitle && <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
    </div>
  );
}

export function ErrorBanner({ message, children }: { message: string; children?: React.ReactNode }) {
  if (!message) return null;
  return (
    <div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid #fecaca", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span>{message}</span>
      {children}
    </div>
  );
}

export function NoticeBanner({ message, children }: { message: string; children?: React.ReactNode }) {
  if (!message) return null;
  return (
    <div style={{ background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8, marginBottom: 16, border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span>{message}</span>
      {children}
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>{message}</td>
    </tr>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 32, textAlign: "center", color: "#94a3b8" }}>
      <div>{message}</div>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{message}</div>;
}

export function Pagination({ page, total, limit = 50, onPage }: {
  page: number;
  total: number;
  limit?: number;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const btnStyle = { padding: "0.5rem 1rem", fontSize: "0.875rem" };
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
      <button className="btn btn-secondary" style={{ ...btnStyle, opacity: page <= 1 ? 0.5 : 1 }} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}>Page {page} of {totalPages}</span>
      <button className="btn btn-secondary" style={{ ...btnStyle, opacity: page >= totalPages ? 0.5 : 1 }} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, width = 300 }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number | string;
}) {
  return <input placeholder={placeholder} style={{ width }} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function FormField({ label, required, span, children }: {
  label: string;
  required?: boolean;
  span?: 2;
  children: React.ReactNode;
}) {
  return (
    <div style={span === 2 ? { gridColumn: "span 2" } : undefined}>
      <label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>
        {label}{required && " *"}
      </label>
      {children}
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  gray: "badge-gray",
  blue: "badge-blue",
  green: "badge-green",
  red: "badge-red",
  yellow: "badge-yellow",
  purple: "badge-purple",
};

export function Badge({ color = "blue", title, children }: {
  color?: keyof typeof BADGE_COLORS | string;
  title?: string;
  children: React.ReactNode;
}) {
  return <span className={`badge ${BADGE_COLORS[color] || BADGE_COLORS.gray}`} title={title}>{children}</span>;
}

export function Card({ children, padding = 24, style }: {
  children: React.ReactNode;
  padding?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding, ...style }}>
      {children}
    </div>
  );
}
