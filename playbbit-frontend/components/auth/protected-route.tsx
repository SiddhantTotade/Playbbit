"use client";

import { useAuthContext } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuthContext(); // Get isLoading here
  const router = useRouter();

  useEffect(() => {
    // ONLY redirect if we are finished loading AND there is no token
    if (!isLoading && !token) {
      router.push("/login");
    }
  }, [token, isLoading, router]);

  // While checking localStorage, show a loader or nothing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#3713ec] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If loading is done and we have a token, show the dashboard
  return token ? <>{children}</> : null;
}
