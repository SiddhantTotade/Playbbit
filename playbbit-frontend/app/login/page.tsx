"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleCredentialsLogin = (e: React.FormEvent) => {
    e.preventDefault();
    signIn("credentials", { email, password, callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="max-w-md w-full bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-2">Welcome Back</h1>
        <p className="text-zinc-500 text-center mb-8">Sign in to Playbbit</p>

        {/* Google Login Button */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-all mb-6"
        >
          <img
            src="https://www.svgrepo.com/show/355037/google.svg"
            className="w-5 h-5"
            alt="G"
          />
          Continue with Google
        </button>

        <div className="relative flex items-center mb-6">
          <div className="flex-grow border-t border-zinc-800"></div>
          <span className="flex-shrink mx-4 text-zinc-600 text-sm">or</span>
          <div className="flex-grow border-t border-zinc-800"></div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email Address"
            className="w-full p-4 bg-black border border-zinc-700 rounded-xl focus:border-red-600 outline-none"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-4 bg-black border border-zinc-700 rounded-xl focus:border-red-600 outline-none"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="w-full bg-red-600 py-4 rounded-xl font-bold hover:bg-red-700 transition-all">
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
