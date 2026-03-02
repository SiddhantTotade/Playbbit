package com.example.Playbbit.service;

import java.io.File;
import java.time.LocalDateTime;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.example.Playbbit.entity.Video;
import com.example.Playbbit.repository.VideoRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
@RequiredArgsConstructor
public class TranscodingService {

    private final S3UploadService s3UploadService;
    private final SimpMessagingTemplate messagingTemplate;
    private final VideoRepository videoRepository; // Injected
    private static final String HLS_OUTPUT_DIR = "hls-output/";

    @Async
    // 1. ADD: title and isPrivate to the parameters
    public void processUploadAsync(File inputFile, String originalName, String uploadId, String userId, String title,
            boolean isPrivate) {
        String topic = "/topic/upload/" + uploadId;

        try {
            // 2. CREATE: Initial Database Record as "TRANSCODING"
            Video video = Video.builder()
                    .id(uploadId)
                    .title(title)
                    .userId(userId)
                    .isPrivate(isPrivate)
                    .status(Video.VideoStatus.TRANSCODING)
                    .createdAt(LocalDateTime.now())
                    .build();
            videoRepository.save(video);

            log.info("Starting HLS Transcoding for: {}", title);
            messagingTemplate.convertAndSend(topic, "Transcoding Start");

            File outputFolder = new File(HLS_OUTPUT_DIR + uploadId);
            if (!outputFolder.exists())
                outputFolder.mkdirs();

            String m3u8Path = outputFolder.getAbsolutePath() + "/index.m3u8";
            String segmentPath = outputFolder.getAbsolutePath() + "/file%03d.ts";

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-i", inputFile.getAbsolutePath(),
                    "-c:v", "libx264", "-preset", "veryfast",
                    "-c:a", "aac",
                    "-hls_time", "6",
                    "-hls_list_size", "0",
                    "-f", "hls",
                    "-hls_segment_filename", segmentPath,
                    m3u8Path);

            pb.redirectErrorStream(true);
            Process process = pb.start();
            process.waitFor();

            if (process.exitValue() == 0) {
                log.info("Transcoding successful! Now uploading to MinIO...");
                messagingTemplate.convertAndSend(topic, "Uploading to MinIO...");

                File[] files = outputFolder.listFiles();
                if (files != null) {
                    for (File f : files) {
                        // The path in MinIO
                        String minioPath = "uploads/" + userId + "/" + uploadId + "/" + f.getName();
                        s3UploadService.uploadChunk(f, minioPath);
                    }
                }

                // 3. UPDATE: Database to "PUBLISHED" and save the MinIO URL
                video.setStatus(Video.VideoStatus.PUBLISHED);
                // This URL will be used by the frontend HLS player
                video.setHlsUrl("/uploads/" + userId + "/" + uploadId + "/index.m3u8");
                videoRepository.save(video);

                cleanup(outputFolder, inputFile);
                log.info("Cleanup complete for uploadId: {}", uploadId);

                messagingTemplate.convertAndSend(topic, "Completed");
            } else {
                video.setStatus(Video.VideoStatus.FAILED);
                videoRepository.save(video);
                messagingTemplate.convertAndSend(topic, "Transcoding Failed");
            }

        } catch (Exception e) {
            log.error("Error during transcoding or MinIO upload", e);
            messagingTemplate.convertAndSend(topic, "Error: " + e.getMessage());
        }
    }

    private void cleanup(File folder, File originalFile) {
        File[] files = folder.listFiles();
        if (files != null) {
            for (File f : files)
                f.delete();
        }
        folder.delete();
        originalFile.delete();
    }
}