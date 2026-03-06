export const getMediaUrl = (path: string | null | undefined): string => {
    if (!path) return "/thumb-placeholder.jpg";

    const MINIO_BASE = (process.env.NEXT_PUBLIC_MINIO_URL || "http://localhost:9000/live-streams").replace(/\/$/, "");

    // 1. If it's an absolute URL
    if (path.startsWith("http://") || path.startsWith("https://")) {
        let result = path;
        // Fix old bucket names
        if (result.includes("localhost:9000/playbbit-bucket")) {
            result = result.replace("localhost:9000/playbbit-bucket", "localhost:9000/live-streams");
        }
        // Fix double-prefixed buckets (e.g. /live-streams/live-streams/)
        if (result.includes("/live-streams/live-streams/")) {
            result = result.replace("/live-streams/live-streams/", "/live-streams/");
        }
        return result;
    }

    // 2. If it's a relative path
    let cleanPath = path.startsWith("/") ? path.substring(1) : path;

    // Fix double bucket in relative path as well
    if (cleanPath.startsWith("live-streams/live-streams/")) {
        cleanPath = cleanPath.substring("live-streams/".length);
    }

    // Standard bucket prefix removal for construction
    if (cleanPath.startsWith("live-streams/")) {
        cleanPath = cleanPath.substring("live-streams/".length);
    }

    return `${MINIO_BASE}/${cleanPath}`;
};
