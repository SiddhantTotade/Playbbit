"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Shared Components
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";

// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getPasswordStrength } from "@/lib/utils";
import { Icons } from "@/components/icons";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Helper for consistent input styling
  const inputStyles =
    "pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500/50 focus-visible:ring-[#3713ec]";

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setError("Please fill in your name and email.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json();
        setError(data.message || "Registration failed.");
      }
    } catch (err) {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Playbbit"
        description={
          step === 1 ? "Let's start with the basics" : "Secure your account"
        }
      >
        <div className="flex gap-2 mb-6">
          <div
            className={`h-1 w-8 rounded-full transition-colors ${step === 1 ? "bg-[#3713ec]" : "bg-white/10"}`}
          />
          <div
            className={`h-1 w-8 rounded-full transition-colors ${step === 2 ? "bg-[#3713ec]" : "bg-white/10"}`}
          />
        </div>

        {/* Improved Error Display */}
        {error && (
          <div className="w-full mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <span className="material-symbols-outlined text-red-500 text-[18px] mt-0.5">
              warning
            </span>
            <div className="flex-1">
              <p className="text-red-400 text-[11px] font-bold uppercase tracking-tight">
                Registration Error
              </p>
              <p className="text-red-300/80 text-[11px]">{error}</p>
            </div>
          </div>
        )}

        <form
          className="w-full space-y-4"
          onSubmit={step === 1 ? handleNext : handleRegister}
        >
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <label className="text-slate-300 text-xs font-medium ml-1">
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                    person
                  </span>
                  <Input
                    required
                    placeholder="Bugs Bunny"
                    className={inputStyles}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

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

              <Button className="cursor-pointer w-full bg-[#3713ec] hover:bg-[#2500c4] text-white font-bold h-10 mt-2">
                Continue
                <span className="material-symbols-outlined ml-2 text-sm">
                  arrow_forward
                </span>
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1 mb-2 transition-colors"
              >
                <span className="material-symbols-outlined text-xs">
                  arrow_back
                </span>{" "}
                Back to info
              </button>

              <div className="space-y-2">
                <label className="text-slate-300 text-xs font-medium ml-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                    vpn_key
                  </span>
                  <Input
                    required
                    type="password"
                    placeholder="••••••••"
                    className={inputStyles}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="px-1 pt-1 space-y-2">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4].map((s) => (
                      <div
                        key={s}
                        className={`h-full flex-1 rounded-full transition-all duration-500 ${
                          getPasswordStrength(password) >= s
                            ? getPasswordStrength(password) <= 2
                              ? "bg-red-500"
                              : getPasswordStrength(password) === 3
                                ? "bg-orange-500"
                                : "bg-emerald-500"
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[9px] font-bold tracking-wider text-slate-500">
                    Strength:
                    <span className="ml-1 text-slate-300">
                      {
                        ["Too Weak", "Weak", "Fair", "Good", "Strong"][
                          getPasswordStrength(password)
                        ]
                      }
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-slate-300 text-xs font-medium ml-1">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                    lock_reset
                  </span>
                  <Input
                    required
                    type="password"
                    placeholder="••••••••"
                    className={`${inputStyles} ${confirmPassword && password !== confirmPassword ? "border-red-500/50" : ""}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button
                disabled={loading || getPasswordStrength(password) < 2}
                className="w-full bg-[#3713ec] hover:bg-[#2500c4] text-white font-bold h-10 mt-2 shadow-lg shadow-[#3713ec]/20 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? "Registering..." : "Complete Registration"}
                {!loading && (
                  <span className="material-symbols-outlined ml-2 text-sm">
                    how_to_reg
                  </span>
                )}
              </Button>
            </div>
          )}
        </form>

        {step === 1 && (
          <>
            <div className="w-full flex items-center gap-3 my-6">
              <Separator className="flex-1 bg-white/5" />
              <span className="text-[10px] font-bold text-slate-600 uppercase">
                Or
              </span>
              <Separator className="flex-1 bg-white/5" />
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <Button
                variant="outline"
                className="cursor-pointer border-white/10 bg-white/5 text-white hover:bg-white/10 text-xs"
              >
                <Icons.google className="w-4 h-4 mr-2" />
                Google
              </Button>

              <Button
                variant="outline"
                className="cursor-pointer border-white/10 bg-white/5 text-white hover:bg-white/10 text-xs"
              >
                <Icons.gitHub className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </div>
          </>
        )}

        <p className="mt-8 text-slate-500 text-[11px] text-center">
          Already have an account?{" "}
          <Link className="text-white font-bold hover:underline" href="/login">
            Log in
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
