package com.aistylist.controller;

import com.aistylist.dto.chat.ChatRequest;
import com.aistylist.dto.chat.ChatResponse;
import com.aistylist.dto.chat.ChatSessionResponse;
import com.aistylist.dto.common.ApiResponse;
import com.aistylist.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    // 채팅 세션 목록 조회
    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<ChatSessionResponse>>> getSessions(Authentication authentication) {
        String email = authentication.getName();
        log.info("채팅 세션 목록 조회: {}", email);
        List<ChatSessionResponse> sessions = chatService.getUserSessions(email);
        return ResponseEntity.ok(ApiResponse.success(sessions));
    }

    // 채팅 세션 상세 조회
    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<ChatSessionResponse>> getSession(
            Authentication authentication,
            @PathVariable Long sessionId) {
        String email = authentication.getName();
        log.info("채팅 세션 상세 조회: {}, sessionId: {}", email, sessionId);
        ChatSessionResponse session = chatService.getSession(email, sessionId);
        return ResponseEntity.ok(ApiResponse.success(session));
    }

    // 채팅
    @PostMapping
    public ResponseEntity<ApiResponse<ChatResponse>> chat(
            Authentication authentication,
            @Valid @RequestBody ChatRequest request) {
        String email = authentication.getName();
        log.info("채팅 요청: {}, message: {}", email, request.getMessage());
        ChatResponse response = chatService.chat(email, request);
        return ResponseEntity.ok(ApiResponse.success("응답이 생성되었습니다", response));
    }

    // 채팅 세션 삭제
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> deleteSession(
            Authentication authentication,
            @PathVariable Long sessionId) {
        String email = authentication.getName();
        log.info("채팅 세션 삭제: {}, sessionId: {}", email, sessionId);
        chatService.deleteSession(email, sessionId);
        return ResponseEntity.ok(ApiResponse.success("세션이 삭제되었습니다", null));
    }
}
