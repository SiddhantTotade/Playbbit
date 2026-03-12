package com.example.Playbbit.controller;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.security.Principal;

import org.springframework.http.ResponseEntity;
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

    public StreamController(StreamService streamService, StreamRepository streamRepository,
            VideoLinkService videoLinkService, JwtService jwtService) {
        this.streamService = streamService;
        this.streamRepository = streamRepository;
        this.videoLinkService = videoLinkService;
        this.jwtService = jwtService;
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
            String token = jwtService.generateToken("viewer@playbbit.com"); // Dummy email as JwtService requires it

            Cookie cookie = new Cookie("stream_access_" + id, token);
            cookie.setPath("/");
            cookie.setHttpOnly(true);
            cookie.setMaxAge(3600 * 4); // 4 hours
            // cookie.setSecure(true); // Enable if using HTTPS
            response.addCookie(cookie);

            return ResponseEntity.ok(Map.of("manifestUrl", videoLinkService.getAccessUrl(stream)));
        }

        return ResponseEntity.status(403).body(Map.of("error", "Incorrect PIN"));
    }
}
