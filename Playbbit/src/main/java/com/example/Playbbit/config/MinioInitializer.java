package com.example.Playbbit.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class MinioInitializer {

    private final S3Client s3Client;
    private final MinioProperties minioProperties;

    @PostConstruct
    public void init() {
        String bucket = minioProperties.getBucket();
        try {
            // 1. Check if bucket exists, create if not
            try {
                s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
                log.info("MinIO bucket '{}' already exists.", bucket);
            } catch (NoSuchBucketException e) {
                log.info("Creating MinIO bucket '{}'...", bucket);
                s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            }

            // 2. Set Public Read Policy
            // This is essential for the frontend to access thumbnails and HLS segments
            // directly.
            String policy = "{\n" +
                    "  \"Version\": \"2012-10-17\",\n" +
                    "  \"Statement\": [\n" +
                    "    {\n" +
                    "      \"Effect\": \"Allow\",\n" +
                    "      \"Principal\": \"*\",\n" +
                    "      \"Action\": [\"s3:GetObject\"],\n" +
                    "      \"Resource\": [\"arn:aws:s3:::" + bucket + "/*\"]\n" +
                    "    }\n" +
                    "  ]\n" +
                    "}";

            s3Client.putBucketPolicy(PutBucketPolicyRequest.builder()
                    .bucket(bucket)
                    .policy(policy)
                    .build());
            log.info("Public read policy applied to bucket '{}'.", bucket);

        } catch (Exception e) {
            log.error("Failed to initialize MinIO bucket policy: {}", e.getMessage(), e);
        }
    }
}
