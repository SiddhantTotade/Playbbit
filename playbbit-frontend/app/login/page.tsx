"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  // This tells NextAuth: "Go run the authorize function in lib/auth.ts"
  const result = await signIn("credentials", {
    email,
    password,
    redirect: false, // Prevents the jump to Google/Error page
  });

  if (result?.error) {
    setError("Invalid email or password from 8080 backend.");
    setLoading(false);
  } else {
    // SUCCESS: Validated by 8080, session created on 3000
    router.push("/");
    router.refresh();
  }
};


  return (
    <div className="font-display bg-background-light dark:bg-background-dark min-h-screen flex flex-col transition-colors duration-300">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-[#3713ec]/20 dark:via-[#131022] dark:to-purple-900/20">
        <div className="layout-container flex h-full grow flex-col items-center justify-center p-4">
          <div className="w-full max-w-[380px] bg-white dark:bg-[#1d1c27] rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 md:p-7 flex flex-col items-center">
              {/* Logo Section */}
              <div className="flex flex-col items-center gap-1 mb-6">
                <div className="relative w-24 h-14 flex items-center justify-center">
                  <svg
                    className="w-full h-full"
                    viewBox="0 0 160 80"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      className="text-[#2500c4] opacity-40"
                      d="M125 15 C 135 15, 135 65, 125 65 C 115 65, 85 45, 85 40 C 85 35, 115 15, 125 15 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      className="text-[#3713ec] opacity-70"
                      d="M100 10 C 112 10, 112 70, 100 70 C 88 70, 50 45, 50 40 C 50 35, 88 10, 100 10 Z"
                      fill="currentColor"
                    ></path>
                    <path
                      className="text-[#6366f1]"
                      d="M75 5 C 90 5, 90 75, 75 75 C 60 75, 15 45, 15 40 C 15 35, 60 5, 75 5 Z"
                      fill="currentColor"
                    ></path>
                  </svg>
                </div>
                <h1 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">
                  Playbbit
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs">
                  Welcome back, hopper!
                </p>
              </div>

              {error && (
                <div className="w-full mb-3 p-2 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-[11px] text-center">
                  {error}
                </div>
              )}

              <form className="w-full space-y-4" onSubmit={handleLogin}>
                {/* Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 dark:text-slate-200 text-xs font-semibold px-1">
                    Email address
                  </label>
                  <div className="group relative flex items-center rounded-lg border border-slate-200 dark:border-white/10 bg-transparent dark:bg-white/5 backdrop-blur-md transition-all focus-within:ring-2 focus-within:ring-[#3713ec]/40 focus-within:border-[#3713ec] focus-within:bg-white/10">
                    <span className="material-symbols-outlined pl-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-[#3713ec] transition-colors text-[20px] pointer-events-none">
                      mail
                    </span>
                    <input
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-grow h-10 px-2.5 text-sm outline-none bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400/60"
                      placeholder="bunny@playbbit.com"
                      type="email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-slate-700 dark:text-slate-200 text-xs font-semibold">
                      Password
                    </label>
                    <Link
                      className="text-[10px] font-medium text-slate-400 dark:text-white hover:underline"
                      href="/forgot-password"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <div className="group relative flex items-center rounded-lg border border-slate-200 dark:border-white/10 bg-transparent dark:bg-white/5 backdrop-blur-md transition-all focus-within:ring-2 focus-within:ring-[#3713ec]/40 focus-within:border-[#3713ec] focus-within:bg-white/10">
                    <span className="material-symbols-outlined pl-3.5 text-slate-400 dark:text-slate-500 group-focus-within:text-[#3713ec] transition-colors text-[20px] pointer-events-none">
                      vpn_key
                    </span>
                    <input
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex-grow h-10 px-2.5 text-sm outline-none bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400/60"
                      placeholder="••••••••"
                      type="password"
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="w-full h-10 bg-[#3713ec] hover:bg-[#2500c4] text-white font-bold rounded-lg shadow-lg shadow-[#3713ec]/20 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 text-sm"
                  type="submit"
                >
                  <span>{loading ? "..." : "Log In"}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    login
                  </span>
                </button>
              </form>

              {/* Divider */}
              <div className="w-full flex items-center gap-3 my-5">
                <div className="h-[1px] grow bg-slate-200 dark:bg-slate-700"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Or
                </span>
                <div className="h-[1px] grow bg-slate-200 dark:bg-slate-700"></div>
              </div>

              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() =>
                    signIn("google", { callbackUrl: "/dashboard" })
                  }
                  className="flex items-center justify-center gap-2 h-10 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-xs font-semibold"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    ></path>
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    ></path>
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    ></path>
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                      fill="#EA4335"
                    ></path>
                  </svg>
                  Google
                </button>
                <button
                  onClick={() =>
                    signIn("github", { callbackUrl: "/dashboard" })
                  }
                  className="flex items-center justify-center gap-2 h-10 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors text-xs font-semibold"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  GitHub
                </button>
              </div>

              <p className="mt-8 text-slate-500 dark:text-slate-400 text-[11px]">
                Don't have an account?{" "}
                <Link
                  className="text-slate-400 dark:text-white font-bold hover:underline"
                  href="/register"
                >
                  Sign up
                </Link>
              </p>
            </div>

            <div className="h-1.5 w-full flex">
              <div className="h-full grow bg-[#3713ec]"></div>
              <div className="h-full grow bg-[#ff69b4]"></div>
              <div className="h-full grow bg-[#ff8c00]"></div>
            </div>
          </div>

          <footer className="mt-6 text-center text-slate-400 dark:text-slate-500 text-[10px]">
            © 2026 Playbbit Inc.
            <div className="mt-1 flex justify-center gap-3">
              <a className="hover:text-white transition-colors" href="#">
                Privacy
              </a>
              <a className="hover:text-white transition-colors" href="#">
                Terms
              </a>
            </div>
          </footer>
        </div>

        {/* Background Blur */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-30 dark:opacity-20 overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-[#3713ec]/20 blur-[120px]"></div>
          <div className="absolute top-[40%] -right-[5%] w-[35%] h-[35%] rounded-full bg-[#ff69b4]/20 blur-[120px]"></div>
          <div className="absolute -bottom-[10%] left-[20%] w-[45%] h-[45%] rounded-full bg-[#ff8c00]/10 blur-[120px]"></div>
        </div>
      </div>
    </div>
  );
}
