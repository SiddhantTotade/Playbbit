import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

import { getMediaUrl } from "@/lib/media-utils";

interface Props {
  src: string;
  poster?: string;
}

export default function VideoPlayer({ src, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [subTracks, setSubTracks] = useState<any[]>([]);
  const [currentAudio, setCurrentAudio] = useState(0);
  const [currentSub, setCurrentSub] = useState(-1); // -1 for off
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;
    if (!src) {
      console.warn("VideoPlayer: No source provided");
      return;
    }
    const fullSrc = getMediaUrl(src);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari/iOS)
      video.src = fullSrc;
    } else if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
      });

      hls.loadSource(fullSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("HLS Manifest Parsed - Source:", fullSrc);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        console.log("HLS Audio Tracks Updated:", data.audioTracks);
        setAudioTracks(data.audioTracks || []);
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
        console.log("HLS Subtitle Tracks Updated:", data.subtitleTracks);
        setSubTracks(data.subtitleTracks || []);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error("HLS fatal error:", data.type, data.details, "Source:", fullSrc);
        } else {
          console.warn("HLS non-fatal error:", data.details);
        }
      });

      setHlsInstance(hls);
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [src]);

  const switchAudio = (id: number) => {
    if (hlsInstance) {
      hlsInstance.audioTrack = id;
      setCurrentAudio(id);
    }
  };

  const switchSub = (id: number) => {
    if (hlsInstance) {
      hlsInstance.subtitleTrack = id;
      hlsInstance.subtitleDisplay = id !== -1;
      setCurrentSub(id);
    }
  };

  const switchSpeed = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  return (
    <div className="relative aspect-video w-full bg-black rounded-3xl overflow-hidden shadow-2xl group border border-white/5">
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        poster={getMediaUrl(poster)}
      />

      {/* Settings Menu (Speed, Language, Subtitles) */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-3 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-xl flex items-center gap-2 text-white transition-all border border-white/10 active:scale-95 cursor-pointer shadow-lg group/settings"
          title="Language & Subtitles"
        >
          <span className={`material-symbols-outlined transition-transform duration-500 ${showSettings ? 'rotate-90 text-[#3713ec]' : ''}`}>
            settings
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover/settings:opacity-100 transition-opacity">
            Language
          </span>
        </button>

        {showSettings && (
          <div className="absolute top-12 right-0 w-56 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/10 p-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden ring-1 ring-white/10">
            {/* Playback Speed */}
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">speed</span>
                Playback Speed
              </p>
              <div className="grid grid-cols-2 gap-1">
                {[0.5, 1, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => switchSpeed(speed)}
                    className={`flex items-center justify-center py-2 rounded-lg text-xs font-bold transition-all border ${playbackSpeed === speed
                      ? "bg-amber-500 border-amber-500 text-white"
                      : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                      } cursor-pointer`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Tracks */}
            {audioTracks.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#3713ec] mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">settings_voice</span>
                  Audio Language
                </p>
                <div className="space-y-1">
                  {audioTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => switchAudio(track.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentAudio === track.id
                        ? "bg-[#3713ec] text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                        } cursor-pointer`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="uppercase text-sm tracking-widest">
                          {track.lang ? track.lang.toUpperCase() : (track.name || `AUDIO ${track.id}`)}
                        </span>
                        {track.lang && track.name && track.name !== track.lang && (
                          <span className="text-[9px] opacity-70 font-medium">
                            {track.name}
                          </span>
                        )}
                      </div>
                      {currentAudio === track.id && (
                        <span className="material-symbols-outlined text-sm">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subtitle Tracks */}
            {subTracks.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">closed_caption</span>
                  Subtitles
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => switchSub(-1)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentSub === -1
                      ? "bg-pink-500 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                      } cursor-pointer`}
                  >
                    Off
                    {currentSub === -1 && (
                      <span className="material-symbols-outlined text-sm">check</span>
                    )}
                  </button>
                  {subTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => switchSub(track.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentSub === track.id
                        ? "bg-pink-500 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                        } cursor-pointer`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="capitalize">{track.name || track.lang || `Track ${track.id}`}</span>
                        {track.lang && track.lang !== track.name && (
                          <span className="text-[8px] opacity-60 uppercase">{track.lang}</span>
                        )}
                      </div>
                      {currentSub === track.id && (
                        <span className="material-symbols-outlined text-sm">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
