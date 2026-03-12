package com.example.Playbbit.util;

public class PathUtils {

    public static String sanitizeUserId(String userId) {
        if (userId == null) {
            return "anonymous";
        }
        return userId.replace("@", "_").replace(".", "_");
    }

    public static String getS3UploadPath(String userId, String entityId) {
        return "uploads/" + sanitizeUserId(userId) + "/" + entityId;
    }
}
