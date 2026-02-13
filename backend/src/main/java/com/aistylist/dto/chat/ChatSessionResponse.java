package com.aistylist.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatSessionResponse {

    private Long id; // ID
    private String title; // 제목
    private LocalDateTime createdAt; // 생성 시간
    private List<ChatResponse> messages; // 메시지 리스트
}
