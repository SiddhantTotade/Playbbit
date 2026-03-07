const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api";
const CHUNK_SIZE = 5 * 1024 * 1024;

export const uploadThumbnail = async (file: File, token: string): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload/thumbnail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload thumbnail: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.thumbnailUrl;
};

export const uploadResumableVideo = async (
  file: File,
  token: string,
  title: string,
  isPrivate: boolean,
  uploadId: string,
  onProgress: (percent: number) => void,
  thumbnailUrl?: string,
  description?: string,
) => {
  console.log(`Checking upload status at ${API_BASE}/upload/status...`);
  const statusRes = await fetch(
    `${API_BASE}/upload/status?uploadId=${uploadId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (!statusRes.ok) {
    throw new Error(`Failed to check upload status: ${statusRes.status} ${statusRes.statusText}`);
  }

  const { currentSize } = await statusRes.json();
  let offset = currentSize;

  // 2. Upload chunks
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const formData = new FormData();
    formData.append("chunk", chunk);
    formData.append("uploadId", uploadId);
    formData.append("fileName", file.name);
    formData.append("totalSize", file.size.toString());
    formData.append("title", title);
    formData.append("isPrivate", isPrivate.toString());
    if (thumbnailUrl) formData.append("thumbnailUrl", thumbnailUrl);
    if (description) formData.append("description", description);

    const res = await fetch(`${API_BASE}/upload/chunk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Chunk upload failed at offset ${offset}`);
    }

    const result = await res.text();
    offset += chunk.size;
    onProgress(Math.round((offset / file.size) * 100));

    if (result === "COMPLETE") {
      console.log("Upload finished, server is now transcoding...");
      break;
    }
  }
};

export const toggleVideoVisibility = async (id: string, token: string) => {
  const res = await fetch(`${API_BASE}/videos/${id}/visibility`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to toggle visibility: ${res.status} ${res.statusText}`);
  }

  return await res.json();
};

export const deleteVideo = async (id: string, token: string) => {
  const res = await fetch(`${API_BASE}/videos/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to delete video: ${res.status} ${res.statusText}`);
  }

  return true;
};
