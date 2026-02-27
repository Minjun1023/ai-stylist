package com.aistylist.domain.repository;

/**
 * com/aistylist/domain/repository/ChatSessionRepository.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {
    List<ChatSession> findByUserIdOrderByCreatedAtDesc(Long userId);
}
