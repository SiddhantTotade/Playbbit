"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import { getMediaUrl } from "@/lib/media-utils";
import { useSession } from "next-auth/react";
import { toggleVideoVisibility, deleteVideo } from "@/lib/upload-service";

interface VideoCardProps {
  id: string;
  title: string;
  hlsUrl: string;
  thumbnail: string;
  isPrivate?: boolean;
  isOwner?: boolean;
  status?: string;
  onDeleted?: () => void;
}

export const VideoCard = ({ id, title, hlsUrl, thumbnail, isPrivate: initialIsPrivate, isOwner, status, onDeleted }: VideoCardProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const [isPrivate, setIsPrivate] = useState(initialIsPrivate || false);
  const [isToggling, setIsToggling] = useState(false);

  // Sync state if props change (e.g. after re-fetch)
  React.useEffect(() => {
    setIsPrivate(initialIsPrivate || false);
  }, [initialIsPrivate]);

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevents navigating to watch page
    console.log(`VideoCard: Toggling visibility for ${id}. Current status: ${isPrivate}`);

    if (isToggling || !session) {
      console.warn("VideoCard: Toggle blocked (toggling in progress or no session)");
      return;
    }

    try {
      setIsToggling(true);
      const token = (session as any)?.accessToken;
      if (!token) throw new Error("No access token found");

      console.log("VideoCard: Calling API...");
      const updatedVideo = await toggleVideoVisibility(id, token);
      console.log("VideoCard: API Response (Stringified):", JSON.stringify(updatedVideo));

      // Try both isPrivate and privateVideo just in case of serialization edge cases
      const newStatus = updatedVideo.isPrivate ?? updatedVideo.privateVideo ?? updatedVideo.private;

      setIsPrivate(newStatus);
      console.log(`VideoCard: New status set to ${newStatus}`);
    } catch (err: any) {
      console.error("VideoCard: Failed to toggle visibility:", err);
      alert(`Failed to change visibility: ${err.message}`);
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) return;
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone and will remove all associated files.`)) {
      return;
    }

    try {
      setIsToggling(true);
      const token = (session as any)?.accessToken;
      if (!token) throw new Error("No access token found");

      await deleteVideo(id, token);
      console.log(`VideoCard: Deleted ${id}`);
      if (onDeleted) {
        onDeleted();
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      console.error("VideoCard: Failed to delete video:", err);
      alert(`Failed to delete video: ${err.message}`);
    } finally {
      setIsToggling(false);
    }
  };

  const handleMouseEnter = () => {
    const isProcessing = status === "TRANSCODING" || status === "PENDING" || status === "FAILED";
    if (isProcessing) return;

    setIsHovering(true);

    if (videoRef.current) {
      const videoElement = videoRef.current;
      videoElement.muted = true;

      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        const hls = new Hls();
        hlsRef.current = hls;

        hls.loadSource(getMediaUrl(hlsUrl));
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch((err) => {
            console.warn("Autoplay blocked:", err);
          });
        });

        // Error handling for "Media not suitable" issues
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error("HLS fatal error:", data.type, data.details);
            // Optional: try to recover if it's a network error but here we just log details
          }
        });
      } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        // Native support (Safari/iOS)
        videoElement.src = getMediaUrl(hlsUrl);
        videoElement.play().catch((e) => console.warn(e));
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  return (
    <div
      className={`group relative bg-[#0f0f12] rounded-[2rem] overflow-hidden border-2 transition-colors duration-300 cursor-pointer shadow-2xl ${isToggling ? "opacity-60 pointer-events-none" : ""
        } ${isPrivate
          ? "border-amber-500/40 shadow-amber-500/10 ring-4 ring-amber-500/5"
          : "border-white/5 hover:border-[#3713ec]/40 hover:shadow-[#3713ec]/20"
        }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => router.push(`/watch/${id}`)}
    >
      <div className="aspect-video w-full relative bg-black overflow-hidden">
        {/* Privacy Label (More Prominent) */}


        {/* Private Overlay Tint */}
        {isPrivate && (
          <div className="absolute inset-0 z-20 bg-amber-900/10 mix-blend-overlay pointer-events-none" />
        )}

        {/* Processing/Failed Badge */}
        {(status === "TRANSCODING" || status === "PENDING" || status === "FAILED") && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center">
            {status === "FAILED" ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-3 border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <span className="material-symbols-outlined text-red-500 text-2xl">error</span>
                </div>
                <p className="text-white text-sm font-black uppercase tracking-widest">Failed</p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Transcoding Error</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-[#3713ec]/20 flex items-center justify-center mb-3 border border-[#3713ec]/30 shadow-[0_0_20px_rgba(55,19,236,0.3)] animate-pulse">
                  <span className="material-symbols-outlined text-[#3713ec] text-2xl animate-spin-slow">settings</span>
                </div>
                <p className="text-white text-sm font-black uppercase tracking-widest animate-pulse">Processing</p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Transcoding to HLS...</p>
              </>
            )}
          </div>
        )}

        {/* Owned Actions (Lock & Delete) */}
        {isOwner && (
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
            <button
              type="button"
              className={`w-8 h-8 backdrop-blur-md rounded-xl flex items-center justify-center transition-all group/btn shadow-xl border border-white/10 ${isPrivate ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-500" : "bg-white/10 hover:bg-white/20 text-white"
                }`}
              onClick={handleToggleVisibility}
              disabled={isToggling}
              title={isPrivate ? "Make Public" : "Make Private"}>
              <span className={`material-symbols-outlined text-lg ${isPrivate ? "text-amber-500" : "text-white group-hover/btn:text-[#3713ec]"}`}>
                {isPrivate ? "lock" : "lock_open"}
              </span>
            </button>

            <button
              type="button"
              className="w-8 h-8 bg-black/40 hover:bg-red-500/20 backdrop-blur-md rounded-xl flex items-center justify-center transition-all group/del shadow-xl border border-white/10 text-slate-400 hover:text-red-500"
              onClick={handleDelete}
              disabled={isToggling}
              title="Delete Video">
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        )}

        <img
          src={getMediaUrl(thumbnail)}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover ${isHovering ? "opacity-0" : "opacity-100"
            }`}
        />

        <video
          ref={videoRef}
          muted
          loop
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${isHovering ? "opacity-100" : "opacity-0"
            }`}
        />
      </div>

      <div className="p-4 bg-gradient-to-b from-transparent to-black/20">
        <h3 className="text-base font-bold text-slate-100 truncate group-hover:text-white transition-colors mb-2">
          {title}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg bg-gradient-to-tr flex items-center justify-center ${isPrivate ? "from-amber-500 to-orange-600" : "from-[#3713ec] to-purple-600"}`}>
              <span className="material-symbols-outlined text-[12px] text-white">play_arrow</span>
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest truncate max-w-[100px]">
              {isOwner ? "Your Video" : "Community"}
            </span>
          </div>

          <div className="flex -space-x-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full border-2 border-[#0a0a0c] bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
