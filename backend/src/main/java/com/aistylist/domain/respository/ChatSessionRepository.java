package com.aistylist.domain.respository;

import com.aistylist.domain.entity.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {
    List<ChatSession> findByUserIdOrderByCreatedAtDesc(Long userId); // 사용자 ID로 채팅 세션 목록 조회 (최신순)
}
