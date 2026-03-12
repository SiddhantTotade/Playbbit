import { useEffect, useState } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export const useUploadStatus = (uploadId: string | null) => {
  const [status, setStatus] = useState<string>("Waiting...");

  useEffect(() => {
    if (!uploadId) return;

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8082/api";
    const socket = new SockJS("http://localhost:8082/ws-video-status");
    const client = new Client({
      webSocketFactory: () => socket,
      debug: (str) => console.log(str),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log("Connected to WebSocket");

        client.subscribe(`/topic/upload/${uploadId}`, (message) => {
          if (message.body) {
            setStatus(message.body);
          }
        });
      },
      onStompError: (frame) => {
        console.error("Broker reported error: " + frame.headers["message"]);
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [uploadId]);

  return status;
};
