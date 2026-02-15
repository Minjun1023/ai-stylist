package com.aistylist.client;

import com.aistylist.client.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
         * Health Check
         */
        public Mono<FastApiResponse<Map<String, String>>> healthCheck() {
                return fastApiWebClient.get()
                                .uri("/health") // URL
                                .retrieve() // 검색
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<Map<String, String>>>() {
                                }) // 형식 지정
                                .doOnError(e -> log.error("상태 확인 실패: {}", e.getMessage())); // 에러 처리
        }

        /**
         * 설문 기반 퍼스널 컬러 분석
         */
        public Mono<FastApiResponse<PersonalColorAnalysisDto>> analyzeSurvey(Map<String, String> answers) {
                // 요청 데이터
                Map<String, Object> request = Map.of("answers", answers);
                // API 호출
                return fastApiWebClient.post()
                                .uri("/analyze/personal-color/survey") // URL
                                .bodyValue(request) // 요청 데이터
                                .retrieve() // 검색
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<PersonalColorAnalysisDto>>() {
                                }) // 형식 지정
                                .doOnSuccess(res -> log.info("설문 분석 완료: {}",
                                                res.getData().getColorType())) // 성공 시 로그
                                .doOnError(e -> log.error("설문 분석 실패: {}", e.getMessage())); // 에러 처리
        }

        /**
         * 이미지 기반 퍼스널 컬러 분석 (URL)
         */
        public Mono<FastApiResponse<PersonalColorAnalysisDto>> analyzeImageByUrl(String imageUrl, Long userId) {
                // 요청 데이터
                Map<String, Object> request = Map.of(
                                "image_url", imageUrl,
                                "user_id", userId);
                // API 호출
                return fastApiWebClient.post()
                                .uri("/analyze/personal-color/image") // URL
                                .bodyValue(request) // 요청 데이터
                                .retrieve() // 검색
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<PersonalColorAnalysisDto>>() {
                                }) // 형식 지정
                                .doOnSuccess(res -> log.info("이미지 분석 완료: {}",
                                                res.getData().getColorType())) // 성공 시 로그
                                .doOnError(e -> log.error("이미지 분석 실패: {}", e.getMessage())); // 에러 처리
        }

        /**
         * 이미지 업로드 및 분석
         */
        public Mono<FastApiResponse<PersonalColorAnalysisDto>> uploadAndAnalyzeImage(MultipartFile file) {
                // 파일 업로드
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
                // API 호출
                return fastApiWebClient.post()
                                .uri("/analyze/personal-color/upload-and-analyze") // URL
                                .contentType(MediaType.MULTIPART_FORM_DATA) // Content-Type
                                .body(BodyInserters.fromMultipartData(builder.build())) // 파일 데이터
                                .retrieve() // 검색
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<PersonalColorAnalysisDto>>() {
                                }) // 형식 지정
                                   // 성공 시 로그
                                .doOnSuccess(res -> log.info("이미지 업로드 및 분석 완료: {}",
                                                res.getData().getColorType()))
                                // 에러 처리
                                .doOnError(e -> log.error("이미지 업로드 및 분석 실패: {}", e.getMessage()));
        }

        /**
         * 스타일 추천 (RAG)
         */
        public Mono<FastApiResponse<StyleRecommendDto>> recommendStyle(
                        String query, // 검색어
                        String personalColor, // 퍼스널 컬러
                        String occasion, // 계절
                        Long userId // 사용자 ID
        ) {
                // 요청 데이터
                Map<String, Object> request = Map.of(
                                "query", query,
                                "personal_color", personalColor != null ? personalColor : "",
                                "occasion", occasion != null ? occasion : "",
                                "user_id", userId);
                // API 호출
                return fastApiWebClient.post()
                                .uri("/style/recommend") // URL
                                .bodyValue(request) // 요청 데이터
                                .retrieve() // 검색
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<StyleRecommendDto>>() {
                                }) // 형식 지정
                                   // 성공 시 로그
                                .doOnSuccess(res -> log.info("Style recommendation completed"))
                                // 에러 처리
                                .doOnError(e -> log.error("Style recommendation failed: {}", e.getMessage()));
        }

        /**
         * AI 채팅
         */
        public Mono<FastApiResponse<ChatDto>> chat(
                        String message, // 메시지
                        String personalColor, // 퍼스널 컬러
                        List<Map<String, String>> chatHistory, // 채팅 이력
                        Long userId) { // 사용자 ID
                // 요청 데이터
                Map<String, Object> request = Map.of(
                                "message", message,
                                "personal_color", personalColor != null ? personalColor : "",
                                "chat_history", chatHistory != null ? chatHistory : List.of(),
                                "user_id", userId);
                // API 호출
                return fastApiWebClient.post()
                                .uri("/chat") // URL
                                .bodyValue(request) // 요청 데이터
                                .retrieve() // 검색
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<ChatDto>>() {
                                }) // 형식 지정
                                   // 성공 시 로그
                                .doOnSuccess(res -> log.info("Chat response generated"))
                                // 에러 처리
                                .doOnError(e -> log.error("Chat failed: {}", e.getMessage()));
        }

        /**
         * 지식 임베딩 추가
         */
        public Mono<FastApiResponse<Map<String, Long>>> addKnowledge(
                        String content, // 내용
                        String personalColor, // 퍼스널 컬러
                        String occasion, // 계절
                        Map<String, Object> metadata) { // 메타데이터
                // 요청 데이터
                Map<String, Object> request = Map.of(
                                "content", content,
                                "personal_color", personalColor != null ? personalColor : "",
                                "occasion", occasion != null ? occasion : "",
                                "metadata", metadata != null ? metadata : Map.of());
                // API 호출
                return fastApiWebClient.post()
                                .uri("/embed") // URL
                                .bodyValue(request) // 요청 데이터
                                .retrieve() // 검색
                                .bodyToMono(new ParameterizedTypeReference<FastApiResponse<Map<String, Long>>>() {
                                }) // 형식 지정
                                   // 성공 시 로그
                                .doOnSuccess(res -> log.info("Knowledge added with id: {}", res.getData().get("id")))
                                // 에러 처리
                                .doOnError(e -> log.error("Add knowledge failed: {}", e.getMessage()));
        }
}
