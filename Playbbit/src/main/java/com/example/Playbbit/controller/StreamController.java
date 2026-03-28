package com.example.Playbbit.controller;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import com.example.Playbbit.service.JwtService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.entity.StreamStatus;
import com.example.Playbbit.entity.Visibility;
import com.example.Playbbit.repository.StreamRepository;
import com.example.Playbbit.service.StreamService;
import com.example.Playbbit.service.VideoLinkService;

@RestController
public class StreamController {
    private final StreamService streamService;
    private final StreamRepository streamRepository;
    private final VideoLinkService videoLinkService;
    private final JwtService jwtService;
    private final com.example.Playbbit.service.S3UploadService s3UploadService;
    private final com.example.Playbbit.service.DownloadService downloadService;

    public StreamController(StreamService streamService, StreamRepository streamRepository,
            VideoLinkService videoLinkService, JwtService jwtService,
            com.example.Playbbit.service.S3UploadService s3UploadService,
            com.example.Playbbit.service.DownloadService downloadService) {
        this.streamService = streamService;
        this.streamRepository = streamRepository;
        this.videoLinkService = videoLinkService;
        this.jwtService = jwtService;
        this.s3UploadService = s3UploadService;
        this.downloadService = downloadService;
    }

    @PostMapping("/api/live/create")
    public ResponseEntity<Map<String, String>> createStream(Principal principal,
            @RequestBody Map<String, String> payload) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String userId = principal.getName();
        String title = payload.getOrDefault("title", "Untitled Stream");
        Visibility visibility = Visibility.valueOf(payload.getOrDefault("visibility", "PUBLIC").toUpperCase());
        String accessPin = payload.get("accessPin");

        String streamKey = UUID.randomUUID().toString().replace("-", ""); // Secure random key

        StreamEntity stream = new StreamEntity();
        stream.setTitle(title);
        stream.setStreamKey(streamKey);
        stream.setUserId(userId);
        stream.setStatus(StreamStatus.IDLE);
        stream.setVisibility(visibility);
        if (visibility == Visibility.PRIVATE && accessPin != null) {
            stream.setAccessPin(accessPin);
        }

        streamRepository.save(stream);

