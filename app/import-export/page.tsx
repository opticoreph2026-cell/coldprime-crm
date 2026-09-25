"use client";

import { useState, useRef } from "react";
import type { ImportPreview } from "@/lib/types";
import { ErrorBanner } from "@/components/ui";

export default function ImportExportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: { company: string; reason: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(null);
      setResult(null);
      setError("");
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) { setError("Please select an Excel file first"); return; }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("action", "preview");
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPreview(data);
    } catch {
      setError("Failed to preview file");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setImporting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("action", "import");
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || "Import failed"); return; }
      setResult(data);
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("Failed to import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Import / Export</h1>

      <ErrorBanner message={error} />

      {/* IMPORT SECTION */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Import from Excel</h2>
        <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: 12 }}>
          Select an Excel workbook (.xlsx/.xls) to import. The system will parse all relevant sheets, merge duplicates, and create company records.
        </p>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ flex: 1 }}
            onChange={handleFileChange}
          />
          <button className="btn btn-secondary" onClick={handlePreview} disabled={loading || !selectedFile}>
            {loading ? "Loading..." : "Preview"}
          </button>
        </div>

        {preview && (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ background: "#f8fafc", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{preview.filename}</strong>
                <span style={{ marginLeft: 12, color: "#64748b", fontSize: "0.875rem" }}>
                  {preview.validRows} valid / {preview.duplicateRows} duplicates / {preview.errorRows} errors (from {preview.totalRows} total)
                </span>
              </div>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : "Import Valid Records"}
              </button>
            </div>
            {preview.sheets.map((sheet) => (
              <div key={sheet.name} style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{sheet.name} — {sheet.totalRows} rows</div>
                {sheet.duplicates.length > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#c2410c" }}>
                    {sheet.duplicates.length} duplicate rows: {sheet.duplicates.slice(0, 5).join(", ")}{sheet.duplicates.length > 5 ? "..." : ""}
                  </div>
                )}
                {sheet.errors.length > 0 && (
                  <div style={{ fontSize: "0.75rem", color: "#dc2626" }}>
                    {sheet.errors.length} errors: {sheet.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.reason}`).join("; ")}
                  </div>
                )}
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                  Sample: {sheet.rows.slice(0, 3).map((r) => r.company).filter(Boolean).join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div style={{ border: "1px solid #dcfce7", background: "#f0fdf4", borderRadius: 6, padding: 16 }}>
            <div style={{ fontWeight: 600, color: "#166534", marginBottom: 8 }}>Import Complete</div>
            <div>Imported: {result.imported} companies</div>
            <div>Skipped (duplicates): {result.skipped}</div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: "#dc2626", fontWeight: 500 }}>Errors:</div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: "0.75rem" }}>{e.company}: {e.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXPORT SECTION */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 16 }}>Export to Excel</h2>
        <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: 16 }}>
          Generate professionally formatted Excel files from CRM data.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/api/export?type=customers" className="btn btn-primary" style={{ textDecoration: "none" }}>
            📊 Export Customer Database
          </a>
          <a href="/api/export?type=projects" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            📋 Export Project Report
          </a>
          <a href="/api/export?type=activities" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            📞 Export Activity Report
          </a>
          <a href="/api/reports" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            📄 Weekly Accomplishment (PDF)
          </a>
        </div>
      </div>
    </div>
  );
}