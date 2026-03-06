package com.example.Playbbit.service;

import java.io.File;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TranscodeWorker {
    private final StringRedisTemplate redisTemplate;
    private final S3UploadService s3UploadService;

    @Scheduled(fixedDelay = 1000)
    public void pollJobs() {
        String jobJson = redisTemplate.opsForList().rightPop("transcode_jobs");
        if (jobJson != null) {
            String streamKey = extractKeyFromJson(jobJson);
            System.out.println(">>> WORKER FOUND JOB: " + jobJson);
            processVideo(streamKey);
        }
    }

    private void processVideo(String streamKey) {
        String outputDir = "/tmp/hls/" + streamKey;
        new File(outputDir).mkdirs();

        ProcessBuilder pb = new ProcessBuilder(
                "ffmpeg",
                "-i", "rtmp://infra-ingest-1/live/" + streamKey,
                "-c:v", "libx264", "-preset", "veryfast",
                "-c:a", "aac", "-b:a", "128k",
                "-f", "hls",
                "-hls_time", "4",
                "-hls_list_size", "0",
                "-hls_playlist_type", "event",
                outputDir + "/index.m3u8");

        pb.redirectErrorStream(true);

        try {
            Process process = pb.start();

            java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(2);

            executor.submit(() -> {
                try (java.io.BufferedReader r = new java.io.BufferedReader(
                        new java.io.InputStreamReader(process.getInputStream()))) {
                    String l;
                    while ((l = r.readLine()) != null)
                        System.out.println("FFMPEG: " + l);
                } catch (Exception e) {
                    System.err.println("Error reading FFMPEG output: " + e.getMessage());
                }
            });

            executor.submit(() -> {
                try {
                    java.util.Set<String> uploadedFiles = new java.util.HashSet<>();
                    File folder = new File(outputDir);

                    while (process.isAlive()) {
                        uploadExistingFiles(folder, streamKey, uploadedFiles);
                        Thread.sleep(2000);
                    }

                    System.out.println(">>> OBS Disconnected. Finalizing VOD for: " + streamKey);
                    Thread.sleep(3000);

                    uploadExistingFiles(folder, streamKey, uploadedFiles);
                    System.out.println(">>> VOD COMPLETE: " + streamKey + " is now available for playback.");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    System.err.println("Upload Thread Interrupted: " + e.getMessage());
                } catch (Exception e) {
                    System.err.println("Error during upload process: " + e.getMessage());
                } finally {
                    executor.shutdown();
                }
            });

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void uploadExistingFiles(File folder, String streamKey, java.util.Set<String> uploadedFiles) {
        File[] files = folder.listFiles();
        if (files != null) {
            for (File f : files) {
                String s3Path = streamKey + "/" + f.getName();
                if (f.getName().endsWith(".ts") && !uploadedFiles.contains(f.getName())) {
                    s3UploadService.uploadChunk(f, s3Path);
                    uploadedFiles.add(f.getName());
                } else if (f.getName().endsWith(".m3u8")) {
                    // The playlist is updated every time to include the newest chunks
                    s3UploadService.uploadChunk(f, s3Path);
                }
            }
        }
    }

    private String extractKeyFromJson(String json) {
        return json.split("\"key\":\"")[1].split("\"")[0];
    }
}
