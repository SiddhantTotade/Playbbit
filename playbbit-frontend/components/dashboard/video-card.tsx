"use client";

import React, { useRef, useState } from "react";

interface VideoCardProps {
  title: string;
  hlsUrl: string; // The MinIO signed URL or stream endpoint
  thumbnail: string;
}

export const VideoCard = ({ title, hlsUrl, thumbnail }: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = () => {
    setIsHovering(true);
    videoRef.current
      ?.play()
      .catch((err) => console.log("Autoplay blocked", err));
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // Reset to start
    }
  };

  return (
    <div
      className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 transition-all hover:scale-[1.02] hover:border-[#3713ec]/50 hover:shadow-2xl hover:shadow-[#3713ec]/10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Container */}
      <div className="aspect-video w-full relative bg-black">
        {/* Placeholder Thumbnail */}
        {!isHovering && (
          <img
            src={thumbnail}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          />
        )}

        <video
          ref={videoRef}
          src={hlsUrl}
          muted
          loop
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-500 ${isHovering ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      {/* Info Section */}
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
