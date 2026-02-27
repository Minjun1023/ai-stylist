package com.aistylist.dto.user;

/**
 * com/aistylist/dto/user/UserResponse.java: Backend source file for style/recommendation related features.
 */

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Builder
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
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
