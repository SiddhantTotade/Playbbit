package com.example.Playbbit.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.Playbbit.entity.StreamEntity;

public interface StreamRepository extends JpaRepository<StreamEntity, UUID> {
    Optional<StreamEntity> findByStreamKey(String streamKey);

}
