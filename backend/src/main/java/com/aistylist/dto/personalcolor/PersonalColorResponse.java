package com.aistylist.dto.personalcolor;

/**
 * com/aistylist/dto/personalcolor/PersonalColorResponse.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.client.dto.PersonalColorAnalysisDto;
import com.aistylist.domain.entity.PersonalColorResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PersonalColorResponse {

    private Long id;
    private String colorType;
    private Float confidence;
    private PersonalColorResult.DiagnosisMethod method;
    private String imageUrl;
    private String description;
    private PersonalColorAnalysisDto.ColorPaletteDto palette;
    private List<String> stylingTips;
    private List<String> evidence;
    private Boolean needsFollowUp;
    private List<FollowUpQuestion> followUpQuestions;
    private LocalDateTime createdAt;

    @Getter
    @Setter
    public static class FollowUpQuestion {
        private String id;
        private String question;
        private List<String> options;
    }
}
