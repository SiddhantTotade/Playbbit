"use client";

import React from "react";
import { Navbar } from "./navbar";

export function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen w-full flex flex-col relative overflow-x-hidden bg-[#0a0a0c] text-white">
            {/* Dynamic Mesh Gradient Background */}
            <div className="fixed inset-0 pointer-events-none -z-10">
                {/* Top Left - Playbbit Blue */}
                <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-[#3713ec]/10 blur-[120px] animate-pulse" />

                {/* Bottom Right - Pink/Purple */}
                <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full bg-[#ff69b4]/5 blur-[140px]" />

                {/* Center Glow - Deep Indigo */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-[#6366f1]/5 blur-[160px]" />

                {/* Subtle Noise Texture */}
                <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
            </div>

            <Navbar />

            <main className="flex-1 z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-700">
                {children}
            </main>

            <footer className="w-full border-t border-white/5 py-8 mt-auto z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs text-center md:text-left">
                    <div className="flex flex-col gap-1">
                        <p className="font-bold text-slate-400">Playbbit Inc.</p>
                        <p>© 2026 Crafted with hopping love.</p>
                    </div>
                    <div className="flex gap-8">
                        <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-white transition-colors">Support</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
