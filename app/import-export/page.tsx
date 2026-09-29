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
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Import / Export</h1>

      <ErrorBanner message={error} />

      {/* IMPORT SECTION */}
      <div className="bg-white border border-slate-200 mb-6 rounded-lg p-6">
        <h2 className="text-base font-semibold mb-4">Import from Excel</h2>
        <p className="text-sm text-slate-500 mb-3">
          Select an Excel workbook (.xlsx/.xls) to import. The system will parse all relevant sheets, merge duplicates, and create company records.
        </p>
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls" className="flex-1"
            onChange={handleFileChange}
          />
          <button className="btn btn-secondary" onClick={handlePreview} disabled={loading || !selectedFile}>
            {loading ? "Loading..." : "Preview"}
          </button>
        </div>

        {preview && (
          <div className="border border-slate-200 overflow-hidden rounded-md">
            <div className="bg-slate-50 px-4 py-3 border-b border-b-slate-200 flex justify-between items-center">
              <div>
                <strong>{preview.filename}</strong>
                <span className="ml-3 text-slate-500 text-sm">
                  {preview.validRows} valid / {preview.duplicateRows} duplicates / {preview.errorRows} errors (from {preview.totalRows} total)
                </span>
              </div>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : "Import Valid Records"}
              </button>
            </div>
            {preview.sheets.map((sheet) => (
              <div key={sheet.name} className="px-4 py-3 border-b border-b-slate-100">
                <div className="font-medium mb-1">{sheet.name} — {sheet.totalRows} rows</div>
                {sheet.headers.length > 0 && (
                  <div className="text-slate-400 mb-1 text-[11.2px]">
                    Columns: {sheet.headers.join(", ")}
                  </div>
                )}
                {sheet.duplicates.length > 0 && (
                  <div className="text-xs text-orange-700">
                    {sheet.duplicates.length} duplicate rows: {sheet.duplicates.slice(0, 5).join(", ")}{sheet.duplicates.length > 5 ? "..." : ""}
                  </div>
                )}
                {sheet.errors.length > 0 && (
                  <div className="text-xs text-red-600">
                    {sheet.errors.length} errors: {sheet.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.reason}`).join("; ")}
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  Sample: {sheet.rows.slice(0, 3).map((r) => r.company).filter(Boolean).join(", ")}
                </div>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div className="border border-green-100 bg-green-50 rounded-md p-4">
            <div className="font-semibold text-green-800 mb-2">Import Complete</div>
            <div>Imported: {result.imported} companies</div>
            <div>Skipped (duplicates): {result.skipped}</div>
            {result.errors.length > 0 && (
              <div className="mt-2">
                <div className="text-red-600 font-medium">Errors:</div>
                {result.errors.map((e, i) => (
                  <div key={i} className="text-xs">{e.company}: {e.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EXPORT SECTION */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="text-base font-semibold mb-4">Export to Excel</h2>
        <p className="text-sm text-slate-500 mb-4">
          Generate professionally formatted Excel files from CRM data.
        </p>
        <div className="flex gap-3 flex-wrap">
          <a href="/api/export?type=customers" className="btn btn-primary no-underline">
            📊 Export Customer Database
          </a>
          <a href="/api/export?type=projects" className="btn btn-secondary no-underline">
            📋 Export Project Report
          </a>
          <a href="/api/export?type=activities" className="btn btn-secondary no-underline">
            📞 Export Activity Report
          </a>
          <a href="/reports" className="btn btn-secondary no-underline">
            📈 Weekly Accomplishment Report
          </a>
        </div>
      </div>
    </div>
  );
}