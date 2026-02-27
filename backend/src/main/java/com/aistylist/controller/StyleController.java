package com.aistylist.controller;

/**
 * com/aistylist/controller/StyleController.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.dto.common.ApiResponse;
import com.aistylist.dto.style.HomeStyleRecommendRequest;
import com.aistylist.dto.style.HomeStyleRecommendResponse;
import com.aistylist.dto.style.StyleRecommendationHistoryResponse;
import com.aistylist.dto.style.StyleRecommendRequest;
import com.aistylist.dto.style.StyleRecommendResponse;
import com.aistylist.service.StyleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/style")
@RequiredArgsConstructor
public class StyleController {

    private final StyleService styleService;

    @PostMapping("/recommend")
    public ResponseEntity<ApiResponse<StyleRecommendResponse>> recommendStyle(
            Authentication authentication,
            @Valid @RequestBody StyleRecommendRequest request) {
        String email = authentication.getName();
        log.info("스타일 추천 요청: {}, query: {}", email, request.getQuery());
        StyleRecommendResponse response = styleService.recommendStyle(email, request);
        return ResponseEntity.ok(ApiResponse.success("스타일 추천이 완료되었습니다", response));
    }

    @PostMapping("/recommend/guest")
    public ResponseEntity<ApiResponse<StyleRecommendResponse>> recommendGuestStyle(@Valid @RequestBody StyleRecommendRequest request) {
        log.info("비로그인 스타일 추천 요청: query: {}", request.getQuery());
        StyleRecommendResponse response = styleService.recommendGuestStyle(request);
        return ResponseEntity.ok(ApiResponse.success("비로그인 스타일 추천이 완료되었습니다", response));
    }

    @PostMapping("/home")
    public ResponseEntity<ApiResponse<HomeStyleRecommendResponse>> recommendHomeStyle(
            Authentication authentication,
            @Valid @RequestBody HomeStyleRecommendRequest request) {
        String email = authentication.getName();
        log.info("홈 추천 요청: {}, query: {}", email, request.getQuery());
        HomeStyleRecommendResponse response = styleService.recommendHomeStyle(email, request);
        return ResponseEntity.ok(ApiResponse.success("홈 스타일 추천이 완료되었습니다", response));
    }

    @PostMapping("/home/guest")
    public ResponseEntity<ApiResponse<HomeStyleRecommendResponse>> recommendHomeGuestStyle(
            @Valid @RequestBody HomeStyleRecommendRequest request) {
        log.info("비로그인 홈 추천 요청: query: {}", request.getQuery());
        HomeStyleRecommendResponse response = styleService.recommendHomeGuestStyle(request);
        return ResponseEntity.ok(ApiResponse.success("비로그인 홈 스타일 추천이 완료되었습니다", response));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<List<StyleRecommendationHistoryResponse>>> getRecentStyleRecommendations(
            Authentication authentication,
            @RequestParam(name = "limit", defaultValue = "10") int limit
    ) {
        String email = authentication.getName();
        List<StyleRecommendationHistoryResponse> response = styleService.getRecentRecommendations(email, limit);
        return ResponseEntity.ok(ApiResponse.success("저장된 스타일 추천 목록을 조회했습니다", response));
    }
}
