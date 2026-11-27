"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeader, ErrorBanner, NoticeBanner, EmptyState, Modal, ConfirmDialog, Badge } from "@/components/ui";

type StatusRow = { id: string; name: string; type: string; isActive: boolean; sortOrder: number };

const TYPES = [
  { type: "company", label: "Company Statuses", singular: "status" },
  { type: "lead", label: "Lead Statuses", singular: "status" },
  { type: "project", label: "Project Statuses", singular: "status" },
  { type: "activity", label: "Activity Types", singular: "type" },
  { type: "industry", label: "Industries", singular: "industry" },
];

export default function StatusesAdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === "HEAD_ADMIN" || role === "BRANCH_ADMIN";

  const [activeType, setActiveType] = useState("company");
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [editing, setEditing] = useState<StatusRow | null>(null);
  const [editName, setEditName] = useState("");
  const [deactivating, setDeactivating] = useState<StatusRow | null>(null);
  const [busy, setBusy] = useState(false);

  const meta = TYPES.find((t) => t.type === activeType) || TYPES[0];

  const fetchRows = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setError("");
      const res = await fetch(`/api/status-definitions?type=${activeType}&all=1`);
      const data = await res.json();
      if (Array.isArray(data)) setRows(data);
      else setError(data.error || "Failed to load statuses");
    } catch {
      setError("Failed to load statuses");
    } finally {
      setLoading(false);
    }
  }, [activeType, isAdmin]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/status-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName, type: activeType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add status");
      } else {
        setShowAdd(false);
        setAddName("");
        setNotice(`Added "${addName}"`);
        fetchRows();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/status-definitions/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to rename");
      } else {
        setEditing(null);
        setNotice(`Renamed "${editing.name}" to "${editName}" — existing records were updated.`);
        fetchRows();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const handleSetActive = async (row: StatusRow, isActive: boolean) => {
    setError("");
    try {
      const res = await fetch(`/api/status-definitions/${row.id}`, {
        method: isActive ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(isActive && { body: JSON.stringify({ isActive: true }) }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to update");
      else setNotice(isActive ? `Restored "${row.name}"` : `Deactivated "${row.name}"`);
      fetchRows();
    } catch {
      setError("Network error");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...rows];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setError("");
    try {
      const res = await fetch("/api/status-definitions/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeType, ids: next.map((r) => r.id) }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save order");
        fetchRows();
      }
    } catch {
      setError("Network error");
      fetchRows();
    }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="page">
        <PageHeader title="Statuses" subtitle="Pipeline statuses & dropdown values" />
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <PageHeader title="Statuses" subtitle="Pipeline statuses & dropdown values" />
        <ErrorBanner message="Only administrators can manage statuses. Please ask a branch or head admin." />
      </div>
    );
  }

  const activeCount = rows.filter((r) => r.isActive).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <div className="page">
      <PageHeader
        title="Statuses"
        subtitle="Manage pipeline statuses and dropdown values"
        actions={
          <button className="btn btn-primary" onClick={() => { setAddName(""); setShowAdd(true); }}>
            + Add {meta.singular}
          </button>
        }
      />

      <ErrorBanner message={error} />
      <NoticeBanner message={notice} />

      <div className="flex gap-2 mb-4 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t.type}
            className={t.type === activeType ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => { setActiveType(t.type); setNotice(""); setError(""); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 mb-4 text-slate-500 text-[12.8px]">
        <span>{activeCount} active</span>
        <span>{inactiveCount} inactive</span>
        <span className="ml-auto">Inactive values stay visible on existing records but leave the dropdowns.</span>
      </div>

      <div className="page-scroll">
      {loading ? (
        <p className="text-slate-400">Loading statuses…</p>
      ) : rows.length === 0 ? (
        <EmptyState message={`No ${meta.label.toLowerCase()} yet — use + Add ${meta.singular} to create the first one.`} />
      ) : (
        <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
          {rows.map((row, i) => (
            <div
              key={row.id} className={`${`flex items-center gap-3 px-4 py-2.5 ${row.isActive ? "bg-white opacity-100" : "bg-slate-50 opacity-75"}`} ${i === 0 ? "border-t-0" : "border-t border-t-slate-100"}`}
            >
              <span className="text-slate-400 text-xs text-right w-6">{i + 1}</span>
              <span className={`flex-1 font-medium text-sm ${row.isActive ? "text-slate-900 no-underline" : "text-slate-500 line-through"}`}>
                {row.name}
              </span>
              <Badge color={row.isActive ? "green" : "gray"}>{row.isActive ? "Active" : "Inactive"}</Badge>
              <button className={`btn btn-ghost px-2 py-1 ${i === 0 ? "opacity-30" : "opacity-100"}`} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
              <button className={`btn btn-ghost px-2 py-1 ${i === rows.length - 1 ? "opacity-30" : "opacity-100"}`} disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
              <button className="btn btn-ghost px-2 py-1" onClick={() => { setEditing(row); setEditName(row.name); setError(""); }}>Rename</button>
              {row.isActive ? (
                <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDeactivating(row)}>Deactivate</button>
              ) : (
                <button className="btn btn-ghost px-2 py-1 text-green-800" onClick={() => handleSetActive(row, true)}>Restore</button>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      <Modal open={showAdd} title={`Add ${meta.singular}`} onClose={() => setShowAdd(false)} width={420}>
        <form onSubmit={handleAdd}>
          <label className="text-xs font-medium block mb-1">Name *</label>
          <input autoFocus required value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={`e.g. Qualified`} className="w-full" />
          <div className="mt-4 flex gap-2 justify-end">
            <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={editing !== null} title={`Rename ${meta.singular}`} onClose={() => setEditing(null)} width={420}>
        <form onSubmit={handleRename}>
          <label className="text-xs font-medium block mb-1">Name *</label>
          <input autoFocus required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full" />
          <p className="text-xs text-slate-500 mt-2">
            Existing records using this value will be updated to the new name.
          </p>
          <div className="mt-4 flex gap-2 justify-end">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Rename"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deactivating !== null}
        title={`Deactivate ${meta.singular}`}
        message={`"${deactivating?.name}" will be removed from dropdowns. Existing records keep the value. You can restore it later.`}
        confirmLabel="Deactivate"
        onCancel={() => setDeactivating(null)}
        onConfirm={async () => {
          if (deactivating) await handleSetActive(deactivating, false);
          setDeactivating(null);
        }}
      />
    </div>
  );
}
