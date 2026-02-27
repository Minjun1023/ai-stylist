package com.aistylist.controller;

/**
 * com/aistylist/controller/AuthController.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.dto.auth.AuthResponse;
import com.aistylist.dto.auth.ForgotPasswordRequest;
import com.aistylist.dto.auth.LoginRequest;
import com.aistylist.dto.auth.SignupCodeVerificationRequest;
import com.aistylist.dto.auth.SignupVerificationRequest;
import com.aistylist.dto.auth.ResetPasswordRequest;
import com.aistylist.dto.auth.SignupRequest;
import com.aistylist.dto.common.ApiResponse;
import com.aistylist.service.AuthService;
import com.aistylist.service.EmailVerificationService;
import com.aistylist.service.PasswordResetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final EmailVerificationService emailVerificationService;

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<AuthResponse>> signup(@Valid @RequestBody SignupRequest request) {
        log.info("회원가입 요청: {}", request.getEmail());
        AuthResponse response = authService.signup(request);
        return ResponseEntity.ok(ApiResponse.success("회원가입이 완료되었습니다", response));
    }

    @GetMapping("/signup/check-nickname")
    public ResponseEntity<ApiResponse<Boolean>> checkNickname(@RequestParam("nickname") String nickname) {
        boolean available = authService.isNicknameAvailable(nickname);
        if (available) {
            return ResponseEntity.ok(ApiResponse.success("사용 가능한 닉네임입니다.", true));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("이미 사용 중인 닉네임입니다."));
    }

    @PostMapping("/signup/verification")
    public ResponseEntity<ApiResponse<Void>> sendSignupVerificationCode(@Valid @RequestBody SignupVerificationRequest request) {
        log.info("회원가입 인증 코드 요청: {}", request.getEmail());
        emailVerificationService.sendSignupVerificationCode(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success("인증 코드가 전송되었습니다.", null));
    }

    @PostMapping("/signup/verification/confirm")
    public ResponseEntity<ApiResponse<Void>> verifySignupCode(@Valid @RequestBody SignupCodeVerificationRequest request) {
        log.info("회원가입 인증 코드 검증: {}", request.getEmail());
        emailVerificationService.ensureSignupCode(request.getEmail(), request.getCode());
        return ResponseEntity.ok(ApiResponse.success("인증코드가 확인되었습니다.", null));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        log.info("로그인 요청: {}", request.getEmail());
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("로그인에 성공했습니다", response));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request);
        return ResponseEntity.ok(ApiResponse.success(
                "가입한 이메일로 재설정 링크가 전송되었습니다.", null));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("비밀번호가 성공적으로 변경되었습니다.", null));
    }
}
