package com.aistylist.dto.style;

/**
 * com/aistylist/dto/style/StyleRecommendResponse.java: Backend source file for style/recommendation related features.
 */

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StyleRecommendResponse {

    private String recommendation;
    private List<Object> items;
    private List<String> sources;
    private String personalColor;
}
