package com.aistylist.dto.style;

/**
 * com/aistylist/dto/style/HomeStyleSetItemDto.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonAlias;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class HomeStyleSetItemDto {

    private String id;
    private String title;
    private String description;
    private String gender;

    @JsonAlias({"image_url"})
    private String imageUrl;

    @JsonAlias({"purchase_url"})
    private String purchaseUrl;
    private String brand;
    private String category;
    private String price;

    @JsonAlias({"price_range"})
    private String priceRange;
    private String source;
    private List<String> tags;

    @JsonAlias({"brand_label"})
    private String brandLabel;
    private String subtitle;

    @JsonAlias({"price_label"})
    private String priceLabel;

    @JsonAlias({"source_label"})
    private String sourceLabel;
    private String tag;
}
