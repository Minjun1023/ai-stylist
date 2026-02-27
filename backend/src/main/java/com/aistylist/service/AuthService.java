package com.aistylist.service;

/**
 * com/aistylist/service/AuthService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.auth.AuthResponse;
import com.aistylist.dto.auth.LoginRequest;
import com.aistylist.dto.auth.SignupRequest;
import com.aistylist.security.jwt.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

        private final UserRepository userRepository;
        private final PasswordEncoder passwordEncoder;
        private final AuthenticationManager authenticationManager;
        private final JwtTokenProvider tokenProvider;
        private final EmailVerificationService emailVerificationService;

        @Transactional
        public AuthResponse signup(SignupRequest request) {
                String normalizedEmail = normalizeEmail(request.getEmail());
                String normalizedPassword = normalizePassword(request.getPassword());
                String normalizedNickname = normalizeNickname(request.getNickname());
                String normalizedGender = normalizeGender(request.getGender());
                String normalizedAgeGroup = normalizeAgeGroup(request.getAgeGroup());
                String normalizedBodyType = normalizeBodyType(request.getBodyType());
                String normalizedStyleMoodPreference = normalizeStyleMoodPreference(request.getStyleMoodPreference());

                if (userRepository.existsByEmail(normalizedEmail)) {
                        throw new IllegalArgumentException("이미 사용중인 이메일입니다.");
                }
                if (userRepository.existsByNicknameIgnoreCase(normalizedNickname)) {
                        throw new IllegalArgumentException("이미 사용중인 닉네임입니다.");
                }

                emailVerificationService.verifySignupCode(normalizedEmail, request.getEmailVerificationCode());

                User user = User.builder()
                                .email(normalizedEmail)
                                .password(passwordEncoder.encode(normalizedPassword))
                                .nickname(normalizedNickname)
                                .gender(normalizedGender)
                                .ageGroup(normalizedAgeGroup)
                                .bodyType(normalizedBodyType)
                                .styleMoodPreference(normalizedStyleMoodPreference)
                                .styleProfileCompleted(Boolean.TRUE)
                                .personalColorCompleted(Boolean.FALSE)
                                .chatProfileCompleted(Boolean.FALSE)
                                .styleRecommendationCompleted(Boolean.FALSE)
                                .build();

                User savedUser = userRepository.save(user);
                emailVerificationService.consumeSignupCode(normalizedEmail, request.getEmailVerificationCode());

                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(
                                                normalizedEmail,
                                                normalizedPassword));

                String token = tokenProvider.generateToken(authentication);

                return AuthResponse.builder()
                                .accessToken(token)
                                .tokenType("Bearer")
                                .user(AuthResponse.UserInfo.builder()
                                                .id(savedUser.getId())
                                                .email(savedUser.getEmail())
                                                .nickname(savedUser.getNickname())
                                                .personalColor(savedUser.getPersonalColor())
                                                .gender(savedUser.getGender())
                                                .ageGroup(savedUser.getAgeGroup())
                                                .bodyType(savedUser.getBodyType())
                                                .styleMoodPreference(savedUser.getStyleMoodPreference())
                                                .styleProfileCompleted(savedUser.getStyleProfileCompleted())
                                                .personalColorCompleted(savedUser.getPersonalColorCompleted())
                                                .chatProfileCompleted(savedUser.getChatProfileCompleted())
                                                .styleRecommendationCompleted(savedUser.getStyleRecommendationCompleted())
                                                .createdAt(savedUser.getCreatedAt())
                                                .build())
                                .build();
        }

        @Transactional(readOnly = true)
        public AuthResponse login(LoginRequest request) {
                String normalizedEmail = normalizeEmail(request.getEmail());
                String normalizedPassword = normalizePassword(request.getPassword());

                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(
                                                normalizedEmail,
                                                normalizedPassword));

                String token = tokenProvider.generateToken(authentication);

                User user = userRepository.findByEmail(normalizedEmail)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

                return AuthResponse.builder()
                                .accessToken(token)
                                .tokenType("Bearer")
                                .user(AuthResponse.UserInfo.builder()
                                        .id(user.getId())
                                        .email(user.getEmail())
                                        .nickname(user.getNickname())
                                        .personalColor(user.getPersonalColor())
                                        .gender(user.getGender())
                                        .ageGroup(user.getAgeGroup())
                                        .bodyType(user.getBodyType())
                                        .styleMoodPreference(user.getStyleMoodPreference())
                                        .styleProfileCompleted(user.getStyleProfileCompleted())
                                        .personalColorCompleted(user.getPersonalColorCompleted())
                                        .chatProfileCompleted(user.getChatProfileCompleted())
                                        .styleRecommendationCompleted(user.getStyleRecommendationCompleted())
                                        .createdAt(user.getCreatedAt())
                                        .build())
                                .build();
        }

        @Transactional(readOnly = true)
        public boolean isNicknameAvailable(String nickname) {
                if (nickname == null) {
                        return false;
                }
                String normalizedNickname = nickname.trim();
                if (normalizedNickname.isBlank()) {
                        return false;
                }
                return !userRepository.existsByNicknameIgnoreCase(normalizedNickname);
        }

        private String normalizeEmail(String email) {
                if (email == null) {
                        throw new IllegalArgumentException("이메일은 필수입니다");
                }
                return email.trim().toLowerCase(Locale.ROOT);
        }

        private String normalizePassword(String password) {
                if (password == null) {
                        throw new BadCredentialsException("비밀번호가 일치하지 않습니다");
                }
                return password.trim();
        }

        private String normalizeNickname(String nickname) {
                if (nickname == null || nickname.trim().isEmpty()) {
                        throw new IllegalArgumentException("닉네임은 필수입니다");
                }
                return nickname.trim();
        }

        private String normalizeGender(String gender) {
                if (gender == null) {
                        throw new IllegalArgumentException("성별은 필수입니다");
                }
                String value = gender.trim().toLowerCase(Locale.ROOT);
                return switch (value) {
                        case "male", "female" -> value;
                        default -> throw new IllegalArgumentException("성별 값이 올바르지 않습니다");
                };
        }

        private String normalizeAgeGroup(String ageGroup) {
                if (ageGroup == null) {
                        throw new IllegalArgumentException("연령대는 필수입니다");
                }
                String value = ageGroup.trim().toLowerCase(Locale.ROOT);
                return switch (value) {
                        case "teens", "twenties_early", "twenties_late", "thirties_early", "thirties_late",
                                        "forties_plus" -> value;
                        default -> throw new IllegalArgumentException("연령대 값이 올바르지 않습니다");
                };
        }

        private String normalizeBodyType(String bodyType) {
                if (bodyType == null) {
                        throw new IllegalArgumentException("체형은 필수입니다");
                }
                String value = bodyType.trim().toLowerCase(Locale.ROOT);
                return switch (value) {
                        case "slim", "standard", "curvy", "muscular", "plus" -> value;
                        default -> throw new IllegalArgumentException("체형 값이 올바르지 않습니다");
                };
        }

        private String normalizeStyleMoodPreference(String styleMoodPreference) {
                if (styleMoodPreference == null) {
                        throw new IllegalArgumentException("분위기 선호는 필수입니다");
                }
                String value = styleMoodPreference.trim().toLowerCase(Locale.ROOT);
                return switch (value) {
                        case "casual", "minimal", "feminine", "chic", "street", "classic" -> value;
                        default -> throw new IllegalArgumentException("분위기 선호 값이 올바르지 않습니다");
                };
        }
}
