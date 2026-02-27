package com.aistylist.domain.repository;

/**
 * com/aistylist/domain/repository/ChatMessageRepository.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findBySessionIdOrderByCreatedAtAsc(Long sessionId);
}
