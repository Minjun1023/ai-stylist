package com.aistylist.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatResponse {

    private Long sessionId; // 세션 ID
    private Long messageId; // 메시지 ID
    private String role; // 역할
    private String content; // 내용
    private LocalDateTime createdAt; // 생성 시간
}
