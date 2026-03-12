"use client";
import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import VideoPlayer from "@/components/VideoPlayer";
import { MainLayout } from "@/components/layout/main-layout";
import { getMediaUrl } from "@/lib/media-utils";

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restrictedAccess, setRestrictedAccess] = useState(false);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8082/api";

  const checkAccess = async () => {
    try {
      const token = (session as any)?.accessToken;
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/videos/${id}`, { headers });

      if (res.status === 403) {
        setRestrictedAccess(true);
        return false;
      }

      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setVideo(data);
      setRestrictedAccess(false);
      return true;
    } catch (err) {
      console.error("Heartbeat check failed:", err);
      return true; // Don't block on transient network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === "loading") return;

    // Initial check
    checkAccess();

    // Heartbeat polling every 5 seconds for immediate privacy enforcement
    const intervalId = setInterval(async () => {
      const hasAccess = await checkAccess();
      if (!hasAccess) clearInterval(intervalId);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [id, authStatus, session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#3713ec]"></div>
      </div>
    );
  }

  if (restrictedAccess) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <div className="w-24 h-24 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 border border-amber-500/20">
            <span className="material-symbols-outlined text-amber-500 text-5xl">lock</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">This Video is Private <span className="text-amber-500">.</span></h1>
          <p className="text-slate-400 max-w-md mx-auto mb-10 text-lg">
            The creator has restricted access to this content. It's no longer available for public viewing.
          </p>
          <button
            onClick={() => window.location.href = "/"}
            className="px-8 py-3 bg-[#3713ec] hover:bg-[#2500c4] text-white rounded-2xl font-bold transition-all"
          >
            Back to Home
          </button>
        </div>
      </MainLayout>
    );
  }

  if (video?.status === "FAILED") {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
          <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Transcoding Failed <span className="text-red-500">.</span></h1>
          <p className="text-slate-400 max-w-md mx-auto mb-10 text-lg">
            We encountered an error while processing this video. Please try uploading it again or contact support if the issue persists.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.href = "/"}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/10"
            >
              Back to Home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-500/20"
            >
              Retry
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!video) return null;

  return (
    <MainLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          <div className="rounded-3xl overflow-hidden shadow-2xl shadow-[#3713ec]/10 border border-white/5 bg-black/40 backdrop-blur-sm relative">
            <VideoPlayer src={video.hlsUrl} poster={video.thumbnailUrl} />
          </div>
          {/* ... rest of the component remains the same ... */}
          <div className="bg-white/5 border border-white/5 rounded-3xl p-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-3xl font-black tracking-tight text-white mb-6">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center justify-between gap-6 pb-8 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="w-14 h-14 bg-gradient-to-tr from-[#3713ec] to-[#ff69b4] rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg ring-2 ring-white/10 group-hover:scale-105 transition-transform">
                    {video.userName ? video.userName.charAt(0).toUpperCase() : video.userId.toString().charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-[3px] border-[#0a0a0c] rounded-full" />
                </div>

                <div className="flex flex-col">
                  <p className="font-bold text-lg text-white group-hover:text-[#3713ec] transition-colors cursor-pointer">
                    {video.userName || `User ${video.userId.toString().substring(0, 8)}`}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    Published {new Date(video.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-6 py-3 bg-[#3713ec] hover:bg-[#2500c4] text-white rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-[#3713ec]/20">
                  <span className="material-symbols-outlined text-lg">thumb_up</span>
                  Like
                </button>
                <button className="flex items-center justify-center w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all active:scale-95 border border-white/5">
                  <span className="material-symbols-outlined">share</span>
                </button>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-slate-300 leading-relaxed max-w-none prose prose-invert">
                {video.description || "No description provided for this video. The creator let the content speak for itself! 🎞️"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white/5 border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3713ec]">auto_awesome</span>
              Up Next
            </h2>
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-[#3713ec]/10 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[#3713ec] text-3xl animate-pulse">explore</span>
                </div>
                <p className="text-sm font-bold text-slate-400">Expanding logic...</p>
                <p className="text-[11px] text-slate-600 mt-2 max-w-[200px]">
                  Our recommendation algorithm is gathering steam. Check back very soon!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
