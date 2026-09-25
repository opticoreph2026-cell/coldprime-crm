"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import type { User, Branch } from "@/lib/types";
import { PageHeader, EmptyRow, EmptyState, Modal, ConfirmDialog } from "@/components/ui";

const ROLES = ["HEAD_ADMIN", "BRANCH_ADMIN", "STAFF"];

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF", branchId: "" });
  const [error, setError] = useState("");

  const isHeadAdmin = session?.user?.role === "HEAD_ADMIN";

  const fetchUsers = useCallback(async () => {
    try {
      setError("");
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.data || []);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch("/api/branches");
      const data = await res.json();
      setBranches(data.data || []);
    } catch {
      setBranches([]);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, [fetchUsers, fetchBranches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const url = editingId ? `/api/users/${editingId}` : "/api/users";
      const method = editingId ? "PUT" : "POST";
      const body: Record<string, string | boolean | undefined> = { ...form };
      if (editingId && !body.password) delete body.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to save"); return; }
      setShowForm(false);
      setEditingId(null);
      setForm({ name: "", email: "", password: "", role: "STAFF", branchId: "" });
      fetchUsers();
    } catch {
      setError("Failed to save user");
    }
  };

  const handleEdit = (u: User) => {
    setForm({ name: u.name, email: u.email, password: "", role: u.role, branchId: u.branch?.id || "" });
    setEditingId(u.id);
    setShowForm(true);
    setError("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      console.error("Failed to delete user");
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      fetchUsers();
    } catch {
      console.error("Failed to update user");
    }
  };

  if (!isHeadAdmin && session?.user?.role !== "BRANCH_ADMIN") {
    return <div style={{ padding: 24 }}>Access denied. Admin only.</div>;
  }

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        subtitle={`${users.length} users`}
        actions={
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", email: "", password: "", role: "STAFF", branchId: session?.user?.branchId || "" }); setError(""); }}>
            + Add User
          </button>
        }
      />

      <Modal open={showForm} title={editingId ? "Edit User" : "New User"} onClose={() => { setShowForm(false); setEditingId(null); }}>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "0.75rem 1rem", borderRadius: 6, fontSize: "0.875rem", marginBottom: 16 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Name *</label><input required style={{ width: "100%" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Email *</label><input type="email" required style={{ width: "100%" }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>{editingId ? "New Password (leave blank to keep)" : "Password *"}</label><input type="password" style={{ width: "100%" }} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} minLength={8} /></div>
            <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Role</label><select style={{ width: "100%" }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={!isHeadAdmin}>{ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}</select></div>
            {isHeadAdmin && <div><label style={{ fontSize: "0.75rem", fontWeight: 500, display: "block", marginBottom: 4 }}>Branch</label><select style={{ width: "100%" }} value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} required>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Create"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <div className="page-scroll">
      {!loading && users.length === 0 && !error ? (
        <EmptyState message="No users yet — use + Add User to create the first one." />
      ) : (
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`badge badge-${u.role === "HEAD_ADMIN" ? "purple" : u.role === "BRANCH_ADMIN" ? "blue" : "gray"}`}>{u.role.replace("_", " ")}</span></td>
                <td>{u.branch?.name || "-"}</td>
                <td><span className={`badge badge-${u.isActive ? "green" : "red"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                <td>
                  <button className="btn btn-ghost" onClick={() => handleEdit(u)} style={{ padding: "0.25rem 0.5rem" }}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => handleToggleActive(u)} style={{ padding: "0.25rem 0.5rem" }}>{u.isActive ? "Deactivate" : "Activate"}</button>
                  {isHeadAdmin && u.id !== session?.user?.id && <button className="btn btn-ghost" onClick={() => setDeleteTarget({ id: u.id, name: u.email })} style={{ padding: "0.25rem 0.5rem", color: "#dc2626" }}>Delete</button>}
                </td>
              </tr>
            ))}
            {users.length === 0 && <EmptyRow colSpan={6} message={loading ? "Loading…" : "No users found"} />}
          </tbody>
        </table>
      </div>
      )}
      </div>
    </div>
  );
}
