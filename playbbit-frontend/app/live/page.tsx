"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { GoLiveDialog } from "@/components/live/GoLiveDialog";

interface StreamEntity {
    id: string;
    title: string;
    streamKey: string;
    userId: string;
    userName?: string;
    status: "LIVE" | "VOD" | "IDLE";
    visibility: "PUBLIC" | "PRIVATE";
    manifestUrl: string | null;
    createdAt: string;
}

export default function LiveFeedPage() {
    const { data: session, status: authStatus } = useSession();
    const router = useRouter();
    const [streams, setStreams] = useState<StreamEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStreams = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8082/api";
                const res = await fetch(`${API_URL}/videos/live/public`);
                if (!res.ok) throw new Error("Failed to fetch live streams");
                const data = await res.json();
                setStreams(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchStreams();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStreams, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <MainLayout>
            {/* 1. Header Section */}
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-red-500 text-sm animate-pulse">sensors</span>
                        </div>
                        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Real-time Broadcasting</p>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl flex items-center gap-4">
                        Live <span className="text-[#3713ec]">.</span>
                    </h1>
                    <p className="text-slate-400 text-sm max-w-xl">
                        Watch creators broadcast in real-time. Join the conversation,
                        support your favorite streamers, and never miss a beat.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <GoLiveDialog />
                </div>
            </div>

            {error && (
                <div className="mb-8 bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <span className="material-symbols-outlined">error</span>
                    <p className="text-sm font-medium">Error: {error}</p>
                </div>
            )}

            {/* 2. Streams Grid */}
            <section className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-[#3713ec]/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#3713ec]">explore</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white px-1">Active Airwaves</h2>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest ml-1">Streaming right now</p>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="space-y-4">
                                <div className="aspect-video rounded-[2rem] bg-white/5 animate-pulse border border-white/5" />
                                <div className="h-4 w-2/3 bg-white/5 rounded-lg animate-pulse mx-2" />
                                <div className="h-3 w-1/2 bg-white/5 rounded-lg animate-pulse mx-2" />
                            </div>
                        ))}
                    </div>
                ) : streams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center bg-white/5 border border-white/5 rounded-[3rem] backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#3713ec]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <div className="w-20 h-20 bg-[#3713ec]/10 rounded-3xl flex items-center justify-center mb-6 border border-[#3713ec]/20 relative z-10 transition-transform group-hover:scale-110 duration-500">
                            <span className="material-symbols-outlined text-[#3713ec] text-4xl">videocam_off</span>
                        </div>
                        <h3 className="text-2xl font-black text-white mb-3 relative z-10">The stage is empty</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto mb-8 relative z-10">
                            No one is live right now. This is your chance to take the spotlight and start your own broadcast!
                        </p>
                        <div className="relative z-10">
                            <GoLiveDialog />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {streams.map((stream) => (
                            <Link
                                href={`/live/${stream.id}`}
                                key={stream.id}
                                className="group block"
                            >
                                <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-white/5 bg-black/40 shadow-xl group-hover:shadow-[#3713ec]/20 transition-all duration-500 group-hover:-translate-y-2">
                                    {/* Thumbnail Placeholder with Gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black flex items-center justify-center">
                                        <span className="material-symbols-outlined text-white/5 text-7xl group-hover:scale-110 transition-transform duration-700">sensors</span>
                                    </div>

                                    {/* Top Badges */}
                                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                                        <div className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-[10px] font-black tracking-widest uppercase shadow-lg shadow-red-500/20 animate-pulse flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                            LIVE
                                        </div>
                                    </div>

                                    {stream.visibility === "PRIVATE" && (
                                        <div className="absolute top-4 right-4 z-20">
                                            <div className="w-8 h-8 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-amber-500 shadow-xl">
                                                <span className="material-symbols-outlined text-sm">lock</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 z-10 bg-[#3713ec]/0 group-hover:bg-[#3713ec]/10 border-0 group-hover:border-[6px] border-[#3713ec]/20 transition-all duration-500" />

                                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 transform scale-75 group-hover:scale-100">
                                        <div className="w-14 h-14 rounded-2xl bg-[#3713ec] text-white flex items-center justify-center shadow-[0_0_30px_rgba(55,19,236,0.5)]">
                                            <span className="material-symbols-outlined text-3xl">play_arrow</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 px-2">
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3713ec] to-[#ff69b4] flex-shrink-0 flex items-center justify-center text-white font-black text-sm shadow-lg">
                                            {stream.userName ? stream.userName[0].toUpperCase() : stream.userId[0].toUpperCase()}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <h3 className="text-white font-black tracking-tight text-lg line-clamp-1 group-hover:text-[#3713ec] transition-colors duration-300">
                                                {stream.title || "Untitled Stream"}
                                            </h3>
                                            <p className="text-slate-500 text-sm font-medium flex items-center gap-1.5 mt-0.5">
                                                {stream.userName || `User ${stream.userId.substring(0, 8)}`}
                                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                8.4k watching
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </MainLayout>
    );
}
