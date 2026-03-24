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
            String authName = SecurityContextHolder.getContext().getAuthentication() != null ? 
                                 SecurityContextHolder.getContext().getAuthentication().getName() : null;
            String currentUser = (authName == null || "anonymousUser".equals(authName)) ? "None" : authName;
            System.out.println(">>> [VideoController] DEBUG: authName=" + authName + ", currentUser=" + currentUser);
            String owner = video.getUserId();

            boolean isOwner = currentUser != null && owner != null && owner.trim().equalsIgnoreCase(currentUser.trim());
            boolean hasCookie = false;

            if (request.getCookies() != null) {
                for (Cookie cookie : request.getCookies()) {
                    String cookieName = cookie.getName() != null ? cookie.getName().trim() : "";
                    String targetName = ("stream_access_" + id).trim();
                    if (cookieName.equals(targetName)) {
                        String token = cookie.getValue();
                        if (jwtService.validateToken(token)) {
                            String tokenSubject = jwtService.getEmailFromToken(token);
                            String tokenVideoId = jwtService.getVideoIdFromToken(token);
                            
                            // CRITICAL: Token MUST be bound to THIS video ID
                            boolean isCorrectVideo = id.equalsIgnoreCase(tokenVideoId);
                            if (!isCorrectVideo) {
                                System.out.println(">>> [VideoController] WRONG VIDEO token. TokenVideoId=" + tokenVideoId + ", RequestId=" + id);
                                continue;
                            }

                            // Grant access if:
                            // 1. Token is the generic viewer proxy
                            // 2. OR Token matches the owner
                            // 3. OR Token subject matches the current logged-in user
                            boolean isGuestToken = "viewer@playbbit.com".equals(tokenSubject);
                            boolean isOwnerToken = tokenSubject.equalsIgnoreCase(owner);
                            boolean isSelfToken = currentUser != null && !"None".equals(currentUser) && tokenSubject.equalsIgnoreCase(currentUser);

                            if (isGuestToken || isOwnerToken || isSelfToken) {
                                hasCookie = true;
                                System.out.println(">>> [VideoController] VALID access cookie found. Subject=" + tokenSubject + ", VideoId=" + tokenVideoId + ", isOwner=" + isOwnerToken);
                                break;
                            } else {
                                System.out.println(">>> [VideoController] MISMASHED identity. TokenSubject=" + tokenSubject + ", CurrentUser=" + currentUser);
                            }
                        }
                    }
                }
            }
            if (!hasCookie) System.out.println(">>> [VideoController] No relevant cookie found in request.");

            if (isOwner) {
                // If owner, automatically set the access cookie so subsequent HLS requests work
                String token = jwtService.generateToken(currentUser, id); // Bind to this ID
                Cookie cookie = new Cookie("stream_access_" + id, token);
                cookie.setPath("/");
                cookie.setHttpOnly(true);
                cookie.setMaxAge(3600 * 4); // 4 hours
                response.addCookie(cookie);
                System.out.println(">>> [VideoController] ACCESS GRANTED to OWNER: ID=" + id + ", User=" + currentUser + ", Owner=" + owner);
            } else if (!hasCookie) {
                System.out.println(">>> [VideoController] ACCESS RESTRICTED: ID=" + id + ", User=" + currentUser + ", Owner=" + owner + ", hasCookie=false");
                // Hide the HLS URL but return the video object so the UI can show the PIN form
                video.setHlsUrl(null);
            } else {
                System.out.println(">>> [VideoController] ACCESS GRANTED via cookie: ID=" + id + ", User=" + currentUser);
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
            String token = jwtService.generateToken(subject, id); // Bind to this ID

            Cookie cookie = new Cookie("stream_access_" + id, token);
            cookie.setPath("/");
            cookie.setHttpOnly(true);
            cookie.setMaxAge(3600 * 4); // 4 hours
            response.addCookie(cookie);

            return ResponseEntity.ok(Map.of("status", "success"));
        }

        return ResponseEntity.status(403).body(Map.of("error", "Incorrect PIN"));
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