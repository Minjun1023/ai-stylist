package com.aistylist.service;

import com.aistylist.client.FastApiClient;
import com.aistylist.client.dto.ChatDto;
import com.aistylist.client.dto.FastApiResponse;
import com.aistylist.domain.entity.ChatMessage;
import com.aistylist.domain.entity.ChatSession;
import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.ChatSessionRepository;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.chat.ChatRequest;
import com.aistylist.dto.chat.ChatResponse;
import com.aistylist.dto.chat.ChatSessionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

        private final ChatSessionRepository chatSessionRepository;
        private final UserRepository userRepository;
        private final FastApiClient fastApiClient;

        // 사용자 세션 조회
        @Transactional(readOnly = true)
        public List<ChatSessionResponse> getUserSessions(String email) {
                User user = findUserByEmail(email);
                // 사용자 ID로 세션 조회
                return chatSessionRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                                .stream()
                                .map(this::toSessionResponse)
                                .collect(Collectors.toList());
        }

        // 세션 조회
        @Transactional(readOnly = true)
        public ChatSessionResponse getSession(String email, Long sessionId) {
                User user = findUserByEmail(email);
                // 세션 ID로 세션 조회
                ChatSession session = chatSessionRepository.findById(sessionId)
                                .orElseThrow(() -> new IllegalArgumentException("세션을 찾을 수 없습니다"));

                // 본인 세션인지 확인
                if (!session.getUser().getId().equals(user.getId())) {
                        throw new IllegalArgumentException("접근 권한이 없습니다");
                }
                // 세션 ID로 세션 조회
                return toSessionResponseWithMessages(session);
        }

        // 대화 생성
        @Transactional
        public ChatResponse chat(String email, ChatRequest request) {
                User user = findUserByEmail(email);

                // 세션 가져오거나 생성
                ChatSession session;
                // 세션 있으면 가져오기
                if (request.getSessionId() != null) {
                        session = chatSessionRepository.findById(request.getSessionId())
                                        .orElseThrow(() -> new IllegalArgumentException("세션을 찾을 수 없습니다"));
                        // 본인 세션인지 확인
                        if (!session.getUser().getId().equals(user.getId())) {
                                throw new IllegalArgumentException("접근 권한이 없습니다");
                        }
                        // 세션 없으면 생성
                } else {
                        session = ChatSession.builder()
                                        .user(user)// 사용자
                                        .title(generateTitle(request.getMessage()))// 제목
                                        .build();
                        session = chatSessionRepository.save(session);// 저장
                }

                // 사용자 메시지 저장
                ChatMessage userMessage = ChatMessage.builder()
                                .session(session)// 세션
                                .role(ChatMessage.Role.USER)// 사용자
                                .content(request.getMessage())// 메시지
                                .build();
                session.getMessages().add(userMessage);// 메시지 추가

                // 이전 대화 내역 구성
                List<Map<String, String>> chatHistory = session.getMessages().stream()
                                .map(msg -> Map.of(
                                                "role", msg.getRole().name().toLowerCase(),
                                                "content", msg.getContent()))
                                .collect(Collectors.toList());

                // FastAPI 호출
                FastApiResponse<ChatDto> aiResponse = fastApiClient
                                .chat(
                                                request.getMessage(), // 사용자 메시지
                                                user.getPersonalColor(), // 개인 컬러
                                                chatHistory, // 이전 대화 내역
                                                user.getId()// 사용자 ID
                                )
                                .block();
                // 응답 확인
                if (aiResponse == null || !aiResponse.isSuccess()) {
                        throw new RuntimeException("AI 응답 생성에 실패했습니다");
                }
                // 응답 데이터
                ChatDto chatResult = aiResponse.getData();

                // AI 응답 저장
                ChatMessage assistantMessage = ChatMessage.builder()
                                .session(session)// 세션
                                .role(ChatMessage.Role.ASSISTANT)// AI
                                .content(chatResult.getResponse())// 응답
                                .build();
                session.getMessages().add(assistantMessage);// 메시지 추가

                chatSessionRepository.save(session);

                return ChatResponse.builder()
                                .sessionId(session.getId())// 세션 ID
                                .messageId(assistantMessage.getId())// 메시지 ID
                                .role("assistant")// AI
                                .content(chatResult.getResponse())// 응답
                                .sources(chatResult.getSources())// 소스
                                .createdAt(assistantMessage.getCreatedAt())// 생성 시간
                                .build();
        }

        // 세션 삭제
        @Transactional
        public void deleteSession(String email, Long sessionId) {
                User user = findUserByEmail(email);
                // 세션 ID로 세션 조회
                ChatSession session = chatSessionRepository.findById(sessionId)
                                .orElseThrow(() -> new IllegalArgumentException("세션을 찾을 수 없습니다"));

                // 본인 세션인지 확인
                if (!session.getUser().getId().equals(user.getId())) {
                        throw new IllegalArgumentException("접근 권한이 없습니다");
                }

                chatSessionRepository.delete(session);// 삭제
        }

        // 사용자 조회
        private User findUserByEmail(String email) {
                return userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
        }

        // 제목 생성
        private String generateTitle(String message) {
                if (message.length() > 30) {
                        return message.substring(0, 30) + "...";
                }
                return message;
        }

        // 채팅방 목록
        private ChatSessionResponse toSessionResponse(ChatSession session) {
                return ChatSessionResponse.builder()
                                .id(session.getId())// 세션 ID
                                .title(session.getTitle())// 제목
                                .createdAt(session.getCreatedAt())// 생성 시간
                                .build();
        }

        // 채팅방 상세 조회
        private ChatSessionResponse toSessionResponseWithMessages(ChatSession session) {
                List<ChatResponse> messages = session.getMessages().stream()
                                .map(msg -> ChatResponse.builder()
                                                .sessionId(session.getId())// 세션 ID
                                                .messageId(msg.getId())// 메시지 ID
                                                .role(msg.getRole().name().toLowerCase())// 역할
                                                .content(msg.getContent())// 내용
                                                .createdAt(msg.getCreatedAt())// 생성 시간
                                                .build())
                                .collect(Collectors.toList());

                return ChatSessionResponse.builder()
                                .id(session.getId())// 세션 ID
                                .title(session.getTitle())// 제목
                                .createdAt(session.getCreatedAt())// 생성 시간
                                .messages(messages)// 메시지
                                .build();
        }
}
