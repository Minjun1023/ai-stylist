package com.aistylist.controller;

/**
 * com/aistylist/controller/UserController.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.dto.common.ApiResponse;
import com.aistylist.dto.user.UpdateProfileRequest;
import com.aistylist.dto.user.UserResponse;
import com.aistylist.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        log.info("현재 사용자 정보 조회: {}", email);
        UserResponse response = userService.getUserByEmail(email);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> updateProfile(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request) {
        String email = authentication.getName();
        log.info("프로필 업데이트 요청: {}", email);
        UserResponse response = userService.updateProfile(email, request);
        return ResponseEntity.ok(ApiResponse.success("프로필이 업데이트되었습니다", response));
    }
}
