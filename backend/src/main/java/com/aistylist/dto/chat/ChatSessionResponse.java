package com.aistylist.dto.chat;

/**
 * com/aistylist/dto/chat/ChatSessionResponse.java: Backend source file for style/recommendation related features.
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
public class ChatSessionResponse {

    private Long id;
    private String title;
    private LocalDateTime createdAt;
    private List<ChatResponse> messages;
}
