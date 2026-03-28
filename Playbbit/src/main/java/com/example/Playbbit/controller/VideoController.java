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
import com.example.Playbbit.service.S3UploadService;
import com.example.Playbbit.service.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import java.util.Map;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/videos")
@RequiredArgsConstructor
public class VideoController {

    private final StreamRepository streamRepository;
    private final VideoRepository videoRepository;
    private final VideoLinkService videoLinkService;
    private final S3UploadService s3UploadService;
    private final JwtService jwtService;
    private final com.example.Playbbit.service.DownloadService downloadService;

    /** Public feed of all published videos (used by homepage) */
    @GetMapping("/feed")
    public List<Video> getHomeFeed() {
        return videoRepository.findByIsPrivateFalseAndStatus(Video.VideoStatus.PUBLISHED);
    }

    /** Get a single video by ID (used by the watch page) */
    @GetMapping("/{id}")
    public ResponseEntity<Video> getVideoById(@PathVariable String id, HttpServletRequest request, HttpServletResponse response) {
        System.out.println("GET /api/videos/" + id + " called");
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            System.out.println("Video with id " + id + " not found in database.");
            return ResponseEntity.notFound().build();
        }

        Video video = videoOpt.get();
        System.out.println("Video found: " + video.getTitle() + " (Status: " + video.getStatus() + ")");
        if (video.isPrivate()) {
            String owner = video.getUserId();
            String currentUser = (SecurityContextHolder.getContext().getAuthentication() != null) 
                                 ? SecurityContextHolder.getContext().getAuthentication().getName() 
                                 : "anonymousUser";
            boolean isOwner = currentUser != null && !"anonymousUser".equals(currentUser) && currentUser.equals(owner);
            boolean authorized = isOwner;

            System.out.println(">>> [VideoController] PRIVATE VIDEO: ID=" + id + ", User=" + currentUser + ", Owner=" + owner + ", isOwner=" + isOwner);

            if (!authorized && request.getCookies() != null) {
                String targetCookieName = "stream_access_" + id;
                for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                    if (targetCookieName.equals(cookie.getName())) {
                        String token = cookie.getValue();
                        System.out.println(">>> [VideoController] Found access cookie for ID=" + id);
                        if (jwtService.validateToken(token)) {
                            String tokenVideoId = jwtService.getVideoIdFromToken(token);
                            if (id.equals(tokenVideoId)) {
                                authorized = true;
                                System.out.println(">>> [VideoController] Authorized via Cookie for ID=" + id);
                                break;
                            }
                        }
                    }
                }
            }

