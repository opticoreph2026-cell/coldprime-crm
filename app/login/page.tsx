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
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(135deg,_#0f172a_0%,_#1e3a8a_100%)]">
      <div className="w-full bg-white p-10 shadow-[0_25px_50px_-12px_rgba(0,_0,_0,_0.25)] max-w-[400px] rounded-xl">
        <div className="text-center mb-8">
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            COLDPRIME
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Enterprises Corporation
          </div>
          <div className="text-sm text-slate-400 mt-2">
            Sign in to your CRM account
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm mb-4 rounded-md">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 text-sm outline-none rounded-md box-border transition-colors"
              placeholder="admin@coldprime.ph"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 text-sm outline-none rounded-md box-border transition-colors"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading} className={`${`${`${`w-full p-2.5 text-white text-sm font-semibold ${loading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-800 cursor-pointer"}`} border-0`} rounded-md`} transition-colors`}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-slate-400">
          Coldprime CRM v2.0
        </div>
      </div>
    </div>
  );
}
