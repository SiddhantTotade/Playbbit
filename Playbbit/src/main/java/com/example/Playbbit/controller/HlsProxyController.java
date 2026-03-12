package com.example.Playbbit.controller;

import com.example.Playbbit.config.MinioProperties;
import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.entity.Visibility;
import com.example.Playbbit.repository.StreamRepository;
import com.example.Playbbit.repository.VideoRepository;
import com.example.Playbbit.service.JwtService;
import com.example.Playbbit.util.PathUtils;
import com.example.Playbbit.entity.Video;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
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

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
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
    public ResponseEntity<InputStreamResource> proxyHls(
            @PathVariable String id,
            @PathVariable String filename,
            HttpServletRequest request,
            Principal principal) {

        String userId = null;
        boolean isPrivate = false;
        boolean isLive = false;

        // 1. Try finding in StreamRepository (Live)
        try {
            UUID uuid = UUID.fromString(id);
            Optional<StreamEntity> streamOpt = streamRepository.findById(uuid);
            if (streamOpt.isPresent()) {
                StreamEntity stream = streamOpt.get();
                userId = stream.getUserId();
                isPrivate = stream.getVisibility() == Visibility.PRIVATE;
                isLive = true;
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
            if (principal != null && principal.getName().equals(userId)) {
                authorized = true;
            }

            // 2. Check for access cookie
            if (!authorized && request.getCookies() != null) {
                for (Cookie cookie : request.getCookies()) {
                    if (cookie.getName().equals("stream_access_" + id)) {
                        String token = cookie.getValue();
                        if (jwtService.validateToken(token)) {
                            // Valid token
                            authorized = true;
                            break;
                        }
                    }
                }
            }

            if (!authorized) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
        }

        // 1. Try serving from local disk first (for live streams)
        String localSubPath = PathUtils.sanitizeUserId(userId) + "/" + id;
        File localFile = new File("/tmp/hls/" + localSubPath + "/" + filename);

        if (localFile.exists() && localFile.isFile()) {
            log.info("Serving HLS file LOCALLY for stream: {}, file: {}", id, filename);
            try {
                String contentType = getContentType(filename);
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_TYPE, contentType)
                        .body(new InputStreamResource(new FileInputStream(localFile)));
            } catch (IOException e) {
                log.error("Error reading local HLS file: {}", localFile.getAbsolutePath(), e);
            }
        }

        // Determine S3 root folder
        String rootFolder = isLive ? PathUtils.LIVE_STREAMS_FOLDER : PathUtils.VIDEOS_FOLDER;
        String s3Key = PathUtils.getS3UploadPath(rootFolder, userId, id) + "/" + filename;

        log.info("Proxying HLS request from S3 for stream: {}, file: {}, S3 key: {}", id, filename, s3Key);

        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(minioProperties.getBucket())
                    .key(s3Key)
                    .build();

            ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(getObjectRequest);

            String contentType = getContentType(filename);

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
        } else if (filename.endsWith(".vtt")) {
            return "text/vtt";
        } else {
            return "video/MP2T";
        }
    }
}
