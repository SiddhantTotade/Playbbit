package com.example.Playbbit.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "videos")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Video {

    @Id
    private String id;

    private String title;
    private String description;
    private String userId;
    private String userName;

    private String hlsUrl;

    @jakarta.persistence.Column(name = "is_private")
    @com.fasterxml.jackson.annotation.JsonProperty("isPrivate")
    private boolean isPrivate;

    private String thumbnailUrl;

    @Enumerated(EnumType.STRING)
    private VideoStatus status;

    private LocalDateTime createdAt;

    public enum VideoStatus {
        PENDING, TRANSCODING, PUBLISHED, FAILED
    }
}