        return ResponseEntity.ok(Map.of(
                "id", stream.getId().toString(),
                "streamKey", streamKey,
                "rtmpUrl", "rtmp://localhost:1935/live"));
    }

    @RequestMapping(value = "/validate", method = { RequestMethod.GET, RequestMethod.POST })
    public ResponseEntity<Void> validateStream(@RequestParam("name") String streamKey) {
        boolean isValid = streamService.startStream(streamKey);
        if (isValid) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.status(403).build();
        }
    }

    @RequestMapping(value = "/done", method = { RequestMethod.GET, RequestMethod.POST })
    public void stopStream(@RequestParam("name") String streamKey) {
        streamService.stopStream(streamKey);
    }

    @GetMapping("/api/live/{id}")
    public ResponseEntity<StreamEntity> getLiveStream(@PathVariable UUID id) {
        Optional<StreamEntity> streamOpt = streamRepository.findById(id);
        if (streamOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        StreamEntity stream = streamOpt.get();
        if (stream.getVisibility() == Visibility.PRIVATE) {
            // Do not leak the manifest URL for private streams just from fetching info
            stream.setManifestUrl(null);
        } else {
            // Public streams get the manifest URL populated
            stream.setManifestUrl(videoLinkService.getAccessUrl(stream));
        }
        return ResponseEntity.ok(stream);
    }

    @PostMapping("/api/live/{id}/verify")
    public ResponseEntity<Map<String, String>> verifyLiveStream(@PathVariable UUID id,
            @RequestBody Map<String, String> payload, HttpServletResponse response) {
        String pin = payload.get("pin");
        Optional<StreamEntity> streamOpt = streamRepository.findById(id);
        if (streamOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        StreamEntity stream = streamOpt.get();

        if (stream.getVisibility() == Visibility.PUBLIC) {
            return ResponseEntity.ok(Map.of("manifestUrl", videoLinkService.getAccessUrl(stream)));
        }

        if (stream.getAccessPin() != null && stream.getAccessPin().equals(pin)) {
            // Generate a token for this stream access
            // Bind to current user if logged in, otherwise use viewer proxy.
            String authName = SecurityContextHolder.getContext().getAuthentication() != null ? 
                                 SecurityContextHolder.getContext().getAuthentication().getName() : null;
            boolean isAuthAnonymous = authName == null || "anonymousUser".equals(authName);
            String subject = isAuthAnonymous ? "viewer@playbbit.com" : authName;

            String token = jwtService.generateToken(subject, id.toString());

            ResponseCookie resCookie = ResponseCookie.from("stream_access_" + id, token)
                    .path("/")
                    .httpOnly(true)
                    .maxAge(3600 * 4)
                    .sameSite("Lax")
                    .build();
            response.addHeader(HttpHeaders.SET_COOKIE, resCookie.toString());

            return ResponseEntity.ok(Map.of("manifestUrl", videoLinkService.getAccessUrl(stream)));
        }

        return ResponseEntity.status(403).body(Map.of("error", "Incorrect PIN"));
    }

    @GetMapping("/api/live/{id}/download")
    public ResponseEntity<Map<String, String>> prepareStreamDownload(@PathVariable UUID id, jakarta.servlet.http.HttpServletRequest request) {
        Optional<StreamEntity> streamOpt = streamRepository.findById(id);
        if (streamOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        StreamEntity stream = streamOpt.get();

        // 1. Authorization check based on privacy
        if (stream.getVisibility() == Visibility.PRIVATE) {
            String currentUser = (SecurityContextHolder.getContext().getAuthentication() != null)
                    ? SecurityContextHolder.getContext().getAuthentication().getName()
                    : "anonymousUser";
            boolean isOwner = currentUser != null && !"anonymousUser".equals(currentUser) && currentUser.equals(stream.getUserId());
            boolean authorized = isOwner;

            if (!authorized && request.getCookies() != null) {
                String targetCookieName = "stream_access_" + id;
                for (jakarta.servlet.http.Cookie cookie : request.getCookies()) {
                    if (targetCookieName.equals(cookie.getName())) {
                        String token = cookie.getValue();
                        if (jwtService.validateToken(token) && id.toString().equals(jwtService.getVideoIdFromToken(token))) {
                            authorized = true;
                            break;
                        }
                    }
                }
            }

            if (!authorized) {
                return ResponseEntity.status(403).body(Map.of("error", "Unauthorized to download this secure stream"));
            }
        }

        String s3Key = "playbbit-live-streams/" + com.example.Playbbit.util.PathUtils.sanitizeUserId(stream.getUserId()) + "/" + id + "/download.mp4";
        boolean fileExists = s3UploadService.checkObjectExists(s3Key);

        if (fileExists) {
            String presignedUrl = videoLinkService.generatePresignedUrl(s3Key, java.time.Duration.ofHours(4), stream.getTitle());
            return ResponseEntity.ok(Map.of("status", "READY", "url", presignedUrl));
        }

        String currentStatus = downloadService.getStatus(id.toString());
        if ("PROCESSING".equals(currentStatus)) {
            return ResponseEntity.status(202).body(Map.of("status", "PROCESSING", "message", "Stream is compiling into MP4..."));
        } else if ("FAILED".equals(currentStatus)) {
            return ResponseEntity.status(500).body(Map.of("status", "FAILED", "message", "Download preparation failed"));
        } else {
            downloadService.prepareDownloadAsync(id.toString(), stream.getUserId(), true);
            return ResponseEntity.status(202).body(Map.of("status", "PROCESSING", "message", "Download compiling started."));
        }
    }
}
