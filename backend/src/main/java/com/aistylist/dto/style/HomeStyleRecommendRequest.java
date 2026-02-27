package com.aistylist.dto.style;

/**
 * com/aistylist/dto/style/HomeStyleRecommendRequest.java: Backend source file for style/recommendation related features.
 */

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HomeStyleRecommendRequest {

    @NotBlank(message = "쿼리는 필수입니다")
    private String query;

    private String season;

    private String occasion;
    private String gender;
}
