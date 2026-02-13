package com.aistylist.controller;

import com.aistylist.dto.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

// 테스트용 컨트롤러
@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> health() {
        Map<String, String> status = new HashMap<>();
        // 상태 정보
        status.put("status", "UP");
        // 서비스 정보
        status.put("service", "AI Stylist Backend");
        // 버전 정보
        status.put("version", "1.0.0");

        // 성공 응답 반환
        return ResponseEntity.ok(ApiResponse.success(status));
    }
}
