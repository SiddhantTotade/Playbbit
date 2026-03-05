package com.example.Playbbit.controller;

import java.io.File;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.entity.Video;
import com.example.Playbbit.entity.Visibility;
import com.example.Playbbit.repository.StreamRepository;
import com.example.Playbbit.repository.VideoRepository;
import com.example.Playbbit.service.S3UploadService;
import com.example.Playbbit.service.TranscodingService;
import com.example.Playbbit.service.VideoLinkService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/videos")
@CrossOrigin(origins = "http://localhost:3000")
@RequiredArgsConstructor
public class VideoController {

    private final S3UploadService s3UploadService;
    private final StreamRepository repository;
    private final VideoLinkService videoLinkService;
    private final VideoRepository videoRepository;
    private final TranscodingService transcodingService;

    @GetMapping("/public")
    public List<Video> getPublicVideos() {
        return videoRepository.findByIsPrivateFalseAndStatus(Video.VideoStatus.PUBLISHED);
    }

    @PostMapping("/upload")
    public ResponseEntity<String> uploadVideo(
            @RequestParam("file") MultipartFile multipartFile,
            @RequestParam("title") String title,
            @RequestParam("visibility") Visibility visibility) {

        try {
            String uploadId = UUID.randomUUID().toString();

            // 1. Convert MultipartFile to a temporary File
            File tempFile = File.createTempFile("upload_", "_" + multipartFile.getOriginalFilename());
            multipartFile.transferTo(tempFile); // This saves the bytes to the disk

            // 2. Create the initial Video record
            Video video = Video.builder()
                    .id(uploadId)
                    .title(title)
                    .status(Video.VideoStatus.TRANSCODING)
                    .isPrivate(visibility == Visibility.PRIVATE)
                    .createdAt(LocalDateTime.now())
                    .build();

            videoRepository.save(video);

            // 3. Pass the actual File object to the async service
            transcodingService.processUploadAsync(
                    tempFile,
                    multipartFile.getOriginalFilename(),
                    uploadId,
                    "system_user", // Or get from your AuthContext
                    title,
                    (visibility == Visibility.PRIVATE));

            return ResponseEntity.ok("Upload successful! Processing started.");
        } catch (Exception e) {
            // log.error("Upload failed: ", e);
            return ResponseEntity.status(500).body("Error: " + e.getMessage());
        }
    }

    @GetMapping
    public List<StreamEntity> getAllPublicVideos() {
        List<StreamEntity> videos = repository.findAll();

        for (StreamEntity video : videos) {
            String secureUrl = videoLinkService.getAccessUrl(video);
            video.setManifestUrl(secureUrl);
        }

        return videos;
    }
}