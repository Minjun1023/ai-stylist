package com.aistylist.dto.chat;

/**
 * com/aistylist/dto/chat/ChatResponse.java: Backend source file for style/recommendation related features.
 */

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
public class ChatResponse {

    private Long sessionId;
    private Long messageId;
    private String role;
    private String content;
    private List<String> sources;
    private List<Object> items;
    private LocalDateTime createdAt;
}
