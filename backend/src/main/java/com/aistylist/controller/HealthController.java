package com.aistylist.controller;

/**
 * com/aistylist/controller/HealthController.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.dto.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> health() {
        Map<String, String> status = new HashMap<>();
        status.put("status", "UP");
        status.put("service", "AI Stylist Backend");
        status.put("version", "1.0.0");

        return ResponseEntity.ok(ApiResponse.success(status));
    }
}
