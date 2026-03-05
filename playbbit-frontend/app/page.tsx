"use client";

import { useEffect } from "react";
import { usePlaybbit } from "@/hooks/use-playbbit";
import { VideoCard } from "@/components/dashboard/video-card";
import { ProtectedRoute } from "@/components/auth/protected-route";

export default function DashboardPage() {
  const { videos, loading, error, fetchPublicVideos } = usePlaybbit();

  useEffect(() => {
    fetchPublicVideos();
  }, [fetchPublicVideos]);

  return (
    <ProtectedRoute>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Explore Videos</h1>

        {loading && (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#3713ec]"></div>
          </div>
        )}

        {error && <p className="text-red-500">Error: {error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              title={video.title}
              hlsUrl={video.hlsUrl} // The URL saved by your Java TranscodingService
              thumbnail="https://picsum.photos/seed/playbbit/400/225"
            />
          ))}
        </div>
      </div>
    </ProtectedRoute>
  );
}
