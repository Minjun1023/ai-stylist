package com.aistylist.client.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalColorAnalysisDto {

    @JsonProperty("color_type") // 컬러 타입
    private String colorType;

    private Float confidence; // 신뢰도

    private String description; // 설명

    private ColorPaletteDto palette; // 컬러 팔레트

    @JsonProperty("styling_tips") // 스타일 팁
    private List<String> stylingTips;

    @JsonProperty("image_url") // 이미지 URL
    private String imageUrl;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ColorPaletteDto {
        @JsonProperty("primary_colors") // 주요 컬러
        private List<String> primaryColors;

        @JsonProperty("secondary_colors") // 보조 컬러
        private List<String> secondaryColors;

        @JsonProperty("avoid_colors") // 피하는 컬러
        private List<String> avoidColors;
    }
}
