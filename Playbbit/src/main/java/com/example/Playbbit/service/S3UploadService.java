package com.example.Playbbit.service;

import java.io.File;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.example.Playbbit.config.MinioProperties;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.util.List;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class S3UploadService {
    private final S3Client s3Client;
    private final MinioProperties minioProperties;

    public S3UploadService(S3Client s3Client, MinioProperties minioProperties) {
        this.s3Client = s3Client;
        this.minioProperties = minioProperties;
    }

    public boolean uploadChunk(File file, String s3Path) {
        try {
            String contentType = "video/MP2T";
            if (file.getName().endsWith(".m3u8")) {
                contentType = "application/x-mpegURL";
            } else if (file.getName().endsWith(".vtt")) {
                contentType = "text/vtt";
            }

            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(minioProperties.getBucket())
                            .key(s3Path)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromFile(file));
            log.info(">>> S3 UPLOAD SUCCESS for {} in bucket {}", s3Path, minioProperties.getBucket());

            // Commented out to allow serving from local disk during live stream
            // if (file.getName().endsWith(".ts") && file.exists()) {
            // file.delete();
            // }
            return true;
        } catch (Exception e) {
            log.error(">>> S3 UPLOAD FAILED for {}: {} bucket: {}", s3Path, e.getMessage(),
                    minioProperties.getBucket());
            return false;
        }
    }

    public void uploadMultipartFile(MultipartFile file, String s3Path) throws Exception {
        uploadToS3(RequestBody.fromInputStream(file.getInputStream(), file.getSize()),
                s3Path, file.getContentType());
    }

    private void uploadToS3(RequestBody body, String key, String contentType) {
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(minioProperties.getBucket())
                        .key(key)
                        .contentType(contentType)
                        .build(),
                body);
    }

    public void deleteFolder(String prefix) {
        try {
            // 1. List all objects with prefix
            software.amazon.awssdk.services.s3.model.ListObjectsV2Response listResponse = s3Client.listObjectsV2(
                    software.amazon.awssdk.services.s3.model.ListObjectsV2Request.builder()
                            .bucket(minioProperties.getBucket())
                            .prefix(prefix)
                            .build());

            if (listResponse.hasContents()) {
                // 2. Map contents to ObjectIdentifiers
                java.util.List<software.amazon.awssdk.services.s3.model.ObjectIdentifier> ids = listResponse.contents()
                        .stream()
                        .map(obj -> software.amazon.awssdk.services.s3.model.ObjectIdentifier.builder().key(obj.key())
                                .build())
                        .collect(java.util.stream.Collectors.toList());

                // 3. Perform bulk delete
                s3Client.deleteObjects(
                        software.amazon.awssdk.services.s3.model.DeleteObjectsRequest.builder()
                                .bucket(minioProperties.getBucket())
                                .delete(software.amazon.awssdk.services.s3.model.Delete.builder().objects(ids).build())
                                .build());
            }
        } catch (Exception e) {
            System.err.println("Error deleting S3 folder: " + e.getMessage());
        }
    }
}
