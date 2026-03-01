package com.example.Playbbit.controller;

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
import com.example.Playbbit.entity.StreamStatus;
import com.example.Playbbit.entity.VideoType;
import com.example.Playbbit.entity.Visibility;
import com.example.Playbbit.repository.StreamRepository;
import com.example.Playbbit.service.S3UploadService;
import com.example.Playbbit.service.VideoLinkService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/videos")
@CrossOrigin(origins = "http://127.0.0.1:5500")
@RequiredArgsConstructor
public class VideoController {

    private final S3UploadService s3UploadService;
    private final StreamRepository repository;
    private final VideoLinkService videoLinkService;

    @PostMapping("/upload")
    public ResponseEntity<String> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam("visibility") Visibility visibility) {

        try {
            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            String s3Path = "uploads/" + fileName;

            s3UploadService.uploadMultipartFile(file, s3Path);

            StreamEntity video = new StreamEntity();
            video.setTitle(title);
            video.setStreamKey(fileName);
            video.setType(VideoType.UPLOAD);
            video.setStatus(StreamStatus.VOD);
            video.setVisibility(visibility);

            video.setManifestUrl("http://localhost:9000/live-streams/" + s3Path);

            repository.save(video);

            return ResponseEntity.ok("Upload success!");
        } catch (Exception e) {
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