"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPasswordStrength } from "@/lib/utils";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const inputStyles =
    "pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500/50 focus-visible:ring-[#3713ec]";

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword)
      return setError("Passwords do not match.");
    if (getPasswordStrength(password) < 3)
      return setError("Please use a stronger password.");

    setLoading(true);
    try {
      // Logic to call your backend with the token and new password
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError("Link expired or invalid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="New Password"
        description="Set a strong password for your account"
      >
        {success ? (
          <div className="text-center space-y-4 animate-in fade-in zoom-in">
            <div className="text-emerald-400 text-sm font-medium">
              Password reset successfully!
            </div>
            <p className="text-slate-500 text-xs">
              Redirecting you to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="w-full space-y-4">
            {error && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-slate-300 text-xs font-medium ml-1">
                New Password
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                  vpn_key
                </span>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className={inputStyles}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-slate-300 text-xs font-medium ml-1">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                  lock_reset
                </span>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className={inputStyles}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              disabled={loading}
              className="w-full bg-[#3713ec] hover:bg-[#2500c4]"
            >
              {loading ? "Updating..." : "Reset Password"}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <AuthLayout>
        <AuthCard title="Loading..." description="Please wait...">
          <div />
        </AuthCard>
      </AuthLayout>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
