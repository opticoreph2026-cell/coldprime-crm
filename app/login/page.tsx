"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 400,
        background: "#fff",
        borderRadius: 12,
        padding: "2.5rem",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: "-0.025em",
          }}>
            COLDPRIME
          </div>
          <div style={{
            fontSize: "0.75rem",
            color: "#64748b",
            marginTop: 4,
          }}>
            Enterprises Corporation
          </div>
          <div style={{
            fontSize: "0.875rem",
            color: "#94a3b8",
            marginTop: 8,
          }}>
            Sign in to your CRM account
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "0.75rem 1rem",
              borderRadius: 6,
              fontSize: "0.875rem",
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
            }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: "0.875rem",
                outline: "none",
                transition: "border-color 0.15s",
                boxSizing: "border-box",
              }}
              placeholder="admin@coldprime.ph"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#374151",
              marginBottom: 6,
            }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: "0.875rem",
                outline: "none",
                transition: "border-color 0.15s",
                boxSizing: "border-box",
              }}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.625rem",
              background: loading ? "#93c5fd" : "#1e40af",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{
          textAlign: "center",
          marginTop: "1.5rem",
          fontSize: "0.75rem",
          color: "#94a3b8",
        }}>
          Coldprime CRM v2.0
        </div>
      </div>
    </div>
  );
}
