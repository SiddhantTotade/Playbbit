package com.example.Playbbit.service;

import java.time.Duration;

import org.springframework.stereotype.Service;

import com.example.Playbbit.entity.StreamEntity;
import com.example.Playbbit.entity.Visibility;

import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service
public class VideoLinkService {

    public String getAccessUrl(StreamEntity video) {
        if (video.getVisibility() == Visibility.PUBLIC) {
            return video.getManifestUrl();
        }

        try (S3Presigner presigner = S3Presigner.create()) {
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofHours(1))
                    .getObjectRequest(b -> b.bucket("live-streams")
                            .key("uploads/" + video.getStreamKey()))
                    .build();

            return presigner.presignGetObject(presignRequest).url().toString();
        }
    }
}