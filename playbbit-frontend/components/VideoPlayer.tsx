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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localSubs, setLocalSubs] = useState<any[]>([]);

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

  const srtToVtt = (content: string) => {
    let vtt = "WEBVTT\n\n" + content
      .replace(/\r/g, "")
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    return vtt;
  };

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let content = event.target?.result as string;
      if (file.name.toLowerCase().endsWith('.srt')) {
        content = srtToVtt(content);
      }

      const blob = new Blob([content], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      const newTrack = {
        id: subTracks.length + localSubs.length + 1000,
        name: file.name,
        lang: "External",
        url: url,
        isLocal: true
      };

      setLocalSubs([...localSubs, newTrack]);
      // Automatically switch to the new track
      setTimeout(() => switchSub(newTrack.id), 200);
    };
    reader.readAsText(file);
  };

  const switchSub = (id: number) => {
    const allSubs = [...subTracks, ...localSubs];
    const track = allSubs.find(t => t.id === id);

    if (hlsInstance) {
      if (id === -1) {
        hlsInstance.subtitleDisplay = false;
      } else if (track && !track.isLocal) {
        hlsInstance.subtitleTrack = id;
        hlsInstance.subtitleDisplay = true;
      } else {
        hlsInstance.subtitleDisplay = false;
      }
    }

    if (videoRef.current) {
      const video = videoRef.current;
      Array.from(video.textTracks).forEach(tt => tt.mode = 'disabled');

      if (track?.isLocal) {
        let trackElements = Array.from(video.querySelectorAll('track'));
        let trackElement = trackElements.find(t => t.src === track.url) as HTMLTrackElement;

        if (!trackElement) {
          trackElement = document.createElement('track');
          trackElement.kind = 'subtitles';
          trackElement.label = track.name;
          trackElement.srclang = 'en'; // Provide valid lang code
          trackElement.src = track.url;
          trackElement.default = true;
          video.appendChild(trackElement);
        }

        // Allow time for track to attach to textTracks before showing
        setTimeout(() => {
          const textTrack = Array.from(video.textTracks).find(tt => tt.label === track.name);
          if (textTrack) textTrack.mode = 'showing';
        }, 100);
      }
    }
    setCurrentSub(id);
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
      <div className="absolute top-4 right-4 bottom-16 z-50 flex flex-col items-end pointer-events-none">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="pointer-events-auto shrink-0 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-xl flex items-center justify-center text-white transition-all border border-white/10 active:scale-95 cursor-pointer shadow-lg group/settings"
          title="Settings"
        >
          <span className={`material-symbols-outlined transition-transform duration-500 ${showSettings ? 'rotate-90 text-[#3713ec]' : ''}`}>
            settings
          </span>
        </button>

        {showSettings && (
          <div className="pointer-events-auto mt-2 w-64 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/10 p-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col min-h-0 ring-1 ring-white/10">
            <div className="overflow-y-auto pr-2 custom-scrollbar space-y-4">
              {/* Playback Speed */}
              <div>
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
                <div>
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
                        <div className="flex flex-col items-start px-2">
                          <span className="uppercase text-sm tracking-[0.2em]">
                            {track.lang ? track.lang.toUpperCase() : `AUD ${track.id}`}
                          </span>
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
              <div className="border-t border-white/5 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-pink-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">closed_caption</span>
                    Subtitles
                  </p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleSubtitleUpload}
                    accept=".vtt,.srt"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md text-[9px] font-bold text-slate-300 transition-all border border-white/5 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[10px]">add</span>
                    LOAD
                  </button>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => switchSub(-1)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentSub === -1
                      ? "bg-pink-500 text-white"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                      } cursor-pointer`}
                  >
                    OFF
                    {currentSub === -1 && (
                      <span className="material-symbols-outlined text-sm">check</span>
                    )}
                  </button>
                  {[...subTracks, ...localSubs].map((track) => (
                    <button
                      key={`${track.isLocal ? 'local-' : 'manifest-'}${track.id}`}
                      onClick={() => switchSub(track.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentSub === track.id
                        ? "bg-pink-500 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                        } cursor-pointer`}
                    >
                      <div className="flex flex-col items-start">
                        <span className="uppercase tracking-wider">{track.lang || 'SUB'}</span>
                        <span className="text-[9px] opacity-60 truncate max-w-[120px]">{track.name || `Track ${track.id}`}</span>
                      </div>
                      {currentSub === track.id && (
                        <span className="material-symbols-outlined text-sm">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
