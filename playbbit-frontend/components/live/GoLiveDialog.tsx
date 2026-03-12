"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function GoLiveDialog() {
    const router = useRouter();
    const { data: session } = useSession();

    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
    const [accessPin, setAccessPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [rtmpUrl, setRtmpUrl] = useState<string | null>(null);
    const [streamId, setStreamId] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return setError("Title is required");
        if (visibility === "PRIVATE" && accessPin.length !== 6) return setError("Private streams require a 6-digit PIN");

        const token = (session as any)?.accessToken;
        if (!token) {
            return setError("You must be logged in to create a stream.");
        }

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8082/api'}/live/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title, visibility, accessPin }),
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error("You must be logged in to create a stream.");
                throw new Error("Failed to create stream");
            }

            const data = await res.json();
            setGeneratedKey(data.streamKey);
            setRtmpUrl(data.rtmpUrl);
            setStreamId(data.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string, type: 'url' | 'key') => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'url') {
                setCopiedUrl(true);
                setTimeout(() => setCopiedUrl(false), 2000);
            } else {
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
            }
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        // Reset form on close
        setTimeout(() => {
            setTitle("");
            setVisibility("PUBLIC");
            setAccessPin("");
            setGeneratedKey(null);
            setRtmpUrl(null);
            setStreamId(null);
            setError(null);
        }, 300);
    };

    return (
        <>
            <Button
                onClick={() => setIsOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center gap-2 rounded-xl py-2 px-4 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
            >
                <span className="material-symbols-outlined text-sm">sensors</span>
                Go Live
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-lg bg-[#121214] border border-white/10 rounded-3xl shadow-2xl p-6 md:p-8 animate-in zoom-in-95 duration-300">

                        <button
                            onClick={handleClose}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors h-8 w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>

                        {!generatedKey ? (
                            <>
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="material-symbols-outlined text-[#3713ec] text-3xl">sensors</span>
                                    <h2 className="text-2xl font-black text-white tracking-tight">Go Live Settings</h2>
                                </div>

                                <p className="text-slate-400 text-sm mb-6">Set up your live stream and generate a secure RMTP stream key for OBS.</p>

                                <form onSubmit={handleCreate} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-300">Stream Title</label>
                                        <Input
                                            type="text"
                                            placeholder="My Awesome Live Stream"
                                            className="bg-black/50 border-white/10 text-white rounded-xl h-11"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-300">Visibility</label>
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setVisibility("PUBLIC")}
                                                className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${visibility === "PUBLIC"
                                                    ? "bg-[#3713ec]/20 border-[#3713ec] text-white"
                                                    : "bg-black/40 border-white/5 text-slate-400 hover:bg-white/5"
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-lg">public</span>
                                                Public
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setVisibility("PRIVATE");
                                                    setAccessPin("");
                                                }}
                                                className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all ${visibility === "PRIVATE"
                                                    ? "bg-amber-500/20 border-amber-500 text-amber-500"
                                                    : "bg-black/40 border-white/5 text-slate-400 hover:bg-white/5"
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-lg">lock</span>
                                                Private
                                            </button>
                                        </div>
                                    </div>

                                    {visibility === "PRIVATE" && (
                                        <div className="space-y-2 animate-in slide-in-from-top-4 fade-in duration-300">
                                            <label className="text-sm font-bold text-amber-500">Access PIN (6 Digits)</label>
                                            <Input
                                                type="text"
                                                maxLength={6}
                                                placeholder="••••••"
                                                className="bg-black/50 border-white/10 text-white rounded-xl h-11 font-mono tracking-widest text-lg"
                                                value={accessPin}
                                                onChange={(e) => setAccessPin(e.target.value.replace(/[^0-9]/g, ''))}
                                            />
                                            <p className="text-xs text-slate-500">Viewers will need this code to watch your stream.</p>
                                        </div>
                                    )}

                                    {error && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-xl">
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        disabled={loading || !title.trim() || (visibility === "PRIVATE" && accessPin.length !== 6)}
                                        className="w-full h-11 bg-[#3713ec] hover:bg-[#2500c4] text-white font-bold rounded-xl mt-4"
                                    >
                                        {loading ? "Generating..." : "Generate Stream Key"}
                                    </Button>
                                </form>
                            </>
                        ) : (
                            <div className="space-y-6 pt-4">
                                <div className="text-center">
                                    <div className="w-14 h-14 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-white mb-2">Ready to Stream!</h2>
                                    <p className="text-slate-400 text-sm">Your stream is created. Copy these details into OBS Studio.</p>
                                </div>

                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-300">Server URL</label>
                                        <div className="flex gap-2">
                                            <code className="flex-1 bg-black/60 border border-white/10 rounded-xl p-3 text-slate-300 font-mono text-sm break-all">
                                                {rtmpUrl}
                                            </code>
                                            <Button
                                                onClick={() => rtmpUrl && copyToClipboard(rtmpUrl, 'url')}
                                                className="h-auto bg-white/10 hover:bg-white/20 text-white"
                                            >
                                                <span className="material-symbols-outlined text-sm">
                                                    {copiedUrl ? 'check' : 'content_copy'}
                                                </span>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-amber-500">Stream Key (Keep Secret!)</label>
                                        <div className="flex gap-2">
                                            <code className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-500 font-mono text-sm break-all font-bold tracking-wider">
                                                {generatedKey}
                                            </code>
                                            <Button
                                                onClick={() => generatedKey && copyToClipboard(generatedKey, 'key')}
                                                className="h-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-500"
                                            >
                                                <span className="material-symbols-outlined text-sm">
                                                    {copiedKey ? 'check' : 'content_copy'}
                                                </span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
                                    <Button
                                        className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                                        onClick={() => streamId && router.push(`/live/${streamId}`)}
                                    >
                                        <span className="material-symbols-outlined">visibility</span>
                                        Go to Watch Page
                                    </Button>
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5" onClick={() => setGeneratedKey(null)}>
                                            Create Another
                                        </Button>
                                        <Button className="flex-1 bg-[#3713ec] hover:bg-[#2500c4] text-white" onClick={handleClose}>
                                            Done
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
