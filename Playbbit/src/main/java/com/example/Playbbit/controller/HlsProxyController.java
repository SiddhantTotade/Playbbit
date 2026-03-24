package com.example.Playbbit.controller;

import com.example.Playbbit.config.MinioProperties;
import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.entity.Visibility;
import com.example.Playbbit.repository.StreamRepository;
import com.example.Playbbit.repository.VideoRepository;
import com.example.Playbbit.entity.StreamStatus;
import com.example.Playbbit.service.JwtService;
import com.example.Playbbit.util.PathUtils;
import com.example.Playbbit.entity.Video;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/live/proxy")
@RequiredArgsConstructor
@Slf4j
public class HlsProxyController {

    private final StreamRepository streamRepository;
    private final VideoRepository videoRepository;
    private final S3Client s3Client;
    private final MinioProperties minioProperties;
    private final JwtService jwtService;

    @GetMapping("/{id}/{filename}")
    public ResponseEntity<Resource> proxyHlsPlaylist(
            @PathVariable String id,
            @PathVariable String filename,
            HttpServletRequest request,
            Principal principal) {

        log.info(">>> [HlsProxyController] REQUEST: File={}, ID={}, Principal={}", 
                filename, id, principal != null ? principal.getName() : "null");

        log.debug(">>> [HlsProxyController] REQUEST: File={}, ID={}, Principal={}, TokenParam={}, AuthHeader={}", 
                filename, id, principal != null ? principal.getName() : "null", 
                request.getParameter("token") != null ? "present" : "absent",
                request.getHeader("Authorization") != null ? "present" : "absent");

        String userId = null;
        boolean isPrivate = false;
        boolean isLive = false;
        boolean isStreamEntity = false;

        // 1. Try finding in StreamRepository (Live or VOD from live)
        try {
            UUID uuid = UUID.fromString(id);
            Optional<StreamEntity> streamOpt = streamRepository.findById(uuid);
            if (streamOpt.isPresent()) {
                StreamEntity stream = streamOpt.get();
                userId = stream.getUserId();
                isPrivate = stream.getVisibility() == Visibility.PRIVATE;
                isLive = stream.getStatus() == StreamStatus.LIVE;
                isStreamEntity = true;
            }
        } catch (IllegalArgumentException e) {
            // Not a UUID, skip Live check
        }

        // 2. Try finding in VideoRepository (VOD) if not found in Live
        if (userId == null) {
            Optional<Video> videoOpt = videoRepository.findById(id);
            if (videoOpt.isPresent()) {
                Video video = videoOpt.get();
                userId = video.getUserId();
                isPrivate = video.isPrivate();
            }
        }

        if (userId == null) {
            return ResponseEntity.notFound().build();
        }

        if (isPrivate) {
            boolean authorized = false;

            // 1. Check if user is the owner
            if (principal != null && userId != null && principal.getName().trim().equalsIgnoreCase(userId.trim())) {
                authorized = true;
            }

            // 2. Check for tokens via Authorization Header, Query Parameter, or Cookie
            String sessionToken = request.getParameter("token");
            String authHeader = request.getHeader("Authorization");
            
            log.info(">>> [HlsProxyController] AUTH CHECK: TokenParam={}, AuthHeader={}", 
                    sessionToken != null ? "PRESENT" : "ABSENT", 
                    authHeader != null ? "PRESENT" : "ABSENT");

            if (sessionToken == null && authHeader != null && authHeader.startsWith("Bearer ")) {
                sessionToken = authHeader.substring(7);
            }
            
            if (!authorized && request.getCookies() != null) {
                for (Cookie cookie : request.getCookies()) {
                    String cookieName = cookie.getName() != null ? cookie.getName().trim() : "";
                    
                    // Check for per-video access cookie (Guest/PIN)
                    String targetName = ("stream_access_" + id).trim();
                    if (cookieName.equals(targetName)) {
                        String token = cookie.getValue();
                        if (jwtService.validateToken(token)) {
                            String tokenSubject = jwtService.getEmailFromToken(token);
                            String tokenVideoId = jwtService.getVideoIdFromToken(token);

                            // CRITICAL: Token MUST be bound to THIS video ID
                            boolean isCorrectVideo = id.equalsIgnoreCase(tokenVideoId);
                            if (!isCorrectVideo) {
                                log.warn(">>> [HlsProxyController] WRONG VIDEO token for ID={}. TokenVideoId={}", id, tokenVideoId);
                                continue;
                            }

                            String principalName = principal != null ? principal.getName() : "anonymousUser";
                            boolean isGuestToken = "viewer@playbbit.com".equals(tokenSubject);
                            boolean isOwnerToken = tokenSubject.equalsIgnoreCase(userId);
                            boolean isSelfToken = principal != null && principalName.equalsIgnoreCase(tokenSubject);

                            if (isGuestToken || isOwnerToken || isSelfToken) {
                                authorized = true;
                                log.info(">>> [HlsProxyController] AUTHORIZED via per-video token: ID={}, Subject={}", id, tokenSubject);
                                break;
                            }
                        }
                    }
                    
                    // Check for global session cookie (Owner identity fallback)
                    if (cookieName.equals("playbbit_session") && sessionToken == null) {
                        sessionToken = cookie.getValue();
                    }
                }
            }

            // 3. Final Identity Validation (Session Cookie OR Query Token)
            if (!authorized && sessionToken != null) {
                if (jwtService.validateToken(sessionToken)) {
                    String sessionEmail = jwtService.getEmailFromToken(sessionToken);
                    boolean isOwner = sessionEmail != null && userId != null && sessionEmail.trim().equalsIgnoreCase(userId.trim());
                    if (isOwner) {
                        authorized = true;
                        log.info(">>> [HlsProxyController] AUTHORIZED via token/session (OWNER): ID={}, User={}", id, sessionEmail);
                    } else {
                        log.warn(">>> [HlsProxyController] TOKEN REJECTED: ID={}, User={}, Owner={}", id, sessionEmail, userId);
                    }
                } else {
                    log.warn(">>> [HlsProxyController] INVALID token found for ID={}", id);
                }
            } else if (!authorized) {
                log.warn(">>> [HlsProxyController] NO valid token, session, or access cookie found for ID={}", id);
            }

            if (!authorized) {
                log.warn(">>> [HlsProxyController] ACCESS DENIED (Private): File={}, ID={}, User={}, Owner={}", 
                        filename, id, principal != null ? principal.getName() : "None", userId);
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            log.info(">>> [HlsProxyController] ACCESS GRANTED: File={}, ID={}, User={}", 
                    filename, id, principal != null ? principal.getName() : "None");
        }

        // For LIVE streams: proxy from nginx-rtmp's built-in HLS endpoint
        if (isLive) {
            try {
                UUID uuid = UUID.fromString(id);
                Optional<StreamEntity> streamOpt = streamRepository.findById(uuid);
                if (streamOpt.isPresent()) {
                    StreamEntity stream = streamOpt.get();
                    String streamKey = stream.getStreamKey();
                    // nginx-rtmp generates flat files: {key}.m3u8 and {key}-N.ts
                    String nginxFilename = filename;
                    if (filename.equals("index.m3u8")) {
                        nginxFilename = streamKey + ".m3u8";
                    }
                    String nginxHlsUrl = "http://infra-ingest-1:80/hls/" + nginxFilename;
                    log.info(">>> Proxying LIVE HLS from nginx: {} for stream: {}", nginxHlsUrl, id);

                    URL url = new URL(nginxHlsUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(3000);
                    conn.setReadTimeout(3000);

                    int responseCode = conn.getResponseCode();
                    if (responseCode == 200) {
                        String contentType = getContentType(filename);
                        InputStream inputStream = conn.getInputStream();
                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_TYPE, contentType)
                                .header("Cache-Control", "no-cache")
                                .body(new InputStreamResource(inputStream));
                    } else {
                        log.warn(">>> Nginx HLS returned {} for: {}", responseCode, nginxHlsUrl);
                        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
                    }
                }
            } catch (Exception e) {
                log.error(">>> Error proxying live HLS for {}: {}", id, e.getMessage());
            }
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        // Determine S3 root folder depending on if it's a stream recording or uploaded video
        String rootFolder = isStreamEntity ? PathUtils.LIVE_STREAMS_FOLDER : PathUtils.VIDEOS_FOLDER;
        String s3Key = PathUtils.getS3UploadPath(rootFolder, userId, id) + "/" + filename;

        log.info("Proxying HLS request from S3 for stream: {}, file: {}, S3 key: {}", id, filename, s3Key);

        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(minioProperties.getBucket())
                    .key(s3Key)
                    .build();

            ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getObjectRequest);

            String contentType = getContentType(filename);

            // Finalize manifests for VOD playback from S3
            if (filename.endsWith(".m3u8")) {
                String manifest;
                try (java.util.Scanner s = new java.util.Scanner(s3Object).useDelimiter("\\A")) {
                    manifest = s.hasNext() ? s.next() : "";
                }

                if (manifest.isEmpty() || !manifest.contains("#EXTM3U")) {
                    log.warn(">>> Invalid or empty manifest received from S3 for: {}", filename);
                    return ResponseEntity.notFound().build();
                }

                if (filename.equals("master.m3u8") || manifest.contains("#EXT-X-STREAM-INF")) {
                    manifest = sanitizeManifest(manifest);
                    log.info("Sanitized master.m3u8 for VOD: {}", id);
                } else if (manifest.contains("#EXTINF")) {
                    // It's a media playlist (contains #EXTINF)
                    manifest = finalizeMediaPlaylist(manifest);
                    log.info("Finalized media playlist {} for VOD: {}", filename, id);
                }
                
                byte[] finalizedBytes = manifest.getBytes(StandardCharsets.UTF_8);
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_TYPE, contentType)
                        .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(finalizedBytes.length))
                        .body(new InputStreamResource(new ByteArrayInputStream(finalizedBytes)));
            }

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .body(new InputStreamResource(s3Object));

        } catch (NoSuchKeyException e) {
            log.warn("S3 Key not found: {} for stream: {}", s3Key, id);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error proxying HLS file: {} for stream: {}, S3 key: {}", filename, id, s3Key, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    private String getContentType(String filename) {
        if (filename.endsWith(".m3u8")) {
            return "application/x-mpegURL";
        } else if (filename.endsWith(".ts")) {
            return "video/MP2T";
        } else if (filename.endsWith(".vtt")) {
            return "text/vtt";
        } else {
            return "video/MP2T";
        }
    }

    /**
     * Sanitize a master HLS manifest to fix legacy FFmpeg encoding issues:
     * 1. Multiple DEFAULT=YES (only one allowed per HLS spec RFC 8216)
     * 2. Audio tracks duplicated as standalone variant streams (no RESOLUTION)
     */
    private String sanitizeManifest(String manifest) {
        String[] lines = manifest.split("\n");
        StringBuilder result = new StringBuilder();
        boolean defaultFound = false;

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();

            // Fix 1: Only allow one DEFAULT=YES
            if (line.startsWith("#EXT-X-MEDIA:") && line.contains("TYPE=AUDIO")) {
                if (line.contains("DEFAULT=YES")) {
                    if (defaultFound) {
                        line = line.replace("DEFAULT=YES", "DEFAULT=NO");
                    }
                    defaultFound = true;
                }
                result.append(line).append("\n");
                continue;
            }

            // Fix 2: Remove audio-only variant streams (EXT-X-STREAM-INF without RESOLUTION)
            if (line.startsWith("#EXT-X-STREAM-INF:") && !line.contains("RESOLUTION")) {
                // Skip this line AND the next line (the URI)
                if (i + 1 < lines.length) {
                    i++; // skip URI line
                }
                continue;
            }

            result.append(line).append("\n");
        }

        return result.toString();
    }

    /**
     * Finalize a media playlist (e.g., index.m3u8) for VOD playback:
     * 1. Ensure #EXT-X-PLAYLIST-TYPE:VOD is set
     * 2. Ensure #EXT-X-ENDLIST is present at the end
     */
    private String finalizeMediaPlaylist(String manifest) {
        if (manifest == null || manifest.trim().isEmpty()) return manifest;

        StringBuilder result = new StringBuilder();
        String[] lines = manifest.split("\n");
        boolean hasPlaylistType = false;
        boolean hasEndList = false;

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("#EXT-X-PLAYLIST-TYPE:")) {
                result.append("#EXT-X-PLAYLIST-TYPE:VOD").append("\n");
                hasPlaylistType = true;
            } else if (trimmed.startsWith("#EXT-X-ENDLIST")) {
                hasEndList = true;
                result.append(line).append("\n");
            } else {
                result.append(line).append("\n");
            }
        }

        if (!hasPlaylistType) {
            // Insert after #EXT-X-VERSION or at the beginning
            int insertPos = result.indexOf("#EXT-X-VERSION:");
            if (insertPos != -1) {
                int lineEnd = result.indexOf("\n", insertPos);
                result.insert(lineEnd + 1, "#EXT-X-PLAYLIST-TYPE:VOD\n");
            } else {
                result.insert(0, "#EXT-X-PLAYLIST-TYPE:VOD\n");
            }
        }

        if (!hasEndList) {
            result.append("#EXT-X-ENDLIST").append("\n");
        }

        return result.toString();
    }
}
