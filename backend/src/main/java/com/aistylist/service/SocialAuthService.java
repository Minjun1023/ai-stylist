package com.aistylist.service;

/**
 * com/aistylist/service/SocialAuthService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SocialAuthService {

    private static final int NICKNAME_MAX_LENGTH = 20;
    private static final int SOCIAL_SUFFIX_LENGTH = 4;
    private static final String SOCIAL_SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;

    public User findOrCreateUser(String provider, Map<String, Object> attributes) {
        String normalizedEmail = normalizeEmail(resolveLoginEmail(provider, attributes));
        if (normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("소셜 계정 식별 정보를 가져올 수 없습니다.");
        }

        Optional<User> existing = userRepository.findByEmail(normalizedEmail);
        if (existing.isPresent()) {
            return existing.get();
        }

        String nickname = generateUniqueSocialNickname(extractNickname(provider, attributes), normalizedEmail);

        User user = User.builder()
                .email(normalizedEmail)
                .nickname(nickname)
                .password(new BCryptPasswordEncoder().encode(UUID.randomUUID().toString()))
                .gender("undisclosed")
                .ageGroup(null)
                .bodyType(null)
                .styleMoodPreference(null)
                .styleProfileCompleted(Boolean.FALSE)
                .personalColorCompleted(Boolean.FALSE)
                .chatProfileCompleted(Boolean.FALSE)
                .styleRecommendationCompleted(Boolean.FALSE)
                .build();

        return userRepository.save(user);
    }

    private String resolveLoginEmail(String provider, Map<String, Object> attributes) {
        return switch (provider) {
            case "google" -> stringValue(attributes.get("email"));
            case "kakao" -> kakaoPseudoEmail(attributes);
            case "naver" -> stringValue(mapValue(attributes.get("response")).get("email"));
            default -> "";
        };
    }

    private String kakaoPseudoEmail(Map<String, Object> attributes) {
        String kakaoId = stringValue(attributes.get("id"));
        if (kakaoId.isBlank()) {
            return "";
        }
        return "kakao_" + kakaoId + "@social.local";
    }

    private String extractNickname(String provider, Map<String, Object> attributes) {
        return switch (provider) {
            case "google" -> firstNonBlank(
                    stringValue(attributes.get("name")),
                    stringValue(attributes.get("given_name"))
            );
            case "kakao" -> {
                Map<String, Object> kakaoAccount = mapValue(attributes.get("kakao_account"));
                Map<String, Object> profile = mapValue(kakaoAccount.get("profile"));
                yield firstNonBlank(
                        stringValue(profile.get("nickname")),
                        stringValue(kakaoAccount.get("name"))
                );
            }
            case "naver" -> {
                Map<String, Object> response = mapValue(attributes.get("response"));
                yield firstNonBlank(
                        stringValue(response.get("nickname")),
                        stringValue(response.get("name"))
                );
            }
            default -> "";
        };
    }

    private String generateUniqueSocialNickname(String sourceNickname, String email) {
        String emailLocal = email.contains("@") ? email.substring(0, email.indexOf('@')) : email;
        String base = sanitizeNickname(firstNonBlank(sourceNickname, emailLocal));
        if (base.isBlank()) {
            base = "user";
        }

        int maxBaseLength = Math.max(1, NICKNAME_MAX_LENGTH - SOCIAL_SUFFIX_LENGTH);
        if (base.length() > maxBaseLength) {
            base = base.substring(0, maxBaseLength);
        }
        if (base.length() < 2) {
            base = (base + "user");
            base = base.substring(0, Math.min(base.length(), maxBaseLength));
        }

        String candidate = base + randomSuffix();
        while (userRepository.existsByNicknameIgnoreCase(candidate)) {
            candidate = base + randomSuffix();
        }
        return candidate;
    }

    private String randomSuffix() {
        StringBuilder builder = new StringBuilder(SOCIAL_SUFFIX_LENGTH);
        for (int i = 0; i < SOCIAL_SUFFIX_LENGTH; i++) {
            int index = RANDOM.nextInt(SOCIAL_SUFFIX_CHARS.length());
            builder.append(SOCIAL_SUFFIX_CHARS.charAt(index));
        }
        return builder.toString();
    }

    private String sanitizeNickname(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().replaceAll("[^\\p{L}\\p{N}_-]", "");
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String stringValue(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapValue(Object value) {
        if (value instanceof Map<?, ?> rawMap) {
            return (Map<String, Object>) rawMap;
        }
        return Map.of();
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first.trim();
        }
        return second == null ? "" : second.trim();
    }
}
