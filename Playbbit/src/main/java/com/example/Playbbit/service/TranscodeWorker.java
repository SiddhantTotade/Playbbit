package com.example.Playbbit.service;

import java.io.File;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.example.Playbbit.config.MinioProperties;
import com.example.Playbbit.util.PathUtils;

@Service
@RequiredArgsConstructor
@Slf4j
public class TranscodeWorker {
    private final StringRedisTemplate redisTemplate;
    private final S3UploadService s3UploadService;
    private final MinioProperties minioProperties;

    @Value("${app.stream.ingest-base-url}")
    private String ingestBaseUrl;

    @Scheduled(fixedDelay = 1000)
    public void pollJobs() {
        String jobJson = redisTemplate.opsForList().rightPop("transcode_jobs_v2");
        if (jobJson != null) {
            System.out.println(">>> WORKER FOUND JOB: " + jobJson);
            processVideo(jobJson);
        }
    }

    private void processVideo(String json) {
        String streamId = extractFromJson(json, "streamId");
        String streamKey = extractFromJson(json, "key");
        if (streamKey == null)
            streamKey = extractFromJson(json, "streamKey"); // fallback
        String userId = extractFromJson(json, "userId");
        String s3SubPath = PathUtils.getS3UploadPath(userId, streamId);
        String subPath = PathUtils.sanitizeUserId(userId) + "/" + streamId;
        String outputDir = "/tmp/hls/" + subPath;
        new File(outputDir).mkdirs();

        log.info(">>> STARTING FFMPEG for subPath: {}", subPath);
        log.info(">>> S3 Path (prefix): {}", s3SubPath);
        log.info(">>> S3 Bucket: {}", minioProperties.getBucket());
        log.info(">>> Input URL: {}/{}", ingestBaseUrl, streamKey);

        ProcessBuilder pb = new ProcessBuilder(
                "ffmpeg",
                "-i", ingestBaseUrl + "/" + streamKey,
                "-c:v", "libx264", "-preset", "veryfast",
                "-profile:v", "main", "-level:v", "3.1",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k",
                "-f", "hls",
                "-hls_flags", "independent_segments",
                "-hls_time", "4",
                "-hls_list_size", "0",
                "-hls_playlist_type", "event",
                outputDir + "/index.m3u8");

        pb.redirectErrorStream(true);

        try {
            // Give the RTMP stream a second to stabilize
            Thread.sleep(2000);
            Process process = pb.start();

            java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(2);

            executor.submit(() -> {
                try (java.io.BufferedReader r = new java.io.BufferedReader(
                        new java.io.InputStreamReader(process.getInputStream()))) {
                    String l;
                    while ((l = r.readLine()) != null)
                        log.info("FFMPEG [{}]: {}", streamId, l);
                } catch (Exception e) {
                    log.error("Error reading FFMPEG output for {}: {}", streamId, e.getMessage());
                }
            });

            executor.submit(() -> {
                try {
                    java.util.Set<String> uploadedFiles = new java.util.HashSet<>();
                    File folder = new File(outputDir);

                    while (process.isAlive()) {
                        uploadExistingFiles(folder, s3SubPath, uploadedFiles);
                        Thread.sleep(2000);
                    }

                    log.info(">>> FFMPEG PROCESS ENDED for: {}. Exit code: {}", streamId, process.exitValue());
                    Thread.sleep(3000);

                    uploadExistingFiles(folder, s3SubPath, uploadedFiles);
                    log.info(">>> VOD COMPLETE: {} finalize finished.", streamId);
                } catch (InterruptedException e) {
                    log.warn("Upload thread interrupted for {}", streamId);
                    Thread.currentThread().interrupt();
                } catch (Exception e) {
                    log.error("Error during upload process for {}: {}", streamId, e.getMessage(), e);
                } finally {
                    executor.shutdown();
                }
            });

        } catch (Exception e) {
            log.error(">>> FAILED TO START FFMPEG for {}: {}", streamId, e.getMessage(), e);
        }
    }

    private void uploadExistingFiles(File folder, String subPath, java.util.Set<String> uploadedFiles) {
        File[] files = folder.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory())
                    continue;
                String s3Path = subPath + "/" + f.getName();
                if (f.getName().endsWith(".ts") && !uploadedFiles.contains(f.getName())) {
                    log.info(">>> UPLOADING CHUNK: {} to bucket: {}", s3Path, minioProperties.getBucket());
                    s3UploadService.uploadChunk(f, s3Path);
                    uploadedFiles.add(f.getName());
                } else if (f.getName().endsWith(".m3u8")) {
                    log.info(">>> UPLOADING MANIFEST: {} to bucket: {}", s3Path, minioProperties.getBucket());
                    s3UploadService.uploadChunk(f, s3Path);
                }
            }
        }
    }

    private String extractFromJson(String json, String key) {
        try {
            String search = "\"" + key + "\":\"";
            if (json.contains(search)) {
                String part = json.split(search)[1];
                return part.split("\"")[0];
            }
        } catch (Exception e) {
            // ignore
        }
        return null;
    }
}
