package com.aistylist.security.jwt;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String jwtSecret; // JWT 시크릿 키

    @Value("${jwt.expiration}")
    private long jwtExpiration; // JWT 만료 시간

    private SecretKey key; // JWT 시크릿 키

    // 서버 실행 시 자동 키 생성
    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    // JWT 토큰 생성
    public String generateToken(Authentication authentication) {
        // 인증된 사용자의 이메일 추출
        String email = authentication.getName();
        // 현재 시간과 만료 시간 설정
        Date now = new Date();
        // 만료 시간 설정
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        // JWT 토큰 생성
        return Jwts.builder()
                .subject(email) // JWT 토큰의 주제 설정
                .issuedAt(now) // JWT 토큰의 발급 시간 설정
                .expiration(expiryDate) // JWT 토큰의 만료 시간 설정
                .signWith(key) // JWT 토큰의 서명 설정
                .compact(); // JWT 토큰 생성
    }

    // JWT 토큰에서 이메일 추출
    public String getEmailFromToken(String token) {
        // JWT 토큰의 서명 검증
        Claims claims = Jwts.parser()
                .verifyWith(key) // JWT 토큰의 서명 검증
                .build()
                .parseSignedClaims(token) // JWT 토큰의 서명 검증
                .getPayload(); // JWT 토큰의 payload 추출

        // JWT 토큰의 주제 추출
        return claims.getSubject();
    }

    // JWT 토큰 유효성 검사
    public boolean validateToken(String token) {
        try {
            Jwts.parser() // JWT 토큰의 서명 검증
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token); // JWT 토큰의 서명 검증
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            // JWT 토큰의 서명 검증 실패
            log.error("유효하지 않은 JWT 토큰: {}", e.getMessage());
            return false;
        }
    }
}
