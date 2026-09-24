"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Vendor {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  mobile1: string | null;
  mobile2: string | null;
  landline1: string | null;
  landline2: string | null;
  status: string;
  notes: string | null;
  branch: { id: string; name: string };
  createdAt: string;
}

interface VendorContact {
  id: string;
  firstName: string;
  lastName?: string;
  position?: string;
  email?: string;
  mobile?: string;
  landline?: string;
  contactPreference?: string;
  notes?: string;
}

interface VendorMaterial {
  id: string;
  itemName: string;
  category?: string;
  brand?: string;
  model?: string;
  unit?: string;
  unitPrice?: number;
  currency: string;
  priceValidUntil?: string;
  notes?: string;
}

export default function VendorDetailPage() {
  const { id } = useParams();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [materials, setMaterials] = useState<VendorMaterial[]>([]);
  const [activeTab, setActiveTab] = useState<"contacts" | "materials">("contacts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", position: "", email: "", mobile: "" });
  const [materialForm, setMaterialForm] = useState({ itemName: "", category: "", brand: "", model: "", unit: "", unitPrice: "" });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/vendors/${id}`);
        if (!res.ok) { setError("Vendor not found"); return; }
        const data = await res.json();
        setVendor(data);
        setContacts(data.contacts || []);
        setMaterials(data.materials || []);
      } catch {
        setError("Failed to load vendor");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleAddContact = async () => {
    if (!contactForm.firstName.trim()) return;
    try {
      const res = await fetch(`/api/vendors/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setShowAddContact(false);
        setContactForm({ firstName: "", lastName: "", position: "", email: "", mobile: "" });
        const r = await fetch(`/api/vendors/${id}`);
        const d = await r.json();
        setContacts(d.contacts || []);
      }
    } catch {}
  };

  const handleAddMaterial = async () => {
    if (!materialForm.itemName.trim()) return;
    try {
      const res = await fetch(`/api/vendors/${id}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(materialForm),
      });
      if (res.ok) {
        setShowAddMaterial(false);
        setMaterialForm({ itemName: "", category: "", brand: "", model: "", unit: "", unitPrice: "" });
        const r = await fetch(`/api/vendors/${id}`);
        const d = await r.json();
        setMaterials(d.materials || []);
      }
    } catch {}
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading vendor...</div>;
  if (error) return <div style={{ padding: 24 }}><div style={{ background: "#fef2f2", color: "#dc2626", padding: 12, borderRadius: 8 }}>{error}</div></div>;
  if (!vendor) return null;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Link href="/vendors" style={{ fontSize: "0.875rem", color: "#3b82f6" }}>← Back to Vendors</Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 8, marginBottom: 4 }}>{vendor.name}</h1>
      <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: 24 }}>
        {vendor.category} • {vendor.branch.name} • Status: {vendor.status}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("contacts")}
          style={{ padding: "8px 16px", background: activeTab === "contacts" ? "#1e40af" : "#e2e8f0", color: activeTab === "contacts" ? "#fff" : "#0f172a", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >
          Contacts ({contacts.length})
        </button>
        <button
          onClick={() => setActiveTab("materials")}
          style={{ padding: "8px 16px", background: activeTab === "materials" ? "#1e40af" : "#e2e8f0", color: activeTab === "materials" ? "#fff" : "#0f172a", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >
          Price List ({materials.length})
        </button>
      </div>

      {activeTab === "contacts" && (
        <div>
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowAddContact(!showAddContact)}>
            {showAddContact ? "Cancel" : "+ Add Contact"}
          </button>
          {showAddContact && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input placeholder="First Name" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={contactForm.firstName} onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })} />
              <input placeholder="Last Name" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={contactForm.lastName} onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })} />
              <input placeholder="Position" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={contactForm.position} onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })} />
              <input placeholder="Email" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              <input placeholder="Mobile" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} />
              <button className="btn btn-primary" onClick={handleAddContact}>Add</button>
            </div>
          )}
          {contacts.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No contacts yet.</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontWeight: 600 }}>{c.firstName} {c.lastName || ""}</span>
                {c.position && <span style={{ color: "#64748b", marginLeft: 8 }}>{c.position}</span>}
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.email} • {c.mobile}</div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "materials" && (
        <div>
          <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowAddMaterial(!showAddMaterial)}>
            {showAddMaterial ? "Cancel" : "+ Add Material"}
          </button>
          {showAddMaterial && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input placeholder="Item Name" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={materialForm.itemName} onChange={(e) => setMaterialForm({ ...materialForm, itemName: e.target.value })} />
              <input placeholder="Category" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={materialForm.category} onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })} />
              <input placeholder="Brand" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={materialForm.brand} onChange={(e) => setMaterialForm({ ...materialForm, brand: e.target.value })} />
              <input placeholder="Model" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={materialForm.model} onChange={(e) => setMaterialForm({ ...materialForm, model: e.target.value })} />
              <input placeholder="Unit" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={materialForm.unit} onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })} />
              <input placeholder="Unit Price" type="number" style={{ padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: 4 }}
                value={materialForm.unitPrice} onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: e.target.value })} />
              <button className="btn btn-primary" onClick={handleAddMaterial}>Add</button>
            </div>
          )}
          {materials.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No materials listed.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Item</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Category</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Brand</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Model</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Unit</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Unit Price</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Valid Until</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{m.itemName}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.category}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.brand}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.model}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.unit}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.unitPrice} {m.currency}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{m.priceValidUntil ? new Date(m.priceValidUntil).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
