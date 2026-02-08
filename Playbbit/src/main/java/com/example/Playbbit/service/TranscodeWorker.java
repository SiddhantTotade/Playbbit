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
        String outputDir = "/tmp/" + streamKey;
        new File(outputDir).mkdir();

        ProcessBuilder pb = new ProcessBuilder(
                "ffmpeg",
                "-i", "rtmp://ingest/live/" + streamKey,
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-c:a", "aac",
                "-b:a", "128k",
                "-f", "hls",
                "-hls_time", "4",
                "-hls_list_size", "6",
                "-hls_segment_filename", outputDir + "/segment_%03d.ts",
                outputDir + "/index.m3u8");

        try {
            Process process = pb.start();
            new Thread(() -> {
                File folder = new File(outputDir);
                while (process.isAlive()) {
                    File[] files = folder.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            if (f.getName().endsWith(".ts") || f.getName().endsWith(".m3u8")) {
                                s3UploadService.uploadChunk(f, streamKey + "/" + f.getName());
                            }
                        }
                    }
                    try {
                        Thread.sleep(2000);
                    } catch (InterruptedException e) {
                    }
                }
            }).start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String extractKeyFromJson(String json) {
        return json.split("\"key\":\"")[1].split("\"")[0];
    }
}
