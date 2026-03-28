package com.example.Playbbit.service;

import java.io.File;
import java.time.LocalDateTime;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.Playbbit.config.MinioProperties;
import com.example.Playbbit.entity.Video;
import com.example.Playbbit.repository.VideoRepository;
import com.example.Playbbit.util.PathUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class TranscodingService {

    private final MinioProperties minioProperties;
    private final S3UploadService s3UploadService;
    private final SimpMessagingTemplate messagingTemplate;
    private final VideoRepository videoRepository;
    private static final String HLS_OUTPUT_DIR = "hls-output/";

    public Video createInitialVideoRecord(String uploadId, String title, String description, String userId,
            boolean isPrivate, String accessPin, String thumbnailUrl) {
        Video video = Video.builder()
                .id(uploadId)
                .title(title)
                .description(description)
                .userId(userId)
                .isPrivate(isPrivate)
                .accessPin(accessPin)
                .thumbnailUrl(thumbnailUrl)
                .status(Video.VideoStatus.TRANSCODING)
                .createdAt(LocalDateTime.now())
                .build();
        return videoRepository.saveAndFlush(video);
    }

    @Async
    public void processUploadAsync(File inputFile, String originalName, String uploadId, String userId, String title,
            String description, boolean isPrivate, String accessPin, String thumbnailUrl) {
        log.info("!!! ASYNC PROCESS STARTED for uploadId: {} !!!", uploadId);
        log.info("Input file path: {}, exists: {}", inputFile.getAbsolutePath(), inputFile.exists());
        String topic = "/topic/upload/" + uploadId;

        // Fetch existing video record
        Video video = videoRepository.findById(uploadId).orElse(null);
        if (video == null) {
            log.error("Video record not found for upload {}. Initial save might have failed.", uploadId);
            return;
        }

        try {
            log.info("Starting Multi-Stream HLS Transcoding for: {}", title);
            messagingTemplate.convertAndSend(topic, "Detecting language tracks...");

            File outputFolder = new File(HLS_OUTPUT_DIR + uploadId);
            if (!outputFolder.exists())
                outputFolder.mkdirs();

            // Preserve the original upload in MinIO for quality-accurate downloads
            messagingTemplate.convertAndSend(topic, "Preserving original...");
            String originalKey = PathUtils.getS3UploadPath(PathUtils.VIDEOS_FOLDER, userId, uploadId) + "/original.mp4";
            s3UploadService.uploadChunk(inputFile, originalKey);
            log.info("Original file preserved in MinIO at: {}", originalKey);

            // 1. Detect Streams using ffprobe
            ObjectMapper mapper = new ObjectMapper();
            ProcessBuilder probePb = new ProcessBuilder(
                    "ffprobe", "-v", "quiet", "-show_streams", "-show_entries", "stream=index,codec_type,tags", "-of",
                    "json", inputFile.getAbsolutePath());
            log.info("Running ffprobe on: {}", inputFile.getAbsolutePath());
            Process probeProcess = probePb.start();
            JsonNode probeResult = mapper.readTree(probeProcess.getInputStream());
            int probeExit = probeProcess.waitFor();
            log.info("ffprobe exit code: {}", probeExit);
            if (log.isDebugEnabled()) {
                log.debug("ffprobe result: {}", probeResult.toString());
            }

            List<String> ffmpegArgs = new ArrayList<>();
            ffmpegArgs.add("ffmpeg");
            ffmpegArgs.add("-y"); // Overwrite output files without asking
            ffmpegArgs.add("-i");
            ffmpegArgs.add(inputFile.getAbsolutePath());

            List<String> streamMaps = new ArrayList<>();
            int audioCount = 0;
            int subtitleCount = 0;

            // Map Video
            ffmpegArgs.add("-map");
            ffmpegArgs.add("0:v:0");
            ffmpegArgs.add("-c:v");
            ffmpegArgs.add("libx264");
            ffmpegArgs.add("-preset");
            ffmpegArgs.add("veryfast");
            ffmpegArgs.add("-g");
            ffmpegArgs.add("48");
            ffmpegArgs.add("-profile:v");
            ffmpegArgs.add("main");
            ffmpegArgs.add("-level:v");
            ffmpegArgs.add("3.1");
            ffmpegArgs.add("-pix_fmt");
            ffmpegArgs.add("yuv420p");
            ffmpegArgs.add("-sc_threshold");
            ffmpegArgs.add("0");

            // Process Streams
            if (probeResult.has("streams")) {
                for (JsonNode stream : probeResult.get("streams")) {
                    String type = stream.get("codec_type").asText();
                    int index = stream.get("index").asInt();
                    String lang = "und";
                    if (stream.has("tags") && stream.get("tags").has("language")) {
                        lang = stream.get("tags").get("language").asText();
                    }

                    if ("audio".equals(type)) {
                        ffmpegArgs.add("-map");
                        ffmpegArgs.add("0:" + index);
                        ffmpegArgs.add("-c:a:" + audioCount);
                        ffmpegArgs.add("aac");
                        ffmpegArgs.add("-ac:a:" + audioCount);
                        ffmpegArgs.add("2");
                        ffmpegArgs.add("-b:a:" + audioCount);
                        ffmpegArgs.add("128k");

                        // Use aud group to link audios to the video variant
                        String readableName = getLanguageName(lang);
                        String map = "a:" + audioCount + ",agroup:aud,language:" + lang + ",name:" + readableName;
                        streamMaps.add(map);
                        audioCount++;
                    } else if ("subtitle".equals(type)) {
                        String codec = stream.has("codec_name") ? stream.get("codec_name").asText() : "";
                        log.info("Detected subtitle codec: {} for stream index: {}", codec, index);

                        // Only transcode text-based subtitles to WebVTT
                        // Standard FFmpeg can convert these common text formats to WebVTT easily
                        if (codec.matches("subrip|srt|ass|mov_text|webvtt|text")) {
                            ffmpegArgs.add("-map");
                            ffmpegArgs.add("0:" + index);
                            ffmpegArgs.add("-c:s:" + subtitleCount);
                            ffmpegArgs.add("webvtt");

                            // Use sgroup to link subtitles
                            String readableName = getLanguageName(lang);
                            String map = "s:" + subtitleCount + ",sgroup:subs,language:" + lang + ",name:"
                                    + readableName;
                            streamMaps.add(map);
                            subtitleCount++;
                        } else {
                            log.warn("Skipping incompatible subtitle codec: {} (index: {})", codec, index);
                        }
                    }
                }
            }

            // Link video to groups
            StringBuilder videoMap = new StringBuilder("v:0");
            if (audioCount > 0)
                videoMap.append(",agroup:aud");
            if (subtitleCount > 0)
                videoMap.append(",sgroup:subs");
            streamMaps.add(0, videoMap.toString());

            // HLS Muxer settings
            ffmpegArgs.add("-f");
            ffmpegArgs.add("hls");
            // Removed -hls_version 4 as it causes 'Unrecognized option' on this system
            ffmpegArgs.add("-hls_flags");
            ffmpegArgs.add("independent_segments");
            ffmpegArgs.add("-hls_time");
            ffmpegArgs.add("2");
            ffmpegArgs.add("-hls_list_size");
            ffmpegArgs.add("0");
            ffmpegArgs.add("-hls_segment_filename");
            ffmpegArgs.add(outputFolder.getAbsolutePath() + "/segments_%v_%03d.ts");
            ffmpegArgs.add("-master_pl_name");
            ffmpegArgs.add("master.m3u8");
            ffmpegArgs.add("-var_stream_map");
            ffmpegArgs.add(String.join(" ", streamMaps));
            ffmpegArgs.add("-hls_playlist_type");
            ffmpegArgs.add("vod");
            ffmpegArgs.add(outputFolder.getAbsolutePath() + "/stream_%v.m3u8");

            log.info("FFMPEG Command: {}", String.join(" ", ffmpegArgs));
            messagingTemplate.convertAndSend(topic, "Transcoding in progress...");

            ProcessBuilder pb = new ProcessBuilder(ffmpegArgs);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StringBuilder ffmpegOutput = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.info("FFMPEG Output: {}", line);
                    ffmpegOutput.append(line).append("\n");
                }
            }

            int exitCode = process.waitFor();
            log.info("FFMPEG finished with exit code: {}", exitCode);

            if (exitCode == 0) {
                log.info("Transcoding successful! Uploading multi-stream assets for {}", uploadId);
                messagingTemplate.convertAndSend(topic, "Uploading assets...");

                File[] files = outputFolder.listFiles();
                if (files != null) {
                    for (File f : files) {
                        String minioPath = PathUtils.getS3UploadPath(PathUtils.VIDEOS_FOLDER, userId, uploadId) + "/"
                                + f.getName();
                        s3UploadService.uploadChunk(f, minioPath);
                    }
                }

                video.setStatus(Video.VideoStatus.PUBLISHED);
                String hlsPath = "/api/live/proxy/" + uploadId + "/master.m3u8";
                video.setHlsUrl(hlsPath);

                videoRepository.save(video);
                log.info("Video {} is now PUBLISHED", uploadId);

                cleanup(outputFolder, inputFile);
                messagingTemplate.convertAndSend(topic, "Completed");
            } else {
                log.error("FFMPEG FAILED for {}. Exit code: {}. Command was: {}", uploadId, exitCode,
                        String.join(" ", ffmpegArgs));
                log.error("FFMPEG OUTPUT: \n{}", ffmpegOutput.toString());
                video.setStatus(Video.VideoStatus.FAILED);
                videoRepository.save(video);
                messagingTemplate.convertAndSend(topic, "Transcoding Failed. Error code: " + exitCode);
            }

        } catch (Exception e) {
            log.error("Error during transcoding or MinIO upload for " + uploadId, e);
            messagingTemplate.convertAndSend(topic, "Error: " + e.getMessage());
        }
    }

    public void uploadThumbnail(org.springframework.web.multipart.MultipartFile file, String s3Path) throws Exception {
        s3UploadService.uploadMultipartFile(file, s3Path);
    }

    public String getMinioExternalUrl() {
        return minioProperties.getExternalUrl();
    }

    private String getLanguageName(String lang) {
        if (lang == null || lang.isEmpty() || "und".equals(lang))
            return "Default";
        Map<String, String> langMap = Map.ofEntries(
                Map.entry("eng", "English"),
                Map.entry("en", "English"),
                Map.entry("hin", "Hindi"),
                Map.entry("hi", "Hindi"),
                Map.entry("spa", "Spanish"),
                Map.entry("es", "Spanish"),
                Map.entry("fra", "French"),
                Map.entry("fr", "French"),
                Map.entry("ger", "German"),
                Map.entry("de", "German"),
                Map.entry("jpn", "Japanese"),
                Map.entry("ja", "Japanese"));
        return langMap.getOrDefault(lang.toLowerCase(), lang.toUpperCase());
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