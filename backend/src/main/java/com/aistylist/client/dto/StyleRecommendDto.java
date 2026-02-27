package com.aistylist.client.dto;

/**
 * com/aistylist/client/dto/StyleRecommendDto.java: Backend source file for style/recommendation related features.
 */

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StyleRecommendDto {

    private String recommendation;
    private List<Object> items;
    private List<String> sources;
}
