"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";

export default function UploadPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const chunkSize = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = crypto.randomUUID();

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      await uploadChunk(chunk, i, uploadId, file.name);
    }
  };

  const uploadChunk = async (
    chunk: Blob,
    index: number,
    id: string,
    fileName: string,
  ) => {
    const formData = new FormData();
    formData.append("file", chunk);
    formData.append("chunkIndex", index.toString());
    formData.append("uploadId", id);
    formData.append("fileName", fileName);

    const response = await fetch("http://localhost:8080/api/upload/chunk", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.accessToken}`,
      },
      body: formData,
    });

    if (response.status === 401) {
      setStatus("Error: Session expired. Please login again.");
      return;
    }

    if (response.ok) {
      setStatus(`Uploading chunk ${index + 1} of...`);
    }
  };

  return (
    <div className="p-10">
      <input type="file" onChange={handleFileChange} />
      <p>{status}</p>
    </div>
  );
}
