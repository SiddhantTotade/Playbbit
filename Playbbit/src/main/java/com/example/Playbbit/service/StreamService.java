package com.example.Playbbit.service;

import com.example.Playbbit.util.PathUtils;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.example.Playbbit.entity.StreamStatus;
import com.example.Playbbit.repository.StreamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import jakarta.transaction.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class StreamService {
    private final StreamRepository repository;
    private final StringRedisTemplate redisTemplate;

    @Transactional
    public boolean startStream(String streamKey) {
        return repository.findByStreamKey(streamKey).map(stream -> {
            String lockKey = "stream_lock:" + streamKey;
            Boolean isLocked = redisTemplate.opsForValue().setIfAbsent(lockKey, "locked",
                    java.time.Duration.ofMinutes(1));

            if (isLocked == null || !isLocked) {
                log.info("Stream {} is already being processed (lock exists), skipping", streamKey);
                return true;
            }
            log.info("Stream {} lock ACQUIRED for processing", streamKey);

            if (stream.getStatus() == StreamStatus.LIVE) {
                log.info("Stream {} is already LIVE in DB, skipping job push", streamKey);
                // We keep the lock for a while to prevent race conditions during state
                // transition
                return true;
            }
            stream.setStatus(StreamStatus.LIVE);
            // Consistent manifest URL pointing to our proxy
            stream.setManifestUrl("/api/live/proxy/" + stream.getId() + "/index.m3u8");
            repository.save(stream);

            String userId = stream.getUserId();
            String jobPayload = String.format(
                    "{\"streamId\":\"%s\", \"key\":\"%s\", \"userId\":\"%s\"}",
                    stream.getId(), streamKey, userId);

            redisTemplate.opsForList().leftPush("transcode_jobs_v2", jobPayload);
            log.info("Job pushed to Redis for key: {} with payload: {}", streamKey, jobPayload);
            return true;
        }).orElseGet(() -> {
            log.error("Stream key not found: {}", streamKey);
            return false;
        });
    }

    @Transactional
    public void stopStream(String streamKey) {
        repository.findByStreamKey(streamKey).ifPresent(stream -> {
            stream.setStatus(StreamStatus.VOD);
            repository.save(stream);
        });
    }

}
