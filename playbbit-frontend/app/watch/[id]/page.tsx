"use client";
import { useEffect, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";

export default function WatchPage({ params }: { params: { id: string } }) {
  const [video, setVideo] = useState<any>(null);
  const MINIO_BASE_URL = "http://localhost:9000/playbbit-bucket";

  useEffect(() => {
    fetch(`http://localhost:8080/api/videos/${params.id}`)
      .then((res) => res.json())
      .then((data) => setVideo(data));
  }, [params.id]);

  if (!video) return <div className="p-20 text-center">Loading Video...</div>;

  const fullHlsUrl = `${MINIO_BASE_URL}${video.hlsUrl}`;

  return (
    <main className="max-w-6xl mx-auto p-6 lg:p-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <VideoPlayer src={fullHlsUrl} />

          <div className="mt-6">
            <h1 className="text-2xl font-bold text-white">{video.title}</h1>
            <div className="flex items-center justify-between mt-4 pb-6 border-b border-zinc-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center font-bold">
                  {video.userId.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">
                    User {video.userId.substring(0, 8)}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Published on{" "}
                    {new Date(video.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-6 text-zinc-300">
              {video.description || "No description provided."}
            </p>
          </div>
        </div>

        <div className="hidden lg:block">
          <h2 className="font-bold mb-4">Up Next</h2>
          <div className="space-y-4 text-sm text-zinc-500 italic">
            Recommendations appearing soon...
          </div>
        </div>
      </div>
    </main>
  );
}
