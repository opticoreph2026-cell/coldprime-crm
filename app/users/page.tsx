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
    return <div className="p-6">Access denied. Admin only.</div>;
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
          {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm mb-4 rounded-md">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium block mb-1">Name *</label><input required className="w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">Email *</label><input type="email" required className="w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="text-xs font-medium block mb-1">{editingId ? "New Password (leave blank to keep)" : "Password *"}</label><input type="password" className="w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingId} minLength={8} /></div>
            <div><label className="text-xs font-medium block mb-1">Role</label><select className="w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={!isHeadAdmin}>{ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}</select></div>
            {isHeadAdmin && <div><label className="text-xs font-medium block mb-1">Branch</label><select className="w-full" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} required>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}
          </div>
          <div className="mt-4 flex gap-2">
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
      <div className="bg-white border border-slate-200 overflow-hidden rounded-lg">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`badge badge-${u.role === "HEAD_ADMIN" ? "purple" : u.role === "BRANCH_ADMIN" ? "blue" : "gray"}`}>{u.role.replace("_", " ")}</span></td>
                <td>{u.branch?.name || "-"}</td>
                <td><span className={`badge badge-${u.isActive ? "green" : "red"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                <td>
                  <button className="btn btn-ghost px-2 py-1" onClick={() => handleEdit(u)}>Edit</button>
                  <button className="btn btn-ghost px-2 py-1" onClick={() => handleToggleActive(u)}>{u.isActive ? "Deactivate" : "Activate"}</button>
                  {isHeadAdmin && u.id !== session?.user?.id && <button className="btn btn-ghost px-2 py-1 text-red-600" onClick={() => setDeleteTarget({ id: u.id, name: u.email })}>Delete</button>}
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
