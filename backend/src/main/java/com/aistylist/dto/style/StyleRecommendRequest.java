package com.aistylist.dto.style;

import jakarta.validation.constraints.NotBlank;
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
    private String query; // 질문

    private String occasion; // 상황
}
