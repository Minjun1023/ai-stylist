package com.aistylist.controller;

import com.aistylist.dto.common.ApiResponse;
import com.aistylist.dto.personalcolor.PersonalColorResponse;
import com.aistylist.dto.personalcolor.SurveyRequest;
import com.aistylist.service.PersonalColorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/personal-color")
@RequiredArgsConstructor
public class PersonalColorController {

    private final PersonalColorService personalColorService;

    // 퍼스널 컬러 결과 조회
    @GetMapping("/results")
    public ResponseEntity<ApiResponse<List<PersonalColorResponse>>> getResults(Authentication authentication) {
        String email = authentication.getName();
        log.info("퍼스널 컬러 결과 조회: {}", email);
        List<PersonalColorResponse> results = personalColorService.getUserResults(email);
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    // 설문 기반 퍼스널 컬러 진단
    @PostMapping("/survey")
    public ResponseEntity<ApiResponse<PersonalColorResponse>> diagnoseBySurvey(
            Authentication authentication,
            @Valid @RequestBody SurveyRequest request) {
        String email = authentication.getName();
        log.info("설문 기반 퍼스널 컬러 진단: {}", email);
        PersonalColorResponse response = personalColorService.diagnoseBySurvey(email, request);
        return ResponseEntity.ok(ApiResponse.success("진단이 완료되었습니다", response));
    }

    // 이미지 기반 퍼스널 컬러 진단
    @PostMapping("/image")
    public ResponseEntity<ApiResponse<PersonalColorResponse>> diagnoseByImage(
            Authentication authentication,
            @RequestParam("image") MultipartFile image) {
        String email = authentication.getName();
        log.info("이미지 기반 퍼스널 컬러 진단: {}", email);
        PersonalColorResponse response = personalColorService.diagnoseByImage(email, image);
        return ResponseEntity.ok(ApiResponse.success("진단이 완료되었습니다", response));
    }
}
