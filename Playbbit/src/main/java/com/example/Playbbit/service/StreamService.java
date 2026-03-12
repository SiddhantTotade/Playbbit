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
