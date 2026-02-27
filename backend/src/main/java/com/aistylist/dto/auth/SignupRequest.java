package com.aistylist.dto.auth;

/**
 * com/aistylist/dto/auth/SignupRequest.java: Backend source file for style/recommendation related features.
 */

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SignupRequest {

    @NotBlank(message = "이메일은 필수입니다")
    @Email(message = "올바른 이메일 형식이 아닙니다")
    private String email;

    @NotBlank(message = "비밀번호는 필수입니다")
    @Size(min = 8, max = 64, message = "비밀번호는 8자 이상 64자 이하여야 합니다")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).+$", message = "비밀번호는 영문 대/소문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다")
    private String password;

    @NotBlank(message = "닉네임은 필수입니다")
    @Size(min = 2, max = 20, message = "닉네임은 2자 이상 20자 이하여야 합니다")
    private String nickname;

    @NotBlank(message = "성별은 필수입니다")
    @Pattern(regexp = "^(male|female)$", message = "성별 값이 올바르지 않습니다")
    private String gender;

    @NotBlank(message = "연령대는 필수입니다")
    @Pattern(regexp = "^(teens|twenties_early|twenties_late|thirties_early|thirties_late|forties_plus)$", message = "연령대 값이 올바르지 않습니다")
    private String ageGroup;

    @NotBlank(message = "체형은 필수입니다")
    @Pattern(regexp = "^(slim|standard|curvy|muscular|plus)$", message = "체형 값이 올바르지 않습니다")
    private String bodyType;

    @NotBlank(message = "분위기 선호는 필수입니다")
    @Pattern(regexp = "^(casual|minimal|feminine|chic|street|classic)$", message = "분위기 선호 값이 올바르지 않습니다")
    private String styleMoodPreference;

    @NotBlank(message = "이메일 인증코드는 필수입니다")
    private String emailVerificationCode;
}
