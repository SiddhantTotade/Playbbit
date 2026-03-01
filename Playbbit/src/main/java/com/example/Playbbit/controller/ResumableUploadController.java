package com.example.Playbbit.controller;

import java.io.File;
import java.io.RandomAccessFile;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.Playbbit.service.TranscodingService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class ResumableUploadController {

    private final TranscodingService transcodingService;
    private static final String UPLOAD_DIR = "temp-uploads/";

    @GetMapping("/status")
    public ResponseEntity<Map<String, Long>> getStatus(@RequestParam String uploadId) {
        File file = new File(UPLOAD_DIR + uploadId + ".part");
        long currentSize = file.exists() ? file.length() : 0;
        return ResponseEntity.ok(Map.of("currentSize", currentSize));
    }

    @PostMapping("/chunk")
    public ResponseEntity<String> uploadChunk(
            @RequestParam("chunk") MultipartFile chunk,
            @RequestParam("uploadId") String uploadId,
            @RequestParam("totalSize") long totalSize,
            @RequestParam("fileName") String fileName) throws Exception {

        File dir = new File(UPLOAD_DIR);
        if (!dir.exists())
            dir.mkdirs();

        File file = new File(UPLOAD_DIR + uploadId + ".part");

        try (RandomAccessFile raf = new RandomAccessFile(file, "rw")) {
            raf.seek(raf.length());
            raf.write(chunk.getBytes());
        }

        if (file.length() >= totalSize) {
            transcodingService.processUploadAsync(file, fileName, uploadId);
            return ResponseEntity.ok("COMPLETE");
        }

        return ResponseEntity.ok("CHUNK_SAVED");
    }
}