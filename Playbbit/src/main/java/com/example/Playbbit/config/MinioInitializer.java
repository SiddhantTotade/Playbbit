package com.example.Playbbit.config;

import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;

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
            // Verify bucket contents for debugging
            try {
                ListObjectsV2Response listResponse = s3Client
                        .listObjectsV2(software.amazon.awssdk.services.s3.model.ListObjectsV2Request.builder()
                                .bucket(bucket)
                                .maxKeys(10)
                                .build());
                if (listResponse.hasContents()) {
                    log.info("Bucket '{}' contains {} objects (showing up to 10):", bucket,
                            listResponse.contents().size());
                    listResponse.contents().forEach(obj -> log.info(" - {}", obj.key()));
                } else {
                    log.info("Bucket '{}' is currently empty.", bucket);
                }
            } catch (Exception e) {
                log.warn("Failed to list objects in bucket '{}': {}", bucket, e.getMessage());
            }

        } catch (Exception e) {
            log.error("Failed to initialize MinIO bucket policy: {}", e.getMessage(), e);
        }
    }
}
