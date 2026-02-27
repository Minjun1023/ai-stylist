package com.aistylist.client.dto;

/**
 * com/aistylist/client/dto/ChatDto.java: Backend source file for style/recommendation related features.
 */

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatDto {

    private String response;
    private List<String> sources;
    private List<Object> items;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InferredProfileDto {
        @JsonProperty("gender")
        private String gender;
        @JsonProperty("age_group")
        private String ageGroup;
        @JsonProperty("body_type")
        private String bodyType;
        @JsonProperty("style_mood_preference")
        private String styleMoodPreference;
        @JsonProperty("confidence")
        private Double confidence;
    }

    @JsonProperty("inferred_profile")
    private InferredProfileDto inferredProfile;
}
