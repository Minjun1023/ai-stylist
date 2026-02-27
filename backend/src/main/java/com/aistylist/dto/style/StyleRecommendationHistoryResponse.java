package com.aistylist.dto.style;

/**
 * com/aistylist/dto/style/StyleRecommendationHistoryResponse.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StyleRecommendationHistoryResponse {

    private String query;
    private String occasion;
    private String gender;
    private String recommendation;
    private String personalColor;
    private List<Object> items;
    private List<String> sources;
    private LocalDateTime createdAt;
}
