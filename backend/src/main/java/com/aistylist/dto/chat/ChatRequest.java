package com.aistylist.dto.chat;

/**
 * com/aistylist/dto/chat/ChatRequest.java: Backend source file for style/recommendation related features.
 */

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChatRequest {

    @NotBlank(message = "메시지는 필수입니다")
    private String message;

    private String season;

    private Long sessionId;
}
