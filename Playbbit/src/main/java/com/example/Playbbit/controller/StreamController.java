package com.example.Playbbit.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.Playbbit.service.StreamService;

@RestController
public class StreamController {
    private final StreamService streamService;

    public StreamController(StreamService streamService) {
        this.streamService = streamService;
    }

    @PostMapping("/validate")
    public ResponseEntity<Void> validateStream(@RequestParam("name") String streamKey) {
        boolean isValid = streamService.startStream(streamKey);
        if (isValid) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.status(403).build();
        }
    }

    @PostMapping("/done")
    public void stopStream(@RequestParam("name") String streamKey) {
        streamService.stopStream(streamKey);
    }
}
