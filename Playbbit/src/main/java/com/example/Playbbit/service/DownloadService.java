package com.example.Playbbit.service;

import java.io.File;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.example.Playbbit.util.PathUtils;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class DownloadService {

    private final S3UploadService s3UploadService;
    private final JwtService jwtService;

    // Track processing status
    private final ConcurrentHashMap<String, String> processingStatus = new ConcurrentHashMap<>();

    public String getStatus(String id) {
        return processingStatus.getOrDefault(id, "NOT_FOUND");
    }

    @Async
    public void prepareDownloadAsync(String id, String userId, boolean isLiveStream) {
        if ("PROCESSING".equals(processingStatus.get(id))) {
            return;
        }

        processingStatus.put(id, "PROCESSING");
        log.info("Starting async MP4 generation for video/stream: {}", id);

        // Generate an internal token to bypass HLS proxy security
        String internalToken = jwtService.generateToken(userId, id);
        String proxyUrl = "http://localhost:8080/api/live/proxy/" + id + "/master.m3u8";
        String cookieHeader = "Cookie: stream_access_" + id + "=" + internalToken;

        String tempFilePath = "download_temp_" + id + ".mp4";
        File tempFile = new File(tempFilePath);

        try {
            // ffmpeg -headers "Cookie: xyz" -i "url" -c copy -bsf:a aac_adtstoasc output.mp4
            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-y",
                    "-headers", cookieHeader,
                    "-i", proxyUrl,
                    "-c", "copy",
                    "-bsf:a", "aac_adtstoasc",
                    tempFilePath
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("ffmpeg [download {}]: {}", id, line);
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0 && tempFile.exists()) {
                log.info("MP4 generation successful for {}", id);
                
                String rootFolder = isLiveStream ? PathUtils.LIVE_STREAMS_FOLDER : PathUtils.VIDEOS_FOLDER;
                String s3Key = PathUtils.getS3UploadPath(rootFolder, userId, id) + "/download.mp4";

                boolean uploaded = s3UploadService.uploadChunk(tempFile, s3Key);
                if (uploaded) {
                    log.info("Uploaded compiled MP4 to MinIO: {}", s3Key);
                    processingStatus.put(id, "READY");
                } else {
                    log.error("Failed to upload compiled MP4 to MinIO for {}", id);
                    processingStatus.put(id, "FAILED");
                }
            } else {
                log.error("FFMPEG failed for {}. Exit code: {}", id, exitCode);
                processingStatus.put(id, "FAILED");
            }
        } catch (Exception e) {
            log.error("Error during download preparation for {}: {}", id, e.getMessage(), e);
            processingStatus.put(id, "FAILED");
        } finally {
            if (tempFile.exists()) {
                tempFile.delete();
            }
        }
    }
}
