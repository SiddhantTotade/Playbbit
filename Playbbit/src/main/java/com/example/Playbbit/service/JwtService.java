package com.example.Playbbit.service;

import java.security.Key;
import java.util.Date;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;

@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    private Key key;

    @PostConstruct
    public void init() {
        if (this.secret == null || this.secret.length() < 32) {
            throw new IllegalArgumentException("JWT Secret is missing or too short! Check your .env/YAML.");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String generateToken(String email) {
        return generateToken(email, null);
    }

    public String generateToken(String email, String videoId) {
        return Jwts.builder()
                .setSubject(email)
                .claim("videoId", videoId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 7 * 24 * 60 * 60 * 1000L))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public String getEmailFromToken(String token) {
        return getClaims(token).getSubject();
    }

    public String getVideoIdFromToken(String token) {
        return (String) getClaims(token).get("videoId");
    }

    private Claims getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}