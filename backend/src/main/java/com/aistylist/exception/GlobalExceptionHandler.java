package com.aistylist.exception;

import com.aistylist.dto.common.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 잘못된 요청으로 인한 오류 처리
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<?>> handleIllegalArgumentException(
            IllegalArgumentException ex, WebRequest request) {
        log.error("잘못된 요청: ", ex);

        // ErrorDetails 생성
        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("BAD_REQUEST")
                .detail(ex.getMessage())
                .path(request.getDescription(false))
                .build();

        // 응답 생성
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage(), error));
    }

    // 가입되지 않은 계정으로 로그인 시도 시 오류 처리
    @ExceptionHandler(UsernameNotFoundException.class)
    public ResponseEntity<ApiResponse<?>> handleUsernameNotFoundException(
            UsernameNotFoundException ex, WebRequest request) {
        log.error("가입되지 않은 계정으로 로그인 시도: ", ex);

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("USER_NOT_FOUND")
                .detail(ex.getMessage())
                .path(request.getDescription(false))
                .build();

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("사용자를 찾을 수 없습니다", error));
    }

    // 비밀번호가 일치하지 않을 때 오류 처리
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<?>> handleBadCredentialsException(
            BadCredentialsException ex, WebRequest request) {
        log.error("비밀번호가 일치하지 않습니다: ", ex);

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("INVALID_CREDENTIALS")
                .detail("이메일 또는 비밀번호가 올바르지 않습니다")
                .path(request.getDescription(false))
                .build();

        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("인증에 실패했습니다", error));
    }

    // 입력 값이 올바르지 않을 때 오류 처리
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<?>> handleValidationException(
            MethodArgumentNotValidException ex, WebRequest request) {
        log.error("입력 값이 올바르지 않습니다: ", ex);

        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("VALIDATION_ERROR")
                .detail(errors.toString())
                .path(request.getDescription(false))
                .build();

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("입력 값이 올바르지 않습니다", error));
    }

    // 서버 오류 처리
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleGlobalException(
            Exception ex, WebRequest request) {
        log.error("서버 오류가 발생했습니다: ", ex);

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("INTERNAL_SERVER_ERROR")
                .detail(ex.getMessage())
                .path(request.getDescription(false))
                .build();

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("서버 오류가 발생했습니다", error));
    }
}
