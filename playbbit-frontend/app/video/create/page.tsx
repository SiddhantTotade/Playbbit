"use client";

import { useState } from "react";
import { usePlaybbit } from "@/hooks/use-playbbit";
import { useRouter } from "next/navigation";

export default function CreateVideoPage() {
  const { uploadVideo, uploadProgress, loading } = usePlaybbit();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const router = useRouter();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    try {
      await uploadVideo(file, title, false);
      alert("Upload successful! Transcoding started.");
      router.push("/dashboard");
    } catch (err) {
      alert("Upload failed.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">Upload New Video</h1>

      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Video Title</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="border-2 border-dashed border-gray-300 p-10 text-center rounded-lg">
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="video-input"
          />
          <label
            htmlFor="video-input"
            className="cursor-pointer text-blue-600 hover:underline"
          >
            {file ? file.name : "Click to select a video file"}
          </label>
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-[#3713ec] h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file}
          className="w-full bg-[#3713ec] text-white py-2 rounded-lg font-semibold disabled:bg-gray-400"
        >
          {loading ? "Processing..." : "Start Upload"}
        </button>
      </form>
    </div>
  );
}
