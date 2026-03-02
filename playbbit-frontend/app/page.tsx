"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8080/api/videos/public")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setVideos(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch Error:", err.message);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="p-10 text-zinc-500">Loading your feed...</div>;

  return (
    <main className="min-h-screen bg-black text-white p-6 lg:p-12">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight">
          Browse Videos
        </h1>
        <p className="text-zinc-400 mt-2">
          Check out the latest community uploads.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {videos.map((video: any) => (
          <Link href={`/watch/${video.id}`} key={video.id} className="group">
            <div className="relative aspect-video w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 group-hover:border-red-600 transition-all duration-300">
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 p-3 rounded-full shadow-lg">
                  <PlayIcon />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center font-bold text-zinc-400">
                {video.userId.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold leading-tight group-hover:text-red-500 transition-colors line-clamp-2">
                  {video.title}
                </h3>
                <p className="text-sm text-zinc-500 mt-1">
                  User {video.userId.substring(0, 8)}
                </p>
                <p className="text-xs text-zinc-600">
                  {new Date(video.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
