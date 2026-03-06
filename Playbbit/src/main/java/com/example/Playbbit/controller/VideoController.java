package com.example.Playbbit.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.entity.Video;
import com.example.Playbbit.repository.StreamRepository;
import com.example.Playbbit.repository.VideoRepository;
import com.example.Playbbit.service.VideoLinkService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final StreamRepository streamRepository;
    private final VideoRepository videoRepository;
    private final VideoLinkService videoLinkService;

    /** Public feed of all published videos (used by homepage) */
    @GetMapping("/feed")
    public List<Video> getHomeFeed() {
        return videoRepository.findByIsPrivateFalseAndStatus(Video.VideoStatus.PUBLISHED);
    }

    /** Get a single video by ID (used by the watch page) */
    @GetMapping("/{id}")
    public ResponseEntity<Video> getVideoById(@PathVariable String id) {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Video video = videoOpt.get();
        if (video.isPrivate()) {
            String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
            String owner = video.getUserId();
            if (currentUser == null || owner == null || !owner.trim().equalsIgnoreCase(currentUser.trim())) {
                return ResponseEntity.status(403).build();
            }
        }

        return ResponseEntity.ok(video);
    }

    /** Get the currently authenticated user's own videos */
    @GetMapping("/my")
    public List<Video> getMyVideos() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return videoRepository.findByUserId(email);
    }

    /** Delete a video (only the owner can delete) */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVideo(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Video video = videoOpt.get();
        String videoOwner = video.getUserId();
        if (videoOwner == null || !videoOwner.trim().equalsIgnoreCase(email.trim())) {
            return ResponseEntity.status(403).build();
        }
        videoRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /** Toggle video visibility (only the owner) */
    @PatchMapping("/{id}/visibility")
    public ResponseEntity<Video> toggleVisibility(@PathVariable String id) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Video video = videoOpt.get();
        String videoOwner = video.getUserId();
        if (videoOwner == null || !videoOwner.trim().equalsIgnoreCase(email.trim())) {
            return ResponseEntity.status(403).build();
        }
        video.setPrivate(!video.isPrivate());
        return ResponseEntity.ok(videoRepository.save(video));
    }

    /** Public list of live streams */
    @GetMapping("/live/public")
    public List<StreamEntity> getPublicLiveStreams() {
        List<StreamEntity> streams = streamRepository.findAll();
        for (StreamEntity stream : streams) {
            String secureUrl = videoLinkService.getAccessUrl(stream);
            stream.setManifestUrl(secureUrl);
        }
        return streams;
    }
}