"use client";

import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LoginPage() {
  return (
    <AuthLayout>
      <AuthCard title="Playbbit" description="Welcome back, hopper!">
        <form className="w-full space-y-4">
          <div className="space-y-2">
            <label className="text-slate-300 text-xs font-medium ml-1">
              Email
            </label>
            <Input
              className="bg-white/5 border-white/10 text-white"
              placeholder="bunny@playbbit.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-slate-300 text-xs font-medium">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[10px] text-slate-500 hover:text-white"
              >
                Forgot?
              </Link>
            </div>
            <Input
              className="bg-white/5 border-white/10 text-white"
              type="password"
            />
          </div>

          <Button className="w-full bg-[#3713ec] hover:bg-[#2500c4]">
            Log In
          </Button>
        </form>

        <p className="mt-8 text-slate-500 text-[11px] text-center">
          Don't have an account?{" "}
          <Link href="/register" className="text-white font-bold underline">
            Sign up
          </Link>
        </p>
      </AuthCard>
    </AuthLayout>
  );
}
