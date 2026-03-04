import React from "react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-[#0a0a0c]">
      {/* Dynamic Mesh Gradient Background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        {/* Top Left - Playbbit Blue */}
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-[#3713ec]/15 blur-[120px] animate-pulse" />

        {/* Bottom Right - Pink/Purple */}
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full bg-[#ff69b4]/10 blur-[140px]" />

        {/* Center Glow - Deep Indigo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-[#6366f1]/5 blur-[160px]" />

        {/* Subtle Noise Texture (Optional but looks great) */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      <main className="z-10 w-full flex flex-col items-center">{children}</main>

      <footer className="mt-10 text-slate-600 text-[10px] space-y-1 text-center z-10">
        <p>© 2026 Playbbit Inc.</p>
        <div className="flex gap-4 justify-center">
          <a href="#" className="hover:text-slate-300 transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Terms
          </a>
        </div>
      </footer>
    </div>
  );
}
