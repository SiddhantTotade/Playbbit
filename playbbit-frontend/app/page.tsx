"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { VideoCard } from "@/components/dashboard/video-card";

import { MainLayout } from "@/components/layout/main-layout";

// Simple interface for your Java video objects
export interface PlaybbitVideo {
  id: string;
  title: string;
  hlsUrl: string;
  status: string;
  thumbnailUrl?: string;
  isPrivate: boolean;
  userId: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [publicVideos, setPublicVideos] = useState<PlaybbitVideo[]>([]);
  const [myVideos, setMyVideos] = useState<PlaybbitVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";
        const token = (session as any)?.accessToken;

        // 1. Fetch public feed (accessible to everyone)
        const feedRes = await fetch(`${API_URL}/videos/feed`);
        if (!feedRes.ok) throw new Error("Failed to fetch public feed");
        const feedData = await feedRes.json();
        // Defensive mapping for isPrivate
        const mappedFeed = feedData.map((v: any) => ({
          ...v,
          isPrivate: v.isPrivate ?? v.privateVideo ?? v.private ?? false
        }));
        setPublicVideos(mappedFeed);

        // 2. Fetch "My Videos" if authenticated
        if (token) {
          const myRes = await fetch(`${API_URL}/videos/my`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (myRes.ok) {
            const myData = await myRes.json();
            const mappedMy = myData.map((v: any) => ({
              ...v,
              isPrivate: v.isPrivate ?? v.privateVideo ?? v.private ?? false
            }));
            setMyVideos(mappedMy);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (status !== "loading") {
      fetchAllData();
    }
  }, [status, session]);

  // Handle loading state for the session check
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#3713ec]"></div>
      </div>
    );
  }

  return (
    <MainLayout>
      {/* 1. Header Section */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl flex items-center gap-4">
            Feed <span className="text-[#3713ec]">.</span>
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Discover the latest streams and videos from the Playbbit community.
            New content is popping up every second!
          </p>
        </div>

        {status === "unauthenticated" && (
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white text-sm font-bold transition-all flex items-center gap-2 group"
          >
            Sign in to upload
            <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-8 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-medium">Error: {error}</p>
        </div>
      )}

      {/* 2. My Videos Section (Only for Auth Users) */}
      {status === "authenticated" && (
        <section className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#3713ec]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#3713ec]">person</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white px-1">My Private Vault</h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest ml-1">Your personal collection</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-video rounded-3xl bg-white/5 animate-pulse border border-white/5" />
              ))}
            </div>
          ) : myVideos.length === 0 ? (
            <div className="py-12 px-8 rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500 text-sm mb-4">You haven't uploaded any videos yet.</p>
              <button
                onClick={() => router.push("/video/create")}
                className="text-[#3713ec] font-bold text-sm hover:underline"
              >
                Go upload your first video!
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {myVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  id={video.id}
                  title={video.title}
                  hlsUrl={video.hlsUrl}
                  thumbnail={video.thumbnailUrl || "/thumb-placeholder.jpg"}
                  isPrivate={video.isPrivate}
                  isOwner={true}
                  status={video.status}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Public Feed Section */}
      <section className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-pink-500">public</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-white px-1">Global Exploration</h2>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest ml-1">Trending across Playbbit</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-video rounded-3xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : publicVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-white/5 border border-white/5 rounded-[3rem] backdrop-blur-sm">
            <div className="w-16 h-16 bg-[#3713ec]/10 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[#3713ec] text-3xl">movie</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">The world is quiet...</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto">
              Be the first one to hop on and upload a video to start the party!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {publicVideos.map((video) => (
              <VideoCard
                key={video.id}
                id={video.id}
                title={video.title}
                hlsUrl={video.hlsUrl}
                thumbnail={video.thumbnailUrl || "/thumb-placeholder.jpg"}
                isPrivate={video.isPrivate}
                isOwner={status === "authenticated" && session?.user?.email?.toLowerCase() === video.userId?.toLowerCase()}
                status={video.status}
              />
            ))}
          </div>
        )}
      </section>
    </MainLayout>
  );
}
