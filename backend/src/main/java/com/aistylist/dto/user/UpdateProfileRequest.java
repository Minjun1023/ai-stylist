package com.aistylist.dto.user;

/**
 * com/aistylist/dto/user/UpdateProfileRequest.java: Backend source file for style/recommendation related features.
 */

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {

    @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하여야 합니다")
    private String nickname;

    @Pattern(regexp = "^(male|female|undisclosed)$", message = "성별 값이 올바르지 않습니다")
    private String gender;

    @Pattern(regexp = "^(teens|twenties_early|twenties_late|thirties_early|thirties_late|forties_plus)$", message = "연령대 값이 올바르지 않습니다")
    private String ageGroup;

    @Pattern(regexp = "^(slim|standard|curvy|muscular|plus)$", message = "체형 값이 올바르지 않습니다")
    private String bodyType;

    @Pattern(regexp = "^(casual|minimal|feminine|chic|street|classic)$", message = "분위기 선호 값이 올바르지 않습니다")
    private String styleMoodPreference;
}