            if (!authorized) {
                System.out.println(">>> [VideoController] ACCESS DENIED: ID=" + id);
                video.setHlsUrl(null);
            } else {
                System.out.println(">>> [VideoController] ACCESS GRANTED: ID=" + id);
                
                // If owner but no cookie yet, set it to help downstream HLS requests
                if (isOwner) {
                     String token = jwtService.generateToken(currentUser, id);
                     ResponseCookie resCookie = ResponseCookie.from("stream_access_" + id, token)
                            .path("/")
                            .httpOnly(true)
                            .maxAge(3600 * 4)
                            .sameSite("Lax")
                            .build();
                     response.addHeader(HttpHeaders.SET_COOKIE, resCookie.toString());
                }
            }
        }

        return ResponseEntity.ok(video);
    }

    @PostMapping("/{id}/verify")
    public ResponseEntity<Map<String, String>> verifyVideoPin(@PathVariable String id,
            @RequestBody Map<String, String> payload, HttpServletResponse response) {
        String pin = payload.get("pin");
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Video video = videoOpt.get();

        if (!video.isPrivate()) {
            return ResponseEntity.ok(Map.of("status", "success"));
        }

        if (video.getAccessPin() != null && video.getAccessPin().equals(pin)) {
            // Generate a token for this video access. 
            // Bind to current user if logged in, otherwise use viewer proxy.
            String authName = SecurityContextHolder.getContext().getAuthentication() != null ? 
                                 SecurityContextHolder.getContext().getAuthentication().getName() : null;
            boolean isAuthAnonymous = authName == null || "anonymousUser".equals(authName);
            String subject = isAuthAnonymous ? "viewer@playbbit.com" : authName;
            System.out.println(">>> [VideoController] DEBUG PIN VERIFIED: ID=" + id + ", subject=" + subject);
            String token = jwtService.generateToken(subject, id);
            ResponseCookie resCookie = ResponseCookie.from("stream_access_" + id, token)
                    .path("/")
                    .httpOnly(true)
                    .maxAge(3600 * 4)
                    .sameSite("Lax")
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, resCookie.toString());
            System.out.println(">>> [VideoController] PIN VERIFIED: ID=" + id + ", Cookie set: " + resCookie.getName());
            return ResponseEntity.ok(Map.of("status", "success"));
        }

        return ResponseEntity.status(403).body(Map.of("error", "Incorrect PIN"));
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<Map<String, String>> prepareVideoDownload(@PathVariable String id, HttpServletRequest request) {
        Optional<Video> videoOpt = videoRepository.findById(id);
        if (videoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Video video = videoOpt.get();

        // 1. Authorization check based on privacy (same logic as getVideoById simplified)
        if (video.isPrivate()) {
            String currentUser = (SecurityContextHolder.getContext().getAuthentication() != null)
                    ? SecurityContextHolder.getContext().getAuthentication().getName()
                    : "anonymousUser";
            boolean isOwner = currentUser != null && !"anonymousUser".equals(currentUser) && currentUser.equals(video.getUserId());
            boolean authorized = isOwner;

            if (!authorized && request.getCookies() != null) {
                String targetCookieName = "stream_access_" + id;
                for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                    if (targetCookieName.equals(cookie.getName())) {
                        String token = cookie.getValue();
                        if (jwtService.validateToken(token) && id.equals(jwtService.getVideoIdFromToken(token))) {
                            authorized = true;
                            break;
                        }
                    }
                }
            }

            if (!authorized) {
                return ResponseEntity.status(403).body(Map.of("error", "Unauthorized to download this secure video"));
            }
        }

        // 2. Check MinIO state — prefer original file (exact source quality)
        String baseKey = com.example.Playbbit.util.PathUtils.getS3UploadPath(
                com.example.Playbbit.util.PathUtils.VIDEOS_FOLDER, video.getUserId(), id);

        String originalKey = baseKey + "/original.mp4";
        if (s3UploadService.checkObjectExists(originalKey)) {
            String presignedUrl = videoLinkService.generatePresignedUrl(originalKey, java.time.Duration.ofHours(4), video.getTitle());
            return ResponseEntity.ok(Map.of("status", "READY", "url", presignedUrl));
        }

        // Fall back to ffmpeg-compiled download.mp4 for older videos
        String s3Key = baseKey + "/download.mp4";
        boolean fileExists = s3UploadService.checkObjectExists(s3Key);

        if (fileExists) {
            String presignedUrl = videoLinkService.generatePresignedUrl(s3Key, java.time.Duration.ofHours(4), video.getTitle());
            return ResponseEntity.ok(Map.of("status", "READY", "url", presignedUrl));
        }

        // 3. Initiate or Check Processing
        String currentStatus = downloadService.getStatus(id);
        if ("PROCESSING".equals(currentStatus)) {
            return ResponseEntity.status(202).body(Map.of("status", "PROCESSING", "message", "Video is compiling into MP4..."));
        } else if ("FAILED".equals(currentStatus)) {
            return ResponseEntity.status(500).body(Map.of("status", "FAILED", "message", "Download preparation failed"));
        } else {
            // "NOT_FOUND" case - kick off process
            String currentAuth = (SecurityContextHolder.getContext().getAuthentication() != null) ? SecurityContextHolder.getContext().getAuthentication().getName() : "anonymousUser";
            downloadService.prepareDownloadAsync(id, video.getUserId(), false);
            return ResponseEntity.status(202).body(Map.of("status", "PROCESSING", "message", "Download compiling started."));
        }
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

        // Cleanup S3 assets
        String prefix = "uploads/" + videoOwner + "/" + id + "/";
        try {
            s3UploadService.deleteFolder(prefix);

            // Delete thumbnail if it exists
            String thumbUrl = video.getThumbnailUrl();
            if (thumbUrl != null && !thumbUrl.isEmpty()) {
                // If it's a relative path like /thumbnails/..., strip leading slash for S3 key
                String thumbKey = thumbUrl.startsWith("/") ? thumbUrl.substring(1) : thumbUrl;
                s3UploadService.deleteFolder(thumbKey);
            }
        } catch (Exception e) {
            System.err.println("Failed to cleanup S3 assets for video " + id + ": " + e.getMessage());
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
            if (stream.getVisibility() != com.example.Playbbit.entity.Visibility.PRIVATE) {
                String secureUrl = videoLinkService.getAccessUrl(stream);
                stream.setManifestUrl(secureUrl);
            } else {
                stream.setManifestUrl(null);
            }
        }
        return streams;
    }
}