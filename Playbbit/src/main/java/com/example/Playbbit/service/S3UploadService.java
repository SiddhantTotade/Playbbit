package com.example.Playbbit.service;

import java.io.File;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class S3UploadService {
    private final S3Client s3Client;
    private final String BUCKET = "live-streams";

    public S3UploadService(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    public void uploadChunk(File file, String s3Path) {
        try {
            System.out.println("Attempting upload to MinIO: " + s3Path);
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket("live-streams")
                            .key(s3Path)
                            .contentType(file.getName().endsWith(".m3u8") ? "application/x-mpegURL" : "video/MP2T")
                            .build(),
                    RequestBody.fromFile(file));

            System.out.println("SUCCESS: Uploaded " + s3Path);
            if (file.getName().endsWith(".ts")) {
                file.delete();
            }
        } catch (Exception e) {
            System.err.println("CRITICAL ERROR: MinIO Upload Failed: " + e.getMessage());
        }
    }

    public void uploadMultipartFile(MultipartFile file, String s3Path) throws Exception {
        uploadToS3(RequestBody.fromInputStream(file.getInputStream(), file.getSize()),
                s3Path, file.getContentType());
    }

    private void uploadToS3(RequestBody body, String key, String contentType) {
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(BUCKET)
                        .key(key)
                        .contentType(contentType)
                        .build(),
                body);
    }
}
