package com.aistylist.dto.style;

/**
 * com/aistylist/dto/style/HomeStyleRecommendResponse.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HomeStyleRecommendResponse {

    private String recommendation;
    private List<HomeStyleRecommendSetDto> sets;
    private List<String> sources;
}
