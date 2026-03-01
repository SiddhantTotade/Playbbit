package com.example.Playbbit.entity;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;

@Entity
@Data
public class StreamEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String title;

    @Column(unique = true)
    private String streamKey;

    private String userId;

    @Enumerated(EnumType.STRING)
    private StreamStatus status;

    @Enumerated(EnumType.STRING)
    private VideoType type = VideoType.LIVE;

    @Enumerated(EnumType.STRING)
    private Visibility visibility = Visibility.PUBLIC;

    private String manifestUrl;
}