"use client";

import React, { useRef, useState } from "react";
import Hls from "hls.js";

interface VideoCardProps {
  title: string;
  hlsUrl: string;
  thumbnail: string;
}

export const VideoCard = ({ title, hlsUrl, thumbnail }: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = () => {
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

        // Use the prop 'hlsUrl' directly (fixed "Cannot find name 'video'")
        hls.loadSource(hlsUrl);
        hls.attachMedia(videoElement);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch((err) => {
            console.warn("Autoplay blocked:", err);
          });
        });

        // Error handling for "Media not suitable" issues
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error("HLS fatal error:", data.type);
          }
        });
      } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        // Native support (Safari/iOS)
        videoElement.src = hlsUrl;
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
      className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 transition-all hover:scale-[1.02] hover:border-[#3713ec]/50 hover:shadow-2xl hover:shadow-[#3713ec]/10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-video w-full relative bg-black">
        <img
          src={thumbnail}
          alt={title}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isHovering ? "opacity-0" : "opacity-100"
          }`}
        />

        <video
          ref={videoRef}
          muted
          loop
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isHovering ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div className="p-3">
        <h3 className="text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#3713ec] to-purple-500" />
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            Playbbit Original
          </span>
        </div>
      </div>
    </div>
  );
};
