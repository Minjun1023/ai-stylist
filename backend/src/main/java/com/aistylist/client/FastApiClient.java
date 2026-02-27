/**
 * FastApiClient handles communication with the AI service API for style/chat/style-recommend endpoints.
 */
package com.aistylist.client;

import com.aistylist.client.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.aistylist.dto.style.HomeStyleRecommendResponse;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class FastApiClient {

        private final WebClient fastApiWebClient;

        /**
         * 상대 체크(서비스 상태 확인)
         */
        public Mono<FastApiResponse<Map<String, String>>> healthCheck() {
                return fastApiWebClient.get()
                                .uri("/health")
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<Map<String, String>>>() {
                                })
                                .doOnError(e -> log.error("상태 확인 실패: {}", e.getMessage()));
        }

        /**
         * 설문 기반 퍼스널 컬러 분석
         */
        public Mono<FastApiResponse<PersonalColorAnalysisDto>> analyzeSurvey(Map<String, String> answers) {
                Map<String, Object> request = Map.of("answers", answers);
                return fastApiWebClient.post()
                                .uri("/analyze/personal-color/survey")
                                .bodyValue(request)
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<PersonalColorAnalysisDto>>() {
                                })
                                .doOnSuccess(res -> log.info("설문 분석 완료: {}",
                                                res.getData().getColorType()))
                                .doOnError(e -> log.error("설문 분석 실패: {}", e.getMessage()));
        }

        /**
         * 이미지 기반 퍼스널 컬러 분석 (URL)
         */
        public Mono<FastApiResponse<PersonalColorAnalysisDto>> analyzeImageByUrl(String imageUrl, Long userId) {
                Map<String, Object> request = Map.of(
                                "image_url", imageUrl,
                                "user_id", userId);
                return fastApiWebClient.post()
                                .uri("/analyze/personal-color/image")
                                .bodyValue(request)
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<PersonalColorAnalysisDto>>() {
                                })
                                .doOnSuccess(res -> log.info("이미지 분석 완료: {}",
                                                res.getData().getColorType()))
                                .doOnError(e -> log.error("이미지 분석 실패: {}", e.getMessage()));
        }

        /**
         * 이미지 업로드 및 분석
         */
        public Mono<FastApiResponse<PersonalColorAnalysisDto>> uploadAndAnalyzeImage(MultipartFile file) {
                MultipartBodyBuilder builder = new MultipartBodyBuilder();
                try {
                        builder.part("file", new ByteArrayResource(file.getBytes()) {
                                @Override
                                public String getFilename() {
                                        return file.getOriginalFilename();
                                }
                        }).contentType(MediaType.parseMediaType(
                                        file.getContentType() != null ? file.getContentType() : "image/jpeg"));
                } catch (IOException e) {
                        return Mono.error(new RuntimeException("이미지 업로드 실패", e));
                }
                return fastApiWebClient.post()
                                .uri("/analyze/personal-color/upload-and-analyze")
                                .contentType(MediaType.MULTIPART_FORM_DATA)
                                .body(BodyInserters.fromMultipartData(builder.build()))
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<PersonalColorAnalysisDto>>() {
                                })
                                .doOnSuccess(res -> log.info("이미지 업로드 및 분석 완료: {}", res.getData().getColorType()))
                                .doOnError(e -> log.error("이미지 업로드 및 분석 실패: {}", e.getMessage()));
        }

        /**
         * 스타일 추천 (RAG)
         */
        public Mono<FastApiResponse<StyleRecommendDto>> recommendStyle(
                        String query,
                        String season,
                        String personalColor,
                        String gender,
                        String ageGroup,
                        String bodyType,
                        String styleMoodPreference,
                        String occasion,
                        Long userId
        ) {
                Map<String, Object> request = Map.of(
                                "query", query,
                                "season", season != null ? season : "",
                                "personal_color", personalColor != null ? personalColor : "",
                                "gender", gender != null ? gender : "",
                                "age_group", ageGroup != null ? ageGroup : "",
                                "body_type", bodyType != null ? bodyType : "",
                                "style_mood_preference", styleMoodPreference != null ? styleMoodPreference : "",
                                "occasion", occasion != null ? occasion : "",
                                "user_id", userId);
                return fastApiWebClient.post()
                                .uri("/style/recommend")
                                .bodyValue(request)
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<StyleRecommendDto>>() {
                                })
                                .doOnSuccess(res -> log.info("스타일 추천 완료"))
                                .doOnError(e -> log.error("스타일 추천 실패: {}", e.getMessage()));
        }

        /**
         * 홈 화면용 코디 추천
         */
        public Mono<FastApiResponse<HomeStyleRecommendResponse>> recommendHomeStyle(
                        String query,
                        String season,
                        String personalColor,
                        String gender,
                        String ageGroup,
                        String bodyType,
                        String styleMoodPreference,
                        String occasion,
                        Long userId
        ) {
                Map<String, Object> request = Map.of(
                                "query", query,
                                "season", season != null ? season : "",
                                "personal_color", personalColor != null ? personalColor : "",
                                "gender", gender != null ? gender : "",
                                "age_group", ageGroup != null ? ageGroup : "",
                                "body_type", bodyType != null ? bodyType : "",
                                "style_mood_preference", styleMoodPreference != null ? styleMoodPreference : "",
                                "occasion", occasion != null ? occasion : "",
                                "user_id", userId);
                return fastApiWebClient.post()
                                .uri("/style/home")
                                .bodyValue(request)
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<HomeStyleRecommendResponse>>() {
                                })
                                .doOnSuccess(res -> log.info("홈 추천 완료"))
                                .doOnError(e -> log.error("홈 추천 실패: {}", e.getMessage()));
        }

        /**
         * AI 채팅
         */
        public Mono<FastApiResponse<ChatDto>> chat(
                        String message,
                        String season,
                        String personalColor,
                        String gender,
                        String ageGroup,
                        String bodyType,
                        String styleMoodPreference,
                        List<Map<String, String>> chatHistory,
                        Long userId) {
                Map<String, Object> request = Map.of(
                                "message", message,
                                "season", season != null ? season : "",
                                "personal_color", personalColor != null ? personalColor : "",
                                "gender", gender != null ? gender : "",
                                "age_group", ageGroup != null ? ageGroup : "",
                                "body_type", bodyType != null ? bodyType : "",
                                "style_mood_preference", styleMoodPreference != null ? styleMoodPreference : "",
                                "chat_history", chatHistory != null ? chatHistory : List.of(),
                                "user_id", userId);
                return fastApiWebClient.post()
                                .uri("/chat")
                                .bodyValue(request)
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<ChatDto>>() {
                                })
                                .doOnSuccess(res -> log.info("Chat response generated"))
                                .doOnError(e -> log.error("Chat failed: {}", e.getMessage()));
        }

        /**
         * 지식 임베딩 추가
         */
        public Mono<FastApiResponse<Map<String, Long>>> addKnowledge(
                        String content,
                        String personalColor,
                        String occasion,
                        Map<String, Object> metadata) {
                Map<String, Object> request = Map.of(
                                "content", content,
                                "personal_color", personalColor != null ? personalColor : "",
                                "occasion", occasion != null ? occasion : "",
                                "metadata", metadata != null ? metadata : Map.of());
                return fastApiWebClient.post()
                                .uri("/embed")
                                .bodyValue(request)
                                .retrieve()
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<Map<String, Long>>>() {
                                })
                                .doOnSuccess(res -> log.info("지식 추가 완료: {}", res.getData().get("id")))
                                .doOnError(e -> log.error("지식 추가 실패: {}", e.getMessage()));
        }
}
