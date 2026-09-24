"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#dc2626", marginBottom: 12 }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          background: "#1e40af",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Try again
      </button>
    </div>
  );
}
