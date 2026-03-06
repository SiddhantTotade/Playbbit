package com.example.Playbbit.service;

import java.io.File;
import java.time.LocalDateTime;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import com.example.Playbbit.config.MinioProperties;
import com.example.Playbbit.entity.Video;
import com.example.Playbbit.repository.VideoRepository;

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

    @Async
    public void processUploadAsync(File inputFile, String originalName, String uploadId, String userId, String title,
            boolean isPrivate, String thumbnailUrl) {
        log.info("!!! ASYNC PROCESS STARTED for uploadId: {} !!!", uploadId);
        log.info("Input file path: {}, exists: {}", inputFile.getAbsolutePath(), inputFile.exists());
        String topic = "/topic/upload/" + uploadId;

        try {
            Video video = Video.builder()
                    .id(uploadId)
                    .title(title)
                    .userId(userId)
                    .isPrivate(isPrivate)
                    .thumbnailUrl(thumbnailUrl)
                    .status(Video.VideoStatus.TRANSCODING)
                    .createdAt(LocalDateTime.now())
                    .build();
            videoRepository.save(video);

            log.info("Starting Multi-Stream HLS Transcoding for: {}", title);
            messagingTemplate.convertAndSend(topic, "Detecting language tracks...");

            File outputFolder = new File(HLS_OUTPUT_DIR + uploadId);
            if (!outputFolder.exists())
                outputFolder.mkdirs();

            // 1. Detect Streams using ffprobe
            ObjectMapper mapper = new ObjectMapper();
            ProcessBuilder probePb = new ProcessBuilder(
                    "ffprobe", "-v", "error", "-show_streams", "-show_entries", "stream=index,codec_type,tags", "-of",
                    "json", inputFile.getAbsolutePath());
            Process probeProcess = probePb.start();
            JsonNode probeResult = mapper.readTree(probeProcess.getInputStream());
            probeProcess.waitFor();

            List<String> ffmpegArgs = new ArrayList<>();
            ffmpegArgs.add("ffmpeg");
            ffmpegArgs.add("-i");
            ffmpegArgs.add(inputFile.getAbsolutePath());

            // Base Video settings
            ffmpegArgs.add("-c:v");
            ffmpegArgs.add("libx264");
            ffmpegArgs.add("-preset");
            ffmpegArgs.add("veryfast");
            ffmpegArgs.add("-sc_threshold");
            ffmpegArgs.add("0");

            List<String> streamMaps = new ArrayList<>();
            int audioCount = 0;
            int subCount = 0;

            // Map Video
            ffmpegArgs.add("-map");
            ffmpegArgs.add("0:v:0");

            // Process Audio streams
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

                        // Use agroup to link audios to the video variant
                        String map = "a:" + audioCount + ",agroup:audio,language:" + lang;
                        if (audioCount == 0)
                            map += ",default:yes";
                        streamMaps.add(map);
                        audioCount++;
                    } else if ("subtitle".equals(type)) {
                        ffmpegArgs.add("-map");
                        ffmpegArgs.add("0:" + index);
                        ffmpegArgs.add("-c:s:" + subCount);
                        ffmpegArgs.add("webvtt");

                        // Use sgroup for subtitles
                        String map = "s:" + subCount + ",sgroup:subs,language:" + lang;
                        if (subCount == 0)
                            map += ",default:yes";
                        streamMaps.add(map);
                        subCount++;
                    }
                }
            }

            // Always add the video stream to the map
            // We link it to our audio and subtitle groups
            String videoMap = "v:0,agroup:audio";
            if (subCount > 0)
                videoMap += ",sgroup:subs";
            streamMaps.add(0, videoMap);

            // HLS Muxer settings
            ffmpegArgs.add("-f");
            ffmpegArgs.add("hls");
            ffmpegArgs.add("-hls_time");
            ffmpegArgs.add("6");
            ffmpegArgs.add("-hls_list_size");
            ffmpegArgs.add("0");
            ffmpegArgs.add("-hls_segment_filename");
            ffmpegArgs.add(outputFolder.getAbsolutePath() + "/file%v_%03d.ts");
            ffmpegArgs.add("-master_pl_name");
            ffmpegArgs.add("index.m3u8");

            // Combined map: "v:0,agroup:audio,sgroup:subs a:0,agroup:audio...
            // s:0,sgroup:subs..."
            ffmpegArgs.add("-var_stream_map");
            ffmpegArgs.add(String.join(" ", streamMaps));

            ffmpegArgs.add(outputFolder.getAbsolutePath() + "/stream_%v.m3u8");

            log.info("FFMPEG Command: {}", String.join(" ", ffmpegArgs));
            messagingTemplate.convertAndSend(topic, "Transcoding in progress...");

            ProcessBuilder pb = new ProcessBuilder(ffmpegArgs);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("FFMPEG: {}", line);
                }
            }

            process.waitFor();

            if (process.exitValue() == 0) {
                log.info("Transcoding successful! Uploading multi-stream assets...");
                messagingTemplate.convertAndSend(topic, "Uploading language assets...");

                File[] files = outputFolder.listFiles();
                if (files != null) {
                    for (File f : files) {
                        String minioPath = "uploads/" + userId + "/" + uploadId + "/" + f.getName();
                        s3UploadService.uploadChunk(f, minioPath);
                    }
                }

                video.setStatus(Video.VideoStatus.PUBLISHED);
                String hlsPath = "/uploads/" + userId + "/" + uploadId + "/index.m3u8";
                video.setHlsUrl(hlsPath);

                videoRepository.save(video);
                log.info("Video {} (Multi-lang) is now PUBLISHED", uploadId);

                cleanup(outputFolder, inputFile);
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

    public void uploadThumbnail(org.springframework.web.multipart.MultipartFile file, String s3Path) throws Exception {
        s3UploadService.uploadMultipartFile(file, s3Path);
    }

    public String getMinioExternalUrl() {
        return minioProperties.getExternalUrl();
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