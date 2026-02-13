package com.aistylist.service;

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.auth.AuthResponse;
import com.aistylist.dto.auth.LoginRequest;
import com.aistylist.dto.auth.SignupRequest;
import com.aistylist.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final AuthenticationManager authenticationManager;
        private final JwtTokenProvider tokenProvider;

        @Transactional
        public AuthResponse signup(SignupRequest request) {
                // 이메일 중복 체크
                if (userRepository.existsByEmail(request.getEmail())) {
                        throw new IllegalArgumentException("이미 사용중인 이메일입니다.");
                }

                // 사용자 생성
                User user = User.builder()
                                .email(request.getEmail())
                                .password(passwordEncoder.encode(request.getPassword()))
                                .nickname(request.getNickname())
                                .build();

                User savedUser = userRepository.save(user);

                // JWT 토큰 생성
                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(
                                                request.getEmail(),
                                                request.getPassword()));

                String token = tokenProvider.generateToken(authentication);

                return AuthResponse.builder()
                                .accessToken(token)
                                .tokenType("Bearer")
                                .user(AuthResponse.UserInfo.builder()
                                                .id(savedUser.getId())
                                                .email(savedUser.getEmail())
                                                .nickname(savedUser.getNickname())
                                                .personalColor(savedUser.getPersonalColor())
                                                .build())
                                .build();
        }

        @Transactional(readOnly = true)
        public AuthResponse login(LoginRequest request) {
                // 인증
                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(
                                                request.getEmail(),
                                                request.getPassword()));

                // JWT 토큰 생성
                String token = tokenProvider.generateToken(authentication);

                // 사용자 정보 조회
                User user = userRepository.findByEmail(request.getEmail())
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

                return AuthResponse.builder()
                                .accessToken(token)
                                .tokenType("Bearer")
                                .user(AuthResponse.UserInfo.builder()
                                                .id(user.getId())
                                                .email(user.getEmail())
                                                .nickname(user.getNickname())
                                                .personalColor(user.getPersonalColor())
                                                .build())
                                .build();
        }
}
