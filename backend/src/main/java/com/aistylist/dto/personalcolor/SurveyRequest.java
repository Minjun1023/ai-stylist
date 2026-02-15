package com.aistylist.dto.personalcolor;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SurveyRequest {

    @NotEmpty(message = "설문 답변은 필수입니다")
    private Map<String, String> answers; // 설문 답변
}
