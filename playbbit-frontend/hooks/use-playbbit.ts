"use client";

import { useState, useCallback } from "react";
import { useAuthContext } from "@/context/auth-context";

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export interface PlaybbitVideo {
  id: string;
  title: string;
  hlsUrl: string;
  status: string;
}

export function usePlaybbit() {
  const { token } = useAuthContext();

  const [videos, setVideos] = useState<PlaybbitVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchPublicVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/videos/public`);
      if (!response.ok) throw new Error("Failed to fetch videos");
      const data = await response.json();
      setVideos(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadVideo = async (file: File, title: string, isPrivate: boolean) => {
    setLoading(true);
    setUploadProgress(0);
    setError(null);

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("visibility", isPrivate ? "PRIVATE" : "PUBLIC");

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percent);
        }
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setLoading(false);
          resolve(JSON.parse(xhr.response));
        } else {
          setLoading(false);
          reject(new Error("Upload failed with status " + xhr.status));
        }
      };

      xhr.onerror = () => {
        setLoading(false);
        reject(new Error("Network error during upload"));
      };

      xhr.open("POST", `${API_URL}/api/videos/upload`);

      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.send(formData);
    });
  };

  return {
    videos,
    loading,
    uploadProgress,
    error,
    fetchPublicVideos,
    uploadVideo,
  };
}
