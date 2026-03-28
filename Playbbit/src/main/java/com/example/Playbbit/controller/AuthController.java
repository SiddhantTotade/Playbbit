package com.example.Playbbit.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.Playbbit.entity.User;
import com.example.Playbbit.repository.UserRepository;
import com.example.Playbbit.service.JwtService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@org.springframework.web.bind.annotation.CrossOrigin(origins = "http://localhost:3000")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        String name = body.get("name");

        System.out.println("Register attempt for email: " + email);

        if (userRepository.findByEmail(email).isPresent()) {
            System.out.println("Registration failed: Email already exists: " + email);
            return ResponseEntity.badRequest().body(Map.of("message", "Email already exists"));
        }

        User newUser = User.builder()
                .email(email)
                .name(name)
                .password(passwordEncoder.encode(password))
                .provider("LOCAL")
                .build();

        userRepository.save(newUser);
        System.out.println("User registered successfully: " + email);
        return ResponseEntity.ok(Map.of("message", "User registered successfully"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body, HttpServletResponse response) {
        String email = body.get("email");
        String password = body.get("password");

        System.out.println("Login attempt for email: " + email);

        return userRepository.findByEmail(email)
                .map(user -> {
                    System.out.println("Processing login for: " + email);
                    System.out.println("Incoming password length: " + (password != null ? password.length() : 0));
                    boolean matches = passwordEncoder.matches(password, user.getPassword());
                    System.out.println("Password match result: " + matches);
                    if (matches) {
                       System.out.println("Login successful for email: " + email);
                        String token = jwtService.generateToken(user.getEmail());
                        
                        // Set session cookie for media players (HLS requests)
                        Cookie sessionCookie = new Cookie("playbbit_session", token);
                        sessionCookie.setPath("/");
                        sessionCookie.setHttpOnly(true);
                        sessionCookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
                        response.addCookie(sessionCookie);

                        Map<String, Object> userMap = Map.of(
                                "id", user.getId(),
                                "name", user.getName() != null ? user.getName() : "",
                                "email", user.getEmail());
                        return ResponseEntity.ok(Map.of("token", token, "user", userMap));
                    }
                    System.out.println("Login failed: Invalid credentials for email: " + email);
                    return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials"));
                })
                .orElseGet(() -> {
                    System.out.println("Login failed: User not found: " + email);
                    return ResponseEntity.status(404).body(Map.of("message", "User not found"));
                });
    }
}