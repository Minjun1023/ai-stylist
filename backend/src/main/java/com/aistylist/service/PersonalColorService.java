package com.aistylist.service;

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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PersonalColorService {

        private final PersonalColorResultRepository personalColorResultRepository;
        private final UserRepository userRepository;
        private final FastApiClient fastApiClient;
        private final ObjectMapper objectMapper;

        // 사용자 결과 조회
        @Transactional(readOnly = true)
        public List<PersonalColorResponse> getUserResults(String email) {
                User user = findUserByEmail(email);

                return personalColorResultRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                                .stream()
                                .map(this::toResponse)
                                .collect(Collectors.toList());
        }

        // 퍼스널 컬러 진단
        @Transactional
        public PersonalColorResponse diagnoseBySurvey(String email, SurveyRequest request) {
                User user = findUserByEmail(email);

                // FastAPI 호출
                FastApiResponse<PersonalColorAnalysisDto> aiResponse = fastApiClient
                                .analyzeSurvey(request.getAnswers())
                                .block();

                // 응답 처리
                if (aiResponse == null || !aiResponse.isSuccess()) {
                        throw new RuntimeException("AI 분석에 실패했습니다");
                }

                // 응답 데이터
                PersonalColorAnalysisDto analysisResult = aiResponse.getData();

                // 결과 저장
                PersonalColorResult result = PersonalColorResult.builder()
                                .user(user) // 사용자
                                .colorType(analysisResult.getColorType()) // 컬러 타입
                                .confidence(analysisResult.getConfidence()) // 신뢰도
                                .method(PersonalColorResult.DiagnosisMethod.SURVEY) // 진단 방법
                                .surveyData(toJson(request.getAnswers())) // 설문 데이터
                                .build();
                // 결과 저장
                PersonalColorResult saved = personalColorResultRepository.save(result);

                // 사용자 퍼스널 컬러 업데이트
                user.setPersonalColor(analysisResult.getColorType());
                userRepository.save(user);

                // 응답 반환
                return toResponseWithAnalysis(saved, analysisResult);
        }

        // 이미지 분석
        @Transactional
        public PersonalColorResponse diagnoseByImage(String email, MultipartFile image) {
                User user = findUserByEmail(email);

                // FastAPI 호출 (이미지 업로드 및 분석)
                FastApiResponse<PersonalColorAnalysisDto> aiResponse = fastApiClient
                                .uploadAndAnalyzeImage(image)
                                .block();

                // 응답 처리
                if (aiResponse == null || !aiResponse.isSuccess()) {
                        throw new RuntimeException("이미지 분석에 실패했습니다");
                }

                // 응답 데이터
                PersonalColorAnalysisDto analysisResult = aiResponse.getData();

                // 결과 저장
                PersonalColorResult result = PersonalColorResult.builder()
                                .user(user) // 사용자
                                .colorType(analysisResult.getColorType()) // 컬러 타입
                                .confidence(analysisResult.getConfidence()) // 신뢰도
                                .method(PersonalColorResult.DiagnosisMethod.IMAGE) // 진단 방법
                                .imageUrl(analysisResult.getImageUrl()) // 이미지 URL
                                .build();

                // 결과 저장
                PersonalColorResult saved = personalColorResultRepository.save(result);

                // 사용자 퍼스널 컬러 업데이트
                user.setPersonalColor(analysisResult.getColorType());
                userRepository.save(user);

                // 응답 반환
                return toResponseWithAnalysis(saved, analysisResult);
        }

        // 사용자 조회
        private User findUserByEmail(String email) {
                return userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
        }

        // 응답 변환
        private PersonalColorResponse toResponse(PersonalColorResult result) {
                return PersonalColorResponse.builder()
                                .id(result.getId()) // ID
                                .colorType(result.getColorType()) // 컬러 타입
                                .confidence(result.getConfidence()) // 신뢰도
                                .method(result.getMethod()) // 진단 방법
                                .imageUrl(result.getImageUrl()) // 이미지 URL
                                .createdAt(result.getCreatedAt()) // 생성 시간
                                .build();
        }

        // 응답 변환
        private PersonalColorResponse toResponseWithAnalysis(
                        PersonalColorResult result,
                        PersonalColorAnalysisDto analysis) {
                return PersonalColorResponse.builder()
                                .id(result.getId()) // ID
                                .colorType(result.getColorType()) // 컬러 타입
                                .confidence(result.getConfidence()) // 신뢰도
                                .method(result.getMethod()) // 진단 방법
                                .imageUrl(result.getImageUrl()) // 이미지 URL
                                .description(analysis.getDescription()) // 설명
                                .palette(analysis.getPalette()) // 팔레트
                                .stylingTips(analysis.getStylingTips()) // 스타일링 팁
                                .createdAt(result.getCreatedAt()) // 생성 시간
                                .build();
        }

        // JSON 변환
        private String toJson(Object obj) {
                try {
                        return objectMapper.writeValueAsString(obj); // JSON 변환
                } catch (JsonProcessingException e) {
                        return "{}";
                }
        }
}