"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8080/api/videos/public")
      .then((res) => res.json())
      .then((data) => setVideos(data));
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold mb-8">Feed</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {videos.map((video: any) => (
          <Link href={`/watch/${video.id}`} key={video.id} className="group">
            <div className="aspect-video bg-zinc-800 rounded-xl mb-3 overflow-hidden border border-zinc-700">
              {/* Later we can add thumbnails here */}
              <div className="flex items-center justify-center h-full text-zinc-500 italic">
                Preview
              </div>
            </div>
            <h3 className="font-semibold text-lg line-clamp-2">
              {video.title}
            </h3>
            <p className="text-sm text-zinc-400">Uploaded by {video.userId}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
