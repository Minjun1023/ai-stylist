package com.aistylist.dto.style;

/**
 * com/aistylist/dto/style/HomeStyleRecommendSetDto.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HomeStyleRecommendSetDto {

    private String id;
    private String title;
    private String summary;
    private String tag;
    private List<HomeStyleSetItemDto> items;
}
