"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { uploadResumableVideo, uploadThumbnail } from "@/lib/upload-service";

import { MainLayout } from "@/components/layout/main-layout";

export default function CreateVideoPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8082/api";
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [isError, setIsError] = useState(false);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setThumbnail(selected);
    if (selected) {
      const reader = new FileReader();
      reader.onloadend = () => setThumbnailPreview(reader.result as string);
      reader.readAsDataURL(selected);
    } else {
      setThumbnailPreview(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setStatusMsg("Please select a video file first");
      setIsError(true);
      return;
    }

    const token = (session as any)?.accessToken;
    if (!token) {
      setStatusMsg("You must be logged in to upload");
      setIsError(true);
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setIsError(false);

    try {
      let thumbnailUrl = "";
      if (thumbnail) {
        setStatusMsg("Uploading thumbnail...");
        thumbnailUrl = await uploadThumbnail(thumbnail, token);
      }

      const uploadId = crypto.randomUUID();
      setStatusMsg("Starting video upload...");

      await uploadResumableVideo(
        file,
        token,
        title,
        isPrivate,
        uploadId,
        (percent) => {
          setUploadProgress(percent);
          if (percent < 100) {
            setStatusMsg(`Uploading video... ${percent}%`);
          } else {
            setStatusMsg("Upload successful! Your video is now being transcoded.");
          }
        },
        thumbnailUrl,
        description
      );

      // Start polling for transcoding status instead of immediate redirect
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/videos/${uploadId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            const video = await res.json();
            console.log("Polling status:", video.status);

            if (video.status === "TRANSCODING") {
              setStatusMsg("Transcoding started in HLS... (Step 1/2)");
            } else if (video.status === "PUBLISHED") {
              setStatusMsg("Creating chunks & finalizing... (Almost done!)");

              // Give it 3 seconds to show the final message then redirect
              clearInterval(pollInterval);
              setTimeout(() => {
                setStatusMsg("Done! Redirecting to feed...");
                setTimeout(() => router.push("/"), 2000);
              }, 3000);
            } else if (video.status === "FAILED") {
              setStatusMsg("Transcoding failed. Please check your video format.");
              setIsError(true);
              setLoading(false);
              clearInterval(pollInterval);
            }
          }
        } catch (err) {
          console.error("Status polling error:", err);
        }
      }, 3000);

    } catch (err) {
      console.error("Upload failed:", err);
      setStatusMsg("Upload failed. You can try again to resume.");
      setIsError(true);
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">
            Upload <span className="text-[#3713ec]">.</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Share your story with the world. High quality transcoding, worldwide delivery.
          </p>
        </div>

        <form onSubmit={handleUpload} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Video Upload Area */}
            <div className={`relative group border-2 border-dashed rounded-3xl p-12 transition-all duration-500 overflow-hidden ${file
              ? "border-[#3713ec]/50 bg-[#3713ec]/5"
              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
              }`}>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] || null;
                  setFile(selectedFile);
                  if (selectedFile && !title)
                    setTitle(selectedFile.name.split(".")[0]);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer z-20"
                id="video-input"
                disabled={loading}
              />

              <div className="flex flex-col items-center justify-center text-center relative z-10">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${file ? "bg-[#3713ec] shadow-[0_0_30px_rgba(55,19,236,0.4)]" : "bg-white/5 group-hover:bg-white/10"
                  }`}>
                  <span className={`material-symbols-outlined text-4xl transition-colors duration-500 ${file ? "text-white" : "text-slate-400 group-hover:text-white"
                    }`}>
                    {file ? "check_circle" : "video_library"}
                  </span>
                </div>

                {file ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2">
                    <h3 className="text-xl font-bold text-white mb-1">File Selected</h3>
                    <p className="text-[#3713ec] text-sm font-medium">Ready to hop!</p>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-bold text-white mb-2">Select Video File</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                      Drag and drop your video here, or click to browse. MP4, MKV or AVI supported.
                    </p>
                  </>
                )}
              </div>

              {/* Decorative background glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#3713ec]/5 blur-[80px] rounded-full pointer-events-none" />
            </div>

            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3713ec]">description</span>
                Video Details
              </h3>

              <div className="space-y-4">
                {file && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Selected File</label>
                    <div className="w-full bg-black/20 border border-white/5 rounded-2xl px-5 py-3 text-slate-400 text-sm font-mono break-all line-clamp-2">
                      {file.name}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Title</label>
                  <input
                    type="text"
                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-[#3713ec]/50 outline-none transition-all"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your video a catchy title..."
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea
                    className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-[#3713ec]/50 outline-none transition-all min-h-[120px] resize-none"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell your viewers more about this video..."
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-[#3713ec]/30 transition-all cursor-pointer group" onClick={() => setIsPrivate(!isPrivate)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPrivate ? "bg-amber-500/10 text-amber-500" : "bg-[#3713ec]/10 text-[#3713ec]"
                    }`}>
                    <span className="material-symbols-outlined text-[20px]">
                      {isPrivate ? "lock" : "public"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{isPrivate ? "Private Video" : "Public Video"}</p>
                    <p className="text-[11px] text-slate-500">
                      {isPrivate ? "Only you can see this video." : "Everyone on Playbbit can discover and watch."}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isPrivate ? "border-amber-500 bg-amber-500" : "border-white/10"
                    }`}>
                    {isPrivate && <span className="material-symbols-outlined text-[12px] text-black font-bold">check</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 space-y-6 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3713ec]">image</span>
                Thumbnail
              </h3>

              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/40 border border-white/5 group">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Preview" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-slate-500">add_photo_alternate</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">No thumbnail selected.<br />We'll pick a frame if you skip this.</p>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  id="thumbnail-input"
                  disabled={loading}
                />

                <div className="absolute inset-0 bg-[#3713ec]/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center pointer-events-none">
                  <div className="bg-white text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider scale-90 group-hover:scale-100 transition-transform">
                    {thumbnail ? "Change Image" : "Select Image"}
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed italic">
                Pro Tip: A custom thumbnail can increase your views by hopping-huge amounts!
              </p>
            </div>

            <div className="space-y-4">
              {statusMsg && (
                <div className={`p-5 rounded-[2rem] text-xs font-bold flex items-center gap-4 animate-in slide-in-from-right-4 duration-500 ${isError
                  ? "bg-red-500/10 text-red-400 border border-red-500/10"
                  : "bg-[#3713ec]/10 text-slate-200 border border-[#3713ec]/10"
                  }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isError ? "bg-red-500/20" : "bg-[#3713ec]/20"
                    }`}>
                    {loading && !isError ? (
                      <div className="w-4 h-4 border-2 border-[#3713ec] border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">
                        {isError ? "error" : "info"}
                      </span>
                    )}
                  </div>
                  {statusMsg}
                </div>
              )}

              {loading && (
                <div className="px-2">
                  <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#3713ec] to-[#ff69b4] h-full rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(55,19,236,0.6)]"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !file}
                className="w-full group relative overflow-hidden bg-[#3713ec] text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-[#3713ec]/30 hover:shadow-[#3713ec]/50 transition-all active:scale-[0.97] disabled:bg-white/5 disabled:text-slate-600 disabled:shadow-none"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? "Processing..." : "Publish Video"}
                  {!loading && <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">bolt</span>}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
