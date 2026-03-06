package com.example.Playbbit.controller;

import java.io.File;
import java.io.RandomAccessFile;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private static final java.util.concurrent.ConcurrentHashMap<String, Object> uploadLocks = new java.util.concurrent.ConcurrentHashMap<>();

    @GetMapping("/status")
    public ResponseEntity<Map<String, Long>> getStatus(@RequestParam String uploadId) {
        File file = new File(UPLOAD_DIR + uploadId + ".part");
        long currentSize = file.exists() ? file.length() : 0;
        return ResponseEntity.ok(Map.of("currentSize", currentSize));
    }

    @PostMapping("/thumbnail")
    public ResponseEntity<Map<String, String>> uploadThumbnail(
            @RequestParam("file") MultipartFile file) throws Exception {
        String userId = SecurityContextHolder.getContext().getAuthentication().getName();
        String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        String s3Path = "thumbnails/" + userId + "/" + fileName;

        transcodingService.uploadThumbnail(file, s3Path);

        return ResponseEntity.ok(Map.of("thumbnailUrl", "/" + s3Path));
    }

    @PostMapping("/chunk")
    public ResponseEntity<String> uploadChunk(
            @AuthenticationPrincipal String principal,
            @RequestParam("title") String title,
            @RequestParam("isPrivate") boolean isPrivate,
            @RequestParam(value = "thumbnailUrl", required = false) String thumbnailUrl,
            @RequestParam("chunk") MultipartFile chunk,
            @RequestParam("uploadId") String uploadId,
            @RequestParam("totalSize") long totalSize,
            @RequestParam("fileName") String fileName) throws Exception {

        String userId = SecurityContextHolder.getContext().getAuthentication().getName();

        File dir = new File(UPLOAD_DIR);
        if (!dir.exists())
            dir.mkdirs();

        File partFile = new File(UPLOAD_DIR + uploadId + ".part");

        Object lock = uploadLocks.computeIfAbsent(uploadId, k -> new Object());

        synchronized (lock) {
            try (RandomAccessFile raf = new RandomAccessFile(partFile, "rw")) {
                raf.seek(raf.length());
                raf.write(chunk.getBytes());
            }
        }

        if (partFile.length() >= totalSize) {
            uploadLocks.remove(uploadId);
            File finalFile = new File(UPLOAD_DIR + uploadId + "_" + fileName);
            File fileToProcess = partFile.renameTo(finalFile) ? finalFile : partFile;
            transcodingService.processUploadAsync(fileToProcess, fileName, uploadId, userId, title, isPrivate,
                    thumbnailUrl);
            return ResponseEntity.ok("COMPLETE");
        }

        return ResponseEntity.ok("CHUNK_SAVED");
    }
}