package com.example.Playbbit.service;

import java.time.Duration;

import org.springframework.stereotype.Service;

import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.entity.Visibility;

import com.example.Playbbit.config.MinioProperties;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service
public class VideoLinkService {
    private final S3Presigner s3Presigner;
    private final MinioProperties minioProperties;

    public VideoLinkService(S3Presigner s3Presigner, MinioProperties minioProperties) {
        this.s3Presigner = s3Presigner;
        this.minioProperties = minioProperties;
    }

    public String getAccessUrl(StreamEntity video) {
        return video.getManifestUrl();
    }

    public String generatePresignedUrl(String key, Duration duration, String forceDownloadFilename) {
        try {
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(duration)
                    .getObjectRequest(req -> {
                        req.bucket(minioProperties.getBucket()).key(key);
                        if (forceDownloadFilename != null && !forceDownloadFilename.isEmpty()) {
                            req.responseContentDisposition("attachment; filename=\"" + forceDownloadFilename.replaceAll("[^a-zA-Z0-9.-]", "_") + ".mp4\"");
                        }
                    })
                    .build();

            return s3Presigner.presignGetObject(presignRequest).url().toString();
        } catch (Exception e) {
            System.err.println("Failed to generate presigned URL for key " + key + ": " + e.getMessage());
            return null;
        }
    }
}