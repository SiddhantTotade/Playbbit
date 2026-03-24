package com.example.Playbbit.service;

import java.io.File;
import java.util.Set;
import java.util.HashSet;
import java.util.UUID;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.repository.StreamRepository;

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
    private final StreamRepository streamRepository;
    
    // Track active upload loops
    private final ConcurrentHashMap<String, AtomicBoolean> activeWorkers = new ConcurrentHashMap<>();

    // The shared volume from nginx-rtmp where HLS chunks are written natively
    private final String HLS_DIR = "/tmp/hls";

    @Scheduled(fixedDelay = 1000)
    public void pollJobs() {
        try {
            String jobJson = redisTemplate.opsForList().rightPop("transcode_jobs_v2");
            if (jobJson != null) {
                log.info(">>> [TRACE] WORKER POPPED S3 UPLOAD JOB: {}", jobJson);
                processStreamUploads(jobJson);
            }
        } catch (Exception e) {
            log.error(">>> [TRACE] Error polling Redis: {}", e.getMessage());
        }
    }

    private void processStreamUploads(String json) {
        String streamId = extractFromJson(json, "streamId");
        String streamKey = extractFromJson(json, "key");
        if (streamKey == null)
            streamKey = extractFromJson(json, "streamKey"); // fallback
        String userId = extractFromJson(json, "userId");

        // Prevent duplicate processing
        AtomicBoolean isRunning = activeWorkers.get(streamId);
        if (isRunning != null && isRunning.get()) {
            log.info(">>> Existing S3 upload worker for {} is alive. Terminating old worker.", streamId);
            isRunning.set(false); // Stop the old loop
        }

        AtomicBoolean keepRunning = new AtomicBoolean(true);
        activeWorkers.put(streamId, keepRunning);

        String s3SubPath = PathUtils.getS3UploadPath(PathUtils.LIVE_STREAMS_FOLDER, userId, streamId);
        
        final String fStreamId = streamId;
        final String fStreamKey = streamKey;

        new Thread(() -> {
            log.info(">>> STARTING S3 UPLOAD WATCHER for Stream ID: {}, Key: {}", fStreamId, fStreamKey);
            Set<String> uploadedFiles = new HashSet<>();
            File folder = new File(HLS_DIR);

            try {
                // Keep polling while the stream is live in the database AND keepRunning is true
                while (keepRunning.get() && isStreamLiveInDb(fStreamId)) {
                    uploadExistingFiles(folder, fStreamKey, s3SubPath, uploadedFiles, false);
                    Thread.sleep(2000); // Check every 2 seconds
                }
                log.info(">>> Stream {} is no longer live. Doing final S3 upload pass.", fStreamId);
            } catch (Exception e) {
                log.error(">>> [TRACE] Error in S3 Upload Loop for {}: {}", fStreamId, e.getMessage());
            } finally {
                // Final upload pass when stream ends
                uploadExistingFiles(folder, fStreamKey, s3SubPath, uploadedFiles, true);
                log.info(">>> S3 UPLOAD WATCHER STOPPED for Stream ID: {}. Waiting 60s before cleanup...", fStreamId);
                try {
                    Thread.sleep(60000); // Wait 1 minute for players to clear buffer
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
                cleanupLocalHlsFiles(folder, fStreamKey);
                activeWorkers.remove(fStreamId);
            }
        }).start();
    }

    private boolean isStreamLiveInDb(String streamIdStr) {
        try {
            UUID uuid = UUID.fromString(streamIdStr);
            Optional<StreamEntity> opt = streamRepository.findById(uuid);
            return opt.isPresent() && opt.get().getStatus() == com.example.Playbbit.entity.StreamStatus.LIVE;
        } catch (Exception e) {
            log.error("Error checking stream state: {}", e.getMessage());
            return false;
        }
    }

    private void uploadExistingFiles(File folder, String streamKey, String s3SubPath, Set<String> uploadedFiles, boolean isFinalPass) {
        if (!folder.exists() || !folder.isDirectory()) {
            log.warn(">>> HLS directory does not exist or is not a directory: {}", folder.getAbsolutePath());
            return;
        }

        File[] files = folder.listFiles();
        if (files == null || files.length == 0) {
            return;
        }

        // Find the latest segment to skip if not a final pass
        String latestSegment = null;
        int maxSeq = -1;

        if (!isFinalPass) {
            for (File f : files) {
                String name = f.getName();
                if (name.startsWith(streamKey + "-") && name.endsWith(".ts")) {
                    try {
                        String seqStr = name.substring(streamKey.length() + 1, name.lastIndexOf("."));
                        int seq = Integer.parseInt(seqStr);
                        if (seq > maxSeq) {
                            maxSeq = seq;
                            latestSegment = name;
                        }
                    } catch (Exception e) {
                        // Ignore files that don't match the format
                    }
                }
            }
        }

        for (File f : files) {
            if (f.isDirectory()) continue;
            
            String filename = f.getName();
            
            // Only process files belonging to this streamKey
            if (filename.startsWith(streamKey)) {
                // Skip the latest segment if not final pass
                if (!isFinalPass && filename.equals(latestSegment)) {
                    continue;
                }

                // Map streamKey.m3u8 -> index.m3u8 in S3 bucket
                String targetFilename = filename;
                if (filename.equals(streamKey + ".m3u8")) {
                    targetFilename = "index.m3u8";
                }

                String s3Path = s3SubPath + "/" + targetFilename;

                if (filename.endsWith(".ts")) {
                    if (!uploadedFiles.contains(filename)) {
                        log.debug(">>> UPLOADING CHUNK: {} to bucket: {}", s3Path, minioProperties.getBucket());
                        boolean uploaded = s3UploadService.uploadChunk(f, s3Path);
                        if (uploaded) {
                            uploadedFiles.add(filename);
                        }
                    }
                } else if (filename.endsWith(".m3u8")) {
                    // Always upload the latest playlist manifest
                    log.debug(">>> UPLOADING MANIFEST: {} to bucket: {}", s3Path, minioProperties.getBucket());
                    s3UploadService.uploadChunk(f, s3Path);
                }
            }
        }
    }

    private void cleanupLocalHlsFiles(File folder, String streamKey) {
        if (!folder.exists() || !folder.isDirectory()) return;
        
        File[] files = folder.listFiles();
        if (files == null || files.length == 0) return;

        int deletedCount = 0;
        for (File f : files) {
            if (f.getName().startsWith(streamKey)) {
                if (f.delete()) {
                    deletedCount++;
                }
            }
        }
        log.info(">>> CLEANUP: Deleted {} local HLS files for key: {}", deletedCount, streamKey);
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
