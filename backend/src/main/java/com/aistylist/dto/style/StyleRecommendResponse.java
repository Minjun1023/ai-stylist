package com.aistylist.dto.style;

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

    private String recommendation; // 추천
    private List<Object> items; // 아이템
    private List<String> sources; // 소스
    private String personalColor; // 퍼스널 컬러
}
