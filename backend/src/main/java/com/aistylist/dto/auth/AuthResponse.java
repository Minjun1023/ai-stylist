package com.aistylist.dto.auth;

/**
 * com/aistylist/dto/auth/AuthResponse.java: Backend source file for style/recommendation related features.
 */

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String accessToken;
    private String tokenType;
    private UserInfo user;

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Long id;
        private String email;
        private String nickname;
        private String personalColor;
        private String gender;
        private String ageGroup;
        private String bodyType;
        private String styleMoodPreference;
        private Boolean styleProfileCompleted;
        private Boolean personalColorCompleted;
        private Boolean chatProfileCompleted;
        private Boolean styleRecommendationCompleted;
        private LocalDateTime createdAt;
    }

}
