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
            log.info(">>> WORKER FOUND JOB: {}", jobJson);
            processVideo(jobJson);
        }
    }

    private void processVideo(String json) {
        String streamId = extractFromJson(json, "streamId");
        String streamKey = extractFromJson(json, "key");
        if (streamKey == null)
            streamKey = extractFromJson(json, "streamKey"); // fallback
        String userId = extractFromJson(json, "userId");
        String s3SubPath = PathUtils.getS3UploadPath(PathUtils.LIVE_STREAMS_FOLDER, userId, streamId);
        String subPath = PathUtils.sanitizeUserId(userId) + "/" + streamId;
        String outputDir = "/tmp/hls/" + subPath;
        File outDirFile = new File(outputDir);
        boolean created = outDirFile.mkdirs();
        log.info(">>> Output Dir: {}, Created: {}, Exists: {}, Writable: {}",
                outputDir, created, outDirFile.exists(), outDirFile.canWrite());
        log.info(">>> S3 Path (prefix): {}", s3SubPath);
        log.info(">>> S3 Bucket: {}", minioProperties.getBucket());
        log.info(">>> Input URL: {}/{}", ingestBaseUrl, streamKey);

        ProcessBuilder pb = new ProcessBuilder(
                "ffmpeg",
                "-analyzeduration", "10M",
                "-probesize", "10M",
                "-i", ingestBaseUrl + "/" + streamKey,
                "-map", "0:v?", "-map", "0:a?",
                "-c:v", "libx264", "-preset", "veryfast",
                "-tune", "zerolatency",
                "-profile:v", "main", "-level:v", "4.1",
                "-pix_fmt", "yuv420p",
                "-g", "60", "-bf", "0", "-sc_threshold", "0",
                "-c:a", "aac", "-b:a", "128k", "-ac", "2",
                "-ar", "44100",
                "-af", "aresample=async=1",
                "-f", "hls",
                "-hls_flags", "independent_segments",
                "-hls_time", "4",
                "-hls_list_size", "6",
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

                    int exitCode = process.waitFor();
                    log.info(">>> FFMPEG PROCESS ENDED for: {}. Exit code: {}", streamId, exitCode);
                    Thread.sleep(3000);

                    uploadExistingFiles(folder, s3SubPath, uploadedFiles);
                    log.info(">>> VOD COMPLETE: {} finalize finished. Final file count: {}", streamId,
                            uploadedFiles.size());

                    // Clean up local files after some delay to ensure last proxy requests are
                    // served
                    Thread.sleep(10000);
                    deleteLocalFolder(folder);
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
        if (files == null) {
            log.warn(">>> Directory listing failed for: {}", folder.getAbsolutePath());
            return;
        }
        if (files.length == 0) {
            log.info(">>> No files found in directory: {}", folder.getAbsolutePath());
            return;
        }
        log.info(">>> Scan in {}: found {} files", folder.getName(), files.length);

        for (File f : files) {
            if (f.isDirectory())
                continue;
            String s3Path = subPath + "/" + f.getName();
            if (f.getName().endsWith(".ts")) {
                if (!uploadedFiles.contains(f.getName())) {
                    log.info(">>> UPLOADING CHUNK: {} to bucket: {}", s3Path, minioProperties.getBucket());
                    s3UploadService.uploadChunk(f, s3Path);
                    uploadedFiles.add(f.getName());
                } else {
                    log.debug(">>> Skipping already uploaded chunk: {}", f.getName());
                }
            } else if (f.getName().endsWith(".m3u8")) {
                log.info(">>> UPLOADING MANIFEST: {} to bucket: {}", s3Path, minioProperties.getBucket());
                s3UploadService.uploadChunk(f, s3Path);
            } else {
                log.info(">>> Found non-hls file: {}", f.getName());
            }
        }
    }

    private void deleteLocalFolder(File folder) {
        if (folder.exists()) {
            File[] files = folder.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.isDirectory()) {
                        deleteLocalFolder(f);
                    } else {
                        f.delete();
                    }
                }
            }
            folder.delete();
            log.info(">>> CLEANED UP local HLS folder: {}", folder.getAbsolutePath());
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
