package com.example.Playbbit.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.example.Playbbit.entity.StreamStatus;
import com.example.Playbbit.repository.StreamRepository;

import jakarta.transaction.Transactional;

@Service
public class StreamService {
    private final StreamRepository repository;
    private final StringRedisTemplate redisTemplate;

    public StreamService(StreamRepository repository, StringRedisTemplate redisTemplate) {
        this.repository = repository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public boolean startStream(String streamKey) {
        return repository.findByStreamKey(streamKey).map(stream -> {
            stream.setStatus(StreamStatus.LIVE);
            repository.save(stream);

            String jobPayload = "{\"streamId\":\"" + stream.getId() + "\", \"key\":\"" + streamKey + "\"}";
            redisTemplate.opsForList().leftPush("transcode_jobs", jobPayload);
            System.out.println("Job pushed to Redis for key: " + streamKey);
            return true;
        }).orElseGet(() -> {
            System.out.println("Stream key not found: " + streamKey);
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
