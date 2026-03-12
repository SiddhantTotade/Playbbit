package com.example.Playbbit.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import com.example.Playbbit.config.MinioProperties;
import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthCheckController {
    private final S3Client s3Client;
    private final MinioProperties minioProperties;

    public HealthCheckController(S3Client s3Client, MinioProperties minioProperties) {
        this.s3Client = s3Client;
        this.minioProperties = minioProperties;
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        Map<String, Object> result = new HashMap<>();
        String bucket = minioProperties.getBucket();
        result.put("bucket", bucket);
        try {
            ListObjectsV2Response resp = s3Client.listObjectsV2(
                    ListObjectsV2Request.builder()
                            .bucket(bucket)
                            .maxKeys(5)
                            .build());
            result.put("objectCount", resp.keyCount());
            result.put("objects", resp.contents().stream().map(s -> s.key()).toList());
            result.put("status", "OK");
        } catch (Exception e) {
            result.put("status", "ERROR");
            result.put("error", e.getMessage());
        }
        return result;
    }
}
