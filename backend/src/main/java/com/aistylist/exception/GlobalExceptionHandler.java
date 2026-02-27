package com.aistylist.exception;

/**
 * com/aistylist/exception/GlobalExceptionHandler.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.dto.common.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<?>> handleIllegalArgumentException(
            IllegalArgumentException ex, WebRequest request) {
        log.error("잘못된 요청: ", ex);

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("BAD_REQUEST")
                .detail(ex.getMessage())
                .path(request.getDescription(false))
                .build();

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ex.getMessage(), error));
    }

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
                .body(ApiResponse.error("이메일 또는 비밀번호가 올바르지 않습니다", error));
    }

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

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<?>> handleIllegalStateException(
            IllegalStateException ex, WebRequest request) {
        log.error("외부 서비스 오류: ", ex);

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("EXTERNAL_SERVICE_ERROR")
                .detail(ex.getMessage())
                .path(request.getDescription(false))
                .build();

        return ResponseEntity
                .status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error("외부 서비스 처리 중 오류가 발생했습니다", error));
    }

    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<ApiResponse<?>> handleNullPointerException(
            NullPointerException ex, WebRequest request) {
        log.error("널 포인터 오류: ", ex);

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("EXTERNAL_SERVICE_ERROR")
                .detail(ex.getMessage())
                .path(request.getDescription(false))
                .build();

        return ResponseEntity
                .status(HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error("외부 데이터 처리 중 오류가 발생했습니다", error));
    }

    @ExceptionHandler({WebClientRequestException.class, WebClientResponseException.class})
    public ResponseEntity<ApiResponse<?>> handleWebClientException(
            Exception ex, WebRequest request) {
        log.error("외부 API 연동 오류: ", ex);

        ApiResponse.ErrorDetails error = ApiResponse.ErrorDetails.builder()
                .code("EXTERNAL_API_ERROR")
                .detail(ex.getMessage())
                .path(request.getDescription(false))
                .build();

        HttpStatus status = HttpStatus.BAD_GATEWAY;
        String message = "외부 AI API 호출에 실패했습니다";

        if (ex instanceof WebClientResponseException responseException) {
            status = HttpStatus.valueOf(responseException.getStatusCode().value());
            String detail = responseException.getResponseBodyAsString();
            if (detail != null && !detail.isBlank()) {
                error = ApiResponse.ErrorDetails.builder()
                        .code("EXTERNAL_API_ERROR")
                        .detail(detail)
                        .path(request.getDescription(false))
                        .build();
            }
        }

        return ResponseEntity
                .status(status.is4xxClientError() || status.is5xxServerError() ? status : HttpStatus.BAD_GATEWAY)
                .body(ApiResponse.error(message, error));
    }

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
