package com.aistylist.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 메시지 ID

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private ChatSession session; // 채팅 세션

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private Role role; // 메시지 역할

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content; // 메시지 내용

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt; // 생성 시간

    public enum Role {
        USER,
        ASSISTANT,
        SYSTEM
    }
}
