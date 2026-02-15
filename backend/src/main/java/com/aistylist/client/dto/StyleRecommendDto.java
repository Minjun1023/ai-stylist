package com.aistylist.client.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StyleRecommendDto {

    private String recommendation; // 추천
    private List<Object> items; // 아이템
    private List<String> sources; // 소스
}
