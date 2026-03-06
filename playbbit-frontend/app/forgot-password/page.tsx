"use client";

import React, { useState } from "react";
import Link from "next/link";

// Shared Components
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const inputStyles =
    "pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500/50 focus-visible:ring-[#3713ec]";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";
      const res = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setMessage("Recovery link sent! Please check your inbox.");
      } else {
        const data = await res.json();
        setError(data.message || "Something went wrong. Try again.");
      }
    } catch (err) {
      setError("Cannot connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Reset Password"
        description="Enter your email to receive a recovery link"
      >
        {/* Success / Error Messages */}
        {message && (
          <div className="w-full mb-6 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] text-center animate-in fade-in">
            {message}
          </div>
        )}

        {error && (
          <div className="w-full mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] text-center animate-in fade-in">
            {error}
          </div>
        )}

        {!message ? (
          <form className="w-full space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-slate-300 text-xs font-medium ml-1">
                Email address
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                  mail
                </span>
                <Input
                  required
                  type="email"
                  placeholder="bunny@playbbit.com"
                  className={inputStyles}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <Button
              disabled={loading}
              className="w-full bg-[#3713ec] hover:bg-[#2500c4] text-white font-bold h-10 mt-2 shadow-lg shadow-[#3713ec]/20"
            >
              {loading ? "Sending..." : "Send Reset Link"}
              {!loading && (
                <span className="material-symbols-outlined ml-2 text-sm">
                  send
                </span>
              )}
            </Button>
          </form>
        ) : (
          <Button
            asChild
            className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
          >
            <Link href="/login">Return to Login</Link>
          </Button>
        )}

        <p className="mt-8 text-slate-500 text-[11px] text-center">
          Remembered your password?{" "}
          <Link className="text-white font-bold hover:underline" href="/login">
            Back to Login
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
