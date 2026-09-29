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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 bg-[rgba(15,23,42,0.45)] z-50 flex items-start justify-center pb-4 px-4 pt-[6vh]"
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white w-full max-h-[86vh] overflow-y-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[10px]" style={{ maxWidth: width }}>
        <div className="flex justify-between items-center px-6 py-3.5 border-b border-b-slate-200 sticky top-0 bg-white rounded-[10px_10px_0px_0px]">
          <h2 className="text-base font-semibold m-0">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="bg-transparent text-xl text-slate-500 cursor-pointer leading-none border-0">✕</button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="px-6 py-3.5 border-t border-t-slate-200 flex justify-end gap-2 sticky bottom-0 bg-white rounded-[0px_0px_10px_10px]">{footer}</div>
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
      <p className="text-sm text-slate-700 m-0">{message}</p>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap ml-auto justify-end">{actions}</div>}
    </div>
  );
}

export function ErrorBanner({ message, children }: { message: string; children?: React.ReactNode }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 text-red-600 mb-4 border border-red-200 flex justify-between items-center gap-3 p-3 rounded-lg">
      <span>{message}</span>
      {children}
    </div>
  );
}

export function NoticeBanner({ message, children }: { message: string; children?: React.ReactNode }) {
  if (!message) return null;
  return (
    <div className="bg-green-100 text-green-800 mb-4 border border-green-200 flex justify-between items-center gap-3 p-3 rounded-lg">
      <span>{message}</span>
      {children}
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center text-slate-400 p-8">{message}</td>
    </tr>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 text-center text-slate-400 rounded-lg p-8">
      <div>{message}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return <div className="text-center text-slate-400 p-10">{message}</div>;
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
    <div className="flex justify-center gap-2 mt-4">
      <button className="btn btn-secondary" style={{ ...btnStyle, opacity: page <= 1 ? 0.5 : 1 }} disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</button>
      <span className="px-4 py-2 text-sm">Page {page} of {totalPages}</span>
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
      <label className="text-xs font-medium block mb-1">
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

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({ variant = "primary", size, type = "button", disabled, busy, onClick, className = "", title, children }: {
  variant?: ButtonVariant;
  size?: "sm";
  type?: "button" | "submit";
  disabled?: boolean;
  busy?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const cls = ["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} disabled={disabled || busy} onClick={onClick} title={title}>
      {busy ? "Working\u2026" : children}
    </button>
  );
}

export function Table({ columns, children, className = "" }: {
  columns?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <table className={className}>
      {columns && (
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
      )}
      <tbody>{children}</tbody>
    </table>
  );
}
