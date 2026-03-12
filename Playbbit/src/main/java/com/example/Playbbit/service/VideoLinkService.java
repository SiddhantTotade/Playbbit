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
}