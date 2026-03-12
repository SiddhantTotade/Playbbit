package com.example.Playbbit.util;

public class PathUtils {

    public static final String VIDEOS_FOLDER = "playbbit-videos";
    public static final String LIVE_STREAMS_FOLDER = "playbbit-live-streams";

    public static String sanitizeUserId(String userId) {
        if (userId == null) {
            return "anonymous";
        }
        return userId.replace("@", "_").replace(".", "_");
    }

    public static String getS3UploadPath(String rootFolder, String userId, String entityId) {
        return rootFolder + "/" + sanitizeUserId(userId) + "/" + entityId;
    }
}
