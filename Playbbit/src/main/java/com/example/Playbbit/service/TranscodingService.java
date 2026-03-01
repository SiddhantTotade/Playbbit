package com.example.Playbbit.service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class TranscodingService {

    private static final String HLS_OUTPUT_DIR = "hls-output/";

    @Async
    public void processUploadAsync(File inputFile, String originalName, String uploadId) {
        try {
            log.info("Starting HLS Transcoding for: {}", originalName);

            File outputFolder = new File(HLS_OUTPUT_DIR + uploadId);
            if (!outputFolder.exists())
                outputFolder.mkdirs();

            String m3u8Path = outputFolder.getAbsolutePath() + "/index.m3u8";
            String segmentPath = outputFolder.getAbsolutePath() + "/file%03d.ts";

            ProcessBuilder pb = new ProcessBuilder(
                    "ffmpeg", "-i", inputFile.getAbsolutePath(),
                    "-profile:v", "baseline",
                    "-level", "3.0",
                    "-s", "1280x720",
                    "-start_number", "0",
                    "-hls_time", "6",
                    "-hls_list_size", "0",
                    "-f", "hls",
                    "-hls_segment_filename", segmentPath,
                    m3u8Path);

            pb.redirectErrorStream(true);
            Process process = pb.start();

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                }
            }

            int exitCode = process.waitFor();
            if (exitCode == 0) {
                log.info("Transcoding successful! HLS available at: {}", m3u8Path);

                if (inputFile.delete()) {
                    log.info("Temporary file deleted: {}", inputFile.getName());
                }

            } else {
                log.error("FFmpeg failed with exit code {}", exitCode);
            }

        } catch (Exception e) {
            log.error("Error during transcoding process", e);
        }
    }
}