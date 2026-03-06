package com.example.Playbbit.service;

import java.io.File;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.example.Playbbit.config.MinioProperties;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class S3UploadService {
    private final S3Client s3Client;
    private final MinioProperties minioProperties;

    public S3UploadService(S3Client s3Client, MinioProperties minioProperties) {
        this.s3Client = s3Client;
        this.minioProperties = minioProperties;
    }

    public void uploadChunk(File file, String s3Path) {
        String contentType = "video/MP2T";
        if (file.getName().endsWith(".m3u8")) {
            contentType = "application/x-mpegURL";
        }

        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(minioProperties.getBucket())
                        .key(s3Path)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromFile(file));

        if (file.getName().endsWith(".ts")) {
            file.delete();
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
}
