package com.aistylist.service;

/**
 * com/aistylist/service/UserService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.user.UpdateProfileRequest;
import com.aistylist.dto.user.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public UserResponse getUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다"));

        return UserResponse.builder()
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
                .build();
    }

    @Transactional
    public UserResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다"));

        if (request.getNickname() != null) {
            String normalizedNickname = request.getNickname().trim();
            if (userRepository.existsByNicknameIgnoreCaseAndIdNot(normalizedNickname, user.getId())) {
                throw new IllegalArgumentException("이미 사용중인 닉네임입니다.");
            }
            user.setNickname(normalizedNickname);
        }

        if (request.getGender() != null) {
            String normalizedGender = normalizeGender(request.getGender());
            if (normalizedGender != null) {
                user.setGender(normalizedGender);
            }
        }

        if (request.getAgeGroup() != null) {
            user.setAgeGroup(request.getAgeGroup().trim().toLowerCase());
        }

        if (request.getBodyType() != null) {
            user.setBodyType(request.getBodyType().trim().toLowerCase());
        }

        if (request.getStyleMoodPreference() != null) {
            user.setStyleMoodPreference(request.getStyleMoodPreference().trim().toLowerCase());
        }

        if (user.getGender() != null && !user.getGender().isBlank()
                && user.getAgeGroup() != null && !user.getAgeGroup().isBlank()
                && user.getBodyType() != null && !user.getBodyType().isBlank()
                && user.getStyleMoodPreference() != null && !user.getStyleMoodPreference().isBlank()) {
            user.setStyleProfileCompleted(Boolean.TRUE);
        }

        User updatedUser = userRepository.save(user);

        return UserResponse.builder()
                .id(updatedUser.getId())
                .email(updatedUser.getEmail())
                .nickname(updatedUser.getNickname())
                .personalColor(updatedUser.getPersonalColor())
                .gender(updatedUser.getGender())
                .ageGroup(updatedUser.getAgeGroup())
                .bodyType(updatedUser.getBodyType())
                .styleMoodPreference(updatedUser.getStyleMoodPreference())
                .styleProfileCompleted(updatedUser.getStyleProfileCompleted())
                .personalColorCompleted(updatedUser.getPersonalColorCompleted())
                .chatProfileCompleted(updatedUser.getChatProfileCompleted())
                .styleRecommendationCompleted(updatedUser.getStyleRecommendationCompleted())
                .createdAt(updatedUser.getCreatedAt())
                .build();
    }

    private String normalizeGender(String gender) {
        if (gender == null) {
            return null;
        }

        String trimmed = gender.trim().toLowerCase(Locale.ROOT);
        if (trimmed.isBlank()) {
            return null;
        }

        return switch (trimmed) {
            case "male", "m", "man", "남", "남성", "남자", "메일" -> "male";
            case "female", "f", "woman", "women", "여", "여성", "여자", "femail" -> "female";
            case "undisclosed" -> "undisclosed";
            default -> trimmed;
        };
    }
}
