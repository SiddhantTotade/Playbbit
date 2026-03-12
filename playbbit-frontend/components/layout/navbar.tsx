"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

export function Navbar() {
    const { data: session } = useSession();

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2 group">
                            <Logo className="w-12 h-8 transition-transform group-hover:scale-110" />
                            <span className="text-white font-bold text-xl tracking-tight">
                                Playbbit
                            </span>
                        </Link>

                        <div className="hidden md:flex items-center gap-1">
                            <Link
                                href="/"
                                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            >
                                Feed
                            </Link>
                            <Link
                                href="/live"
                                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            >
                                Live Streams
                            </Link>
                            <Link
                                href="/video/create"
                                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            >
                                Upload
                            </Link>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {session ? (
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex flex-col items-end">
                                    <span className="text-xs font-semibold text-white">
                                        {session.user?.name || "Bunnny"}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                        {session.user?.email}
                                    </span>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#3713ec] to-[#ff69b4] flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10 shadow-lg" title={session.user?.email || ""}>
                                    {session.user?.email?.charAt(0).toUpperCase() || "B"}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => signOut()}
                                    className="text-slate-400 hover:text-white hover:bg-red-500/10 hover:text-red-400 transition-all rounded-lg"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        logout
                                    </span>
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link href="/login">
                                    <Button variant="ghost" size="sm" className="text-slate-300">
                                        Log In
                                    </Button>
                                </Link>
                                <Link href="/register">
                                    <Button size="sm" className="bg-[#3713ec] hover:bg-[#2500c4]">
                                        Sign Up
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
