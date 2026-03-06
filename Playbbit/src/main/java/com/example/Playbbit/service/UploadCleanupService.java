package com.example.Playbbit.service;

import java.io.File;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class UploadCleanupService {

    private static final String UPLOAD_DIR = "temp-uploads/";

    @Scheduled(cron = "0 0 0 * * *")
    public void cleanAbandonedUploads() {
        File folder = new File(UPLOAD_DIR);

        if (!folder.exists()) {
            return;
        }

        File[] files = folder.listFiles();

        if (files != null) {
            for (File file : files) {
                long diff = System.currentTimeMillis() - file.lastModified();
                if (diff > 2 * 24 * 60 * 60 * 1000) {
                    boolean deleted = file.delete();
                    if (deleted) {
                        System.out.println("Cleaned up abandoned upload file: " + file.getName());
                    }
                }
            }
        }
    }
}