package com.aistylist.dto.style;

/**
 * com/aistylist/dto/style/StyleRecommendRequest.java: Backend source file for style/recommendation related features.
 */

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class StyleRecommendRequest {

    @NotBlank(message = "질문은 필수입니다")
    private String query;

    private String season;

    @Pattern(regexp = "^(|male|female)$", message = "성별 값이 올바르지 않습니다")
    private String gender;

    private String occasion;
}
