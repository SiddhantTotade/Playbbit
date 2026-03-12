"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import VideoPlayer from "@/components/VideoPlayer";
import { MainLayout } from "@/components/layout/main-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    description?: string;
}

export default function LiveStreamViewerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: streamId } = use(params);
    const { data: session, status: authStatus } = useSession();

    const [stream, setStream] = useState<StreamEntity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [pin, setPin] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [pinError, setPinError] = useState("");
    const [manifestUrl, setManifestUrl] = useState<string | null>(null);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8082/api";

    const fetchStream = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/live/${streamId}`);
            if (!res.ok) throw new Error("Stream not found.");
            const data = await res.json();
            setStream(data);
            if (data.manifestUrl) {
                const fullUrl = data.manifestUrl.startsWith("http")
                    ? data.manifestUrl
                    : `${API_BASE_URL.replace("/api", "")}${data.manifestUrl}`;
                setManifestUrl(fullUrl);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load stream.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!streamId) return;
        fetchStream();

        // Refresh stream info every 10 seconds to check status
        const intervalId = setInterval(fetchStream, 10000);
        return () => clearInterval(intervalId);
    }, [streamId]);

    const handleVerifyPin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length !== 6) return setPinError("PIN must be 6 digits.");
        setVerifying(true);
        setPinError("");

        try {
            const res = await fetch(`${API_BASE_URL}/live/${streamId}/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });

            if (!res.ok) throw new Error("Incorrect PIN.");
            const data = await res.json();
            if (data.manifestUrl) {
                const fullUrl = data.manifestUrl.startsWith("http")
                    ? data.manifestUrl
                    : `${API_BASE_URL.replace("/api", "")}${data.manifestUrl}`;
                setManifestUrl(fullUrl);
            }
        } catch (err) {
            setPinError(err instanceof Error ? err.message : "Verification failed.");
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#3713ec]"></div>
            </div>
        );
    }

    if (error || !stream) {
        return (
            <MainLayout>
                <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
                    <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                        <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
                    </div>
                    <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Stream Offline <span className="text-red-500">.</span></h1>
                    <p className="text-slate-400 max-w-md mx-auto mb-10 text-lg">
                        {error || "We couldn't find the stream you're looking for. It might have ended or is no longer available."}
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

    const needsPin = stream.visibility === "PRIVATE" && !manifestUrl;

    return (
        <MainLayout>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    <div className="rounded-3xl overflow-hidden shadow-2xl shadow-[#3713ec]/10 border border-white/5 bg-black/40 backdrop-blur-sm relative min-h-[400px] flex items-center justify-center">
                        {needsPin ? (
                            <div className="p-12 w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                                    <span className="material-symbols-outlined text-amber-500 text-4xl">lock</span>
                                </div>
                                <h2 className="text-3xl font-black text-white text-center mb-2 tracking-tight">Private Access</h2>
                                <p className="text-slate-400 text-center text-sm mb-10">This stream is restricted. Please enter the 6-digit access PIN provided by the broadcaster.</p>

                                <form onSubmit={handleVerifyPin} className="space-y-6">
                                    <div className="flex justify-center">
                                        <Input
                                            type="text"
                                            maxLength={6}
                                            placeholder="••••••"
                                            className="text-center text-4xl tracking-[0.5em] font-black w-full h-20 bg-white/5 border-white/10 text-white placeholder:text-slate-700/50 focus-visible:ring-[#3713ec] rounded-2xl transition-all"
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                        />
                                    </div>

                                    {pinError && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold text-center rounded-2xl animate-in shake-x">
                                            {pinError}
                                        </div>
                                    )}

                                    <Button
                                        disabled={verifying || pin.length !== 6}
                                        className="w-full h-14 bg-[#3713ec] hover:bg-[#2500c4] text-white font-black text-lg rounded-2xl transition-all shadow-lg shadow-[#3713ec]/20 active:scale-95"
                                    >
                                        {verifying ? "Verifying..." : "Unlock Live Entry"}
                                    </Button>
                                </form>
                            </div>
                        ) : (
                            manifestUrl ? (
                                <VideoPlayer src={manifestUrl} poster="/thumb-placeholder.jpg" />
                            ) : (
                                <div className="flex flex-col items-center gap-4 py-24 animate-in fade-in duration-1000">
                                    <div className="relative">
                                        <div className="w-20 h-20 bg-[#3713ec]/10 rounded-full flex items-center justify-center border border-[#3713ec]/20">
                                            <span className="material-symbols-outlined text-[#3713ec] text-4xl animate-pulse">sensors</span>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <h2 className="text-2xl font-black text-white tracking-tight">Waiting for Signal</h2>
                                        <p className="text-slate-500 text-sm mt-1">The broadcaster is setting up. Stream will begin shortly.</p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-3xl p-8 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center gap-3 mb-6">
                            {stream.status === "LIVE" && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-xl text-[10px] font-black tracking-widest uppercase shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                    LIVE
                                </div>
                            )}
                            {stream.visibility === "PRIVATE" && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-[10px] font-black tracking-widest uppercase">
                                    <span className="material-symbols-outlined text-xs">lock</span>
                                    PRIVATE
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/5 text-slate-400 rounded-xl text-[10px] font-black tracking-widest uppercase ml-auto">
                                <span className="material-symbols-outlined text-xs">group</span>
                                8.4K VIEWING
                            </div>
                        </div>

                        <h1 className="text-3xl font-black tracking-tight text-white mb-6">
                            {stream.title || "Untitled Live Session"}
                        </h1>

                        <div className="flex flex-wrap items-center justify-between gap-6 pb-8 border-b border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <div className="w-14 h-14 bg-gradient-to-tr from-[#3713ec] to-[#ff69b4] rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg ring-2 ring-white/10 group-hover:scale-105 transition-transform">
                                        {stream.userName ? stream.userName.charAt(0).toUpperCase() : stream.userId.substring(0, 1).toUpperCase()}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-[3px] border-[#0a0a0c] rounded-full shadow-lg" />
                                </div>

                                <div className="flex flex-col">
                                    <p className="font-bold text-lg text-white group-hover:text-[#3713ec] transition-colors cursor-pointer">
                                        {stream.userName || `Broadcaster ${stream.userId.substring(0, 8)}`}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Started {new Date(stream.createdAt).toLocaleTimeString(undefined, {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })} • {new Date(stream.createdAt).toLocaleDateString()}
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
                                {stream.description || "Welcome to the stream! Hang out, chat, and enjoy the live content. Don't forget to follow for more updates! 🚀"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-white/5 border border-white/5 rounded-3xl p-8 backdrop-blur-sm shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#3713ec] opacity-50 group-hover:opacity-100 transition-opacity" />
                        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#3713ec]">chat</span>
                            Live Chat
                        </h2>
                        <div className="h-[400px] flex flex-col justify-end">
                            <div className="space-y-4 mb-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                <div className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                    <div className="w-8 h-8 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white uppercase italic">S</div>
                                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5 max-w-[80%]">
                                        <p className="text-[11px] font-bold text-slate-500 mb-1">System Bot</p>
                                        <p className="text-xs text-white/90">Welcome to the live chat! Be respectful and have fun! 🎉</p>
                                    </div>
                                </div>
                            </div>
                            <div className="relative group">
                                <Input
                                    placeholder="Type a message..."
                                    className="bg-white/5 border-white/10 rounded-2xl h-12 pr-12 text-sm focus-visible:ring-[#3713ec]/50 transition-all placeholder:text-slate-600"
                                />
                                <button className="absolute right-2 top-2 w-8 h-8 bg-[#3713ec] text-white rounded-xl flex items-center justify-center hover:bg-[#2500c4] transition-all">
                                    <span className="material-symbols-outlined text-sm">send</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
                        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#3713ec]">recommend</span>
                            Recommended
                        </h2>
                        <div className="space-y-6">
                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                                <span className="material-symbols-outlined text-[#3713ec] text-3xl mb-3">auto_awesome</span>
                                <p className="text-xs font-bold text-[#3713ec] uppercase tracking-widest">Generating suggestions</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
