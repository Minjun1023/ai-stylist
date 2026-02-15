package com.aistylist.controller;

import com.aistylist.dto.common.ApiResponse;
import com.aistylist.dto.style.StyleRecommendRequest;
import com.aistylist.dto.style.StyleRecommendResponse;
import com.aistylist.service.StyleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/style")
@RequiredArgsConstructor
public class StyleController {

    private final StyleService styleService;

    // 스타일 추천
    @PostMapping("/recommend")
    public ResponseEntity<ApiResponse<StyleRecommendResponse>> recommendStyle(
            Authentication authentication,
            @Valid @RequestBody StyleRecommendRequest request) {
        String email = authentication.getName();
        log.info("스타일 추천 요청: {}, query: {}", email, request.getQuery());
        StyleRecommendResponse response = styleService.recommendStyle(email, request);
        return ResponseEntity.ok(ApiResponse.success("스타일 추천이 완료되었습니다", response));
    }
}
