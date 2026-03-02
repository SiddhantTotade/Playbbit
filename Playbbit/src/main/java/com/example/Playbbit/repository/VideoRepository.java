package com.example.Playbbit.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.Playbbit.entity.Video;

public interface VideoRepository extends JpaRepository<Video, String> {
    List<Video> findByIsPrivateFalseAndStatus(Video.VideoStatus status);

    List<Video> findByUserId(String userId);
}