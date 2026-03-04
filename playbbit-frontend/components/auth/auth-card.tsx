import { Card, CardContent } from "@/components/ui/card";

interface AuthCardProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export function AuthCard({ children, title, description }: AuthCardProps) {
  return (
    <Card className="w-full max-w-[380px] bg-[#16161a]/80 backdrop-blur-xl border-white/5 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardContent className="p-7 flex flex-col items-center">
        {/* Playbbit Logo */}
        <div className="flex flex-col items-center gap-1 mb-8">
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
              />
              <path
                className="text-[#3713ec] opacity-70"
                d="M100 10 C 112 10, 112 70, 100 70 C 88 70, 50 45, 50 40 C 50 35, 88 10, 100 10 Z"
                fill="currentColor"
              />
              <path
                className="text-[#6366f1]"
                d="M75 5 C 90 5, 90 75, 75 75 C 60 75, 15 45, 15 40 C 15 35, 60 5, 75 5 Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight">
            {title}
          </h1>
          <p className="text-slate-400 text-xs">{description}</p>
        </div>

        {children}
      </CardContent>

      {/* The Signature Playbbit Accent Strip */}
      <div className="h-1 w-full flex">
        <div className="h-full grow bg-[#3713ec]" />
        <div className="h-full grow bg-[#ff69b4]" />
        <div className="h-full grow bg-[#ff8c00]" />
      </div>
    </Card>
  );
}
