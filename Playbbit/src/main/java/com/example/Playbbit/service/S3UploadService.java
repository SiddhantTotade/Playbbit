package com.example.Playbbit.service;

import java.io.File;

import org.springframework.stereotype.Service;

import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class S3UploadService {
    private final S3Client s3Client;

    public S3UploadService(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    public void uploadChunk(File file, String s3Path) {
        String contentType = "video/MP2T";
        if (file.getName().endsWith(".m3u8")) {
            contentType = "application/x-mpegURL";
        }
        s3Client.putObject(
                PutObjectRequest.builder().bucket("live-streams").key(s3Path).contentType(contentType).build(),
                RequestBody.fromFile(file));

        if (file.getName().endsWith(".ts")) {

            file.delete();
        }
    }
}
