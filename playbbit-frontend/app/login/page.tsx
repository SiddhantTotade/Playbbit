"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const inputStyles =
    "pl-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500/50 focus-visible:ring-[#3713ec] transition-all";

  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <AuthLayout>
      <AuthCard title="Playbbit" description="Welcome back, hopper!">
        {error && (
          <div className="w-full mb-6 p-3 rounded-md bg-red-500/10 border border-red-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="material-symbols-outlined text-red-500 text-[18px]">
              error
            </span>
            <p className="text-red-400 text-[11px] font-medium">{error}</p>
          </div>
        )}
        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-slate-300 text-xs font-medium ml-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                mail
              </span>
              <Input
                type="email"
                required
                className={inputStyles}
                placeholder="bunny@playbbit.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-slate-300 text-xs font-medium">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[10px] text-slate-500 hover:text-[#3713ec] transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-500 text-[20px]">
                vpn_key
              </span>
              <Input
                type="password"
                required
                placeholder="••••••••"
                className={inputStyles}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button
            disabled={loading}
            className=" cursor-pointer w-full bg-[#3713ec] hover:bg-[#2500c4] text-white font-bold h-10 mt-2 shadow-lg shadow-[#3713ec]/20 transition-all"
          >
            {loading ? "Authenticating..." : "Log In"}
            {!loading && (
              <span className="material-symbols-outlined ml-2 text-sm">
                login
              </span>
            )}
          </Button>
        </form>

        {/* Social Login Divider */}
        <div className="w-full flex items-center gap-3 my-6">
          <Separator className="flex-1 bg-white/5" />
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Or login with
          </span>
          <Separator className="flex-1 bg-white/5" />
        </div>

        {/* Social Buttons */}
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

        <p className="mt-8 text-slate-500 text-[11px] text-center">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="text-white font-bold hover:underline transition-all"
          >
            Sign up now
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
