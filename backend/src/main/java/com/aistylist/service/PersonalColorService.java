package com.aistylist.service;

/**
 * com/aistylist/service/PersonalColorService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.client.FastApiClient;
import com.aistylist.client.dto.FastApiResponse;
import com.aistylist.client.dto.PersonalColorAnalysisDto;
import com.aistylist.domain.entity.PersonalColorResult;
import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.PersonalColorResultRepository;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.personalcolor.PersonalColorResponse;
import com.aistylist.dto.personalcolor.SurveyRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PersonalColorService {

        private final PersonalColorResultRepository personalColorResultRepository;
        private final UserRepository userRepository;
        private final FastApiClient fastApiClient;
        private final ObjectMapper objectMapper;

        @Transactional(readOnly = true)
        public List<PersonalColorResponse> getUserResults(String email) {
                User user = findUserByEmail(email);

                return personalColorResultRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                                .stream()
                                .map(this::toResponse)
                                .collect(Collectors.toList());
        }

        @Transactional
        public PersonalColorResponse diagnoseBySurvey(String email, SurveyRequest request) {
                User user = findUserByEmail(email);

                FastApiResponse<PersonalColorAnalysisDto> aiResponse = fastApiClient
                                .analyzeSurvey(request.getAnswers())
                                .block();

                if (aiResponse == null || !aiResponse.isSuccess()) {
                        throw new RuntimeException("AI 분석에 실패했습니다");
                }

                PersonalColorAnalysisDto analysisResult = aiResponse.getData();

                PersonalColorResult result = PersonalColorResult.builder()
                                .user(user)
                                .colorType(analysisResult.getColorType())
                                .confidence(analysisResult.getConfidence())
                                .method(PersonalColorResult.DiagnosisMethod.SURVEY)
                                .surveyData(
                                                toJson(buildSurveyMetadata(request.getAnswers(), analysisResult))
                                )
                                .build();
                PersonalColorResult saved = personalColorResultRepository.save(result);

                boolean needsFollowUp = Boolean.TRUE.equals(analysisResult.getNeedsFollowUp());
                boolean hasColor = isColorAssigned(analysisResult.getColorType());
                user.setPersonalColorCompleted(false);
                if (!needsFollowUp && hasColor) {
                        user.setPersonalColor(analysisResult.getColorType());
                        user.setPersonalColorCompleted(Boolean.TRUE);
                }
                userRepository.save(user);

                return toResponseWithAnalysis(saved, analysisResult);
        }

        @Transactional
        public PersonalColorResponse diagnoseByImage(String email, MultipartFile image) {
                User user = findUserByEmail(email);

                FastApiResponse<PersonalColorAnalysisDto> aiResponse = fastApiClient
                                .uploadAndAnalyzeImage(image)
                                .block();

                if (aiResponse == null || !aiResponse.isSuccess()) {
                        throw new RuntimeException("이미지 분석에 실패했습니다");
                }

                PersonalColorAnalysisDto analysisResult = aiResponse.getData();

                PersonalColorResult result = PersonalColorResult.builder()
                                .user(user)
                                .colorType(analysisResult.getColorType())
                                .confidence(analysisResult.getConfidence())
                                .method(PersonalColorResult.DiagnosisMethod.IMAGE)
                                .imageUrl(analysisResult.getImageUrl())
                                .surveyData(toJson(buildImageMetadata(analysisResult)))
                                .build();

                PersonalColorResult saved = personalColorResultRepository.save(result);

                user.setPersonalColor(analysisResult.getColorType());
                user.setPersonalColorCompleted(Boolean.TRUE);
                userRepository.save(user);

                return toResponseWithAnalysis(saved, analysisResult);
        }

        private User findUserByEmail(String email) {
                return userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
        }

        private PersonalColorResponse toResponse(PersonalColorResult result) {
                return PersonalColorResponse.builder()
                                .id(result.getId())
                                .colorType(result.getColorType())
                                .confidence(result.getConfidence())
                                .method(result.getMethod())
                                .imageUrl(result.getImageUrl())
                                .createdAt(result.getCreatedAt())
                                .description(getStoredAnalysisText(result.getSurveyData(), "description"))
                                .evidence(getStoredEvidence(result.getSurveyData()))
                                .needsFollowUp(getStoredNeedsFollowUp(result.getSurveyData()))
                                .followUpQuestions(toFollowUpQuestions(
                                                getStoredFollowUpQuestions(result.getSurveyData())))
                                .build();
        }

        private PersonalColorResponse toResponseWithAnalysis(
                        PersonalColorResult result,
                        PersonalColorAnalysisDto analysis) {
                return PersonalColorResponse.builder()
                                .id(result.getId())
                                .colorType(result.getColorType())
                                .confidence(result.getConfidence())
                                .method(result.getMethod())
                                .imageUrl(result.getImageUrl())
                                .description(analysis.getDescription())
                                .palette(analysis.getPalette())
                                .stylingTips(analysis.getStylingTips())
                                .evidence(analysis.getEvidence())
                                .needsFollowUp(analysis.getNeedsFollowUp())
                                .followUpQuestions(toFollowUpQuestions(analysis.getFollowUpQuestions()))
                                .createdAt(result.getCreatedAt())
                                .build();
        }

        private Map<String, Object> buildSurveyMetadata(
                        Map<String, String> answers,
                        PersonalColorAnalysisDto analysis) {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("method", "survey");
                payload.put("answers", answers);
                payload.put("analysis", buildAnalysisPayload(analysis));
                return payload;
        }

        private Map<String, Object> buildImageMetadata(PersonalColorAnalysisDto analysis) {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("method", "image");
                payload.put("analysis", buildAnalysisPayload(analysis));
                return payload;
        }

        private Map<String, Object> buildAnalysisPayload(PersonalColorAnalysisDto analysis) {
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("colorType", analysis.getColorType());
                payload.put("confidence", analysis.getConfidence());
                payload.put("description", analysis.getDescription());
                payload.put("evidence", analysis.getEvidence());
                payload.put("needsFollowUp", analysis.getNeedsFollowUp());
                payload.put("followUpQuestions", analysis.getFollowUpQuestions());
                payload.put("palette", analysis.getPalette());
                payload.put("stylingTips", analysis.getStylingTips());
                return payload;
        }

        private List<PersonalColorResponse.FollowUpQuestion> toFollowUpQuestions(List<Map<String, Object>> followUpQuestions) {
                if (followUpQuestions == null || followUpQuestions.isEmpty()) {
                        return null;
                }

                return followUpQuestions.stream()
                                .map(q -> {
                                        PersonalColorResponse.FollowUpQuestion item = new PersonalColorResponse.FollowUpQuestion();
                                        Object id = q.get("id");
                                        Object question = q.get("question");
                                        Object options = q.get("options");

                                        item.setId(id != null ? id.toString() : null);
                                        item.setQuestion(question != null ? question.toString() : null);

                                        if (options instanceof List<?>) {
                                                item.setOptions(((List<?>) options).stream()
                                                                .map(Object::toString)
                                                                .collect(Collectors.toList()));
                                        }

                                        return item;
                                })
                                .collect(Collectors.toList());
        }

        private String getStoredAnalysisText(String surveyData, String fieldName) {
                Object value = getStoredAnalysis(surveyData).get(fieldName);
                if (value == null) {
                        return null;
                }
                return value.toString();
        }

        private Boolean getStoredNeedsFollowUp(String surveyData) {
                Object value = getStoredAnalysis(surveyData).get("needsFollowUp");
                if (value == null) {
                        return null;
                }
                if (value instanceof Boolean) {
                        return (Boolean) value;
                }
                return Boolean.parseBoolean(value.toString());
        }

        private boolean isColorAssigned(String colorType) {
                return colorType != null && !colorType.isBlank();
        }

        private List<String> getStoredEvidence(String surveyData) {
                Object evidence = getStoredAnalysis(surveyData).get("evidence");
                if (evidence instanceof List<?>) {
                        List<?> evidenceList = (List<?>) evidence;
                        List<String> normalized = evidenceList.stream()
                                        .filter(Objects::nonNull)
                                        .map(Object::toString)
                                        .collect(Collectors.toList());
                        if (!normalized.isEmpty()) {
                                return normalized;
                        }
                }
                return Collections.emptyList();
        }

        @SuppressWarnings("unchecked")
        private List<Map<String, Object>> getStoredFollowUpQuestions(String surveyData) {
                Object followUp = getStoredAnalysis(surveyData).get("followUpQuestions");
                if (!(followUp instanceof List<?>)) {
                        return null;
                }
                List<Map<String, Object>> followUpQuestions = new ArrayList<>();
                ((List<?>) followUp).forEach(item -> {
                        if (item instanceof Map<?, ?> mapItem) {
                                Map<String, Object> casted = new LinkedHashMap<>();
                                mapItem.forEach((key, value) -> casted.put(key != null ? key.toString() : "", value));
                                followUpQuestions.add(casted);
                        }
                });

                return followUpQuestions.isEmpty() ? null : followUpQuestions;
        }

        private Map<String, Object> getStoredAnalysis(String surveyData) {
                if (surveyData == null || surveyData.isBlank()) {
                        return Collections.emptyMap();
                }

                Map<String, Object> root;
                try {
                        root = objectMapper.readValue(surveyData, new TypeReference<Map<String, Object>>() {});
                } catch (Exception e) {
                        return Collections.emptyMap();
                }

                Object analysis = root.get("analysis");
                if (analysis instanceof Map<?, ?> analysisMap) {
                        Map<String, Object> normalized = new LinkedHashMap<>();
                        analysisMap.forEach((key, value) -> normalized.put(key != null ? key.toString() : "", value));
                        return normalized;
                }

                return Collections.emptyMap();
        }

        private String toJson(Object obj) {
                try {
                        return objectMapper.writeValueAsString(obj);
                } catch (JsonProcessingException e) {
                        return "{}";
                }
        }
}
