package com.aistylist.client.dto;

/**
 * com/aistylist/client/dto/PersonalColorAnalysisDto.java: Backend source file for style/recommendation related features.
 */

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.Map;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalColorAnalysisDto {

    @JsonProperty("color_type")
    private String colorType;

    private Float confidence;

    private String description;

    private ColorPaletteDto palette;

    @JsonProperty("styling_tips")
    private List<String> stylingTips;

    @JsonProperty("image_url")
    private String imageUrl;

    private List<String> evidence;

    @JsonProperty("needs_follow_up")
    private Boolean needsFollowUp;

    @JsonProperty("follow_up_questions")
    private List<Map<String, Object>> followUpQuestions;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ColorPaletteDto {
        @JsonProperty("primary_colors")
        private List<String> primaryColors;

        @JsonProperty("secondary_colors") 
        private List<String> secondaryColors;

        @JsonProperty("avoid_colors") 
        private List<String> avoidColors;
    }
}
