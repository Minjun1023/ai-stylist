package com.aistylist.dto.personalcolor;

import com.aistylist.domain.entity.PersonalColorResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PersonalColorResponse {

    private Long id; // ID
    private String colorType; // 컬러 타입
    private Float confidence; // 신뢰도
    private PersonalColorResult.DiagnosisMethod method; // 진단 방법
    private String imageUrl; // 이미지 URL
    private LocalDateTime createdAt; // 생성 시간
}
