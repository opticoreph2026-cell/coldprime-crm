"use client";

import React, { useEffect } from "react";

export function Modal({ open, title, onClose, children, footer, width = 560 }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px 16px" }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: width, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, background: "#fff", borderRadius: "10px 10px 0 0" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: "none", background: "transparent", fontSize: "1.25rem", color: "#64748b", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        {footer && (
          <div style={{ padding: "14px 24px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8, position: "sticky", bottom: 0, background: "#fff", borderRadius: "0 0 10px 10px" }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title = "Are you sure?", message, confirmLabel = "Delete", cancelLabel = "Cancel", danger = true, busy = false, onConfirm, onCancel }: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      width={420}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy} style={danger ? { background: "#dc2626", borderColor: "#dc2626" } : undefined}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: "0.875rem", color: "#334155", margin: 0 }}>{message}</p>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{title}</h1>
        {subtitle && <p style={{ color: "#64748b", fontSize: "0.875rem" }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
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
