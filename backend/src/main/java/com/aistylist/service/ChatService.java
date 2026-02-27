package com.aistylist.service;

/**
 * com/aistylist/service/ChatService.java: Backend source file for style/recommendation related features.
 */

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
import java.util.Set;
import java.util.Locale;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

        private static final Set<String> ALLOWED_GENDERS = Set.of("male", "female");
        private static final Set<String> ALLOWED_AGE_GROUPS = Set.of(
                        "teens",
                        "twenties_early",
                        "twenties_late",
                        "thirties_early",
                        "thirties_late",
                        "forties_plus"
        );
        private static final Set<String> ALLOWED_BODY_TYPES = Set.of("slim", "standard", "curvy", "muscular", "plus");
        private static final Set<String> ALLOWED_STYLE_MOOD = Set.of(
                        "casual",
                        "minimal",
                        "feminine",
                        "chic",
                        "street",
                        "classic"
        );

        private final ChatSessionRepository chatSessionRepository;
        private final UserRepository userRepository;
        private final FastApiClient fastApiClient;

        @Transactional(readOnly = true)
        public List<ChatSessionResponse> getUserSessions(String email) {
                User user = findUserByEmail(email);
                return chatSessionRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                                .stream()
                                .map(this::toSessionResponse)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public ChatSessionResponse getSession(String email, Long sessionId) {
                User user = findUserByEmail(email);
                ChatSession session = chatSessionRepository.findById(sessionId)
                                .orElseThrow(() -> new IllegalArgumentException("세션을 찾을 수 없습니다"));

                if (!session.getUser().getId().equals(user.getId())) {
                        throw new IllegalArgumentException("접근 권한이 없습니다");
                }
                return toSessionResponseWithMessages(session);
        }

        @Transactional
        public ChatResponse chat(String email, ChatRequest request) {
                User user = findUserByEmail(email);

                ChatSession session;
                if (request.getSessionId() != null) {
                        session = chatSessionRepository.findById(request.getSessionId())
                                        .orElseThrow(() -> new IllegalArgumentException("세션을 찾을 수 없습니다"));
                        if (!session.getUser().getId().equals(user.getId())) {
                                throw new IllegalArgumentException("접근 권한이 없습니다");
                        }
                } else {
                        session = ChatSession.builder()
                                        .user(user)
                                        .title(generateTitle(request.getMessage()))
                                        .build();
                        session = chatSessionRepository.save(session);
                }

                ChatMessage userMessage = ChatMessage.builder()
                                .session(session)
                                .role(ChatMessage.Role.USER)
                                .content(request.getMessage())
                                .build();
                session.getMessages().add(userMessage);

                List<Map<String, String>> chatHistory = session.getMessages().stream()
                                .map(msg -> Map.of(
                                                "role", msg.getRole().name().toLowerCase(),
                                                "content", msg.getContent()))
                                .collect(Collectors.toList());

                FastApiResponse<ChatDto> aiResponse = fastApiClient
                                .chat(
                                                request.getMessage(),
                                                request.getSeason(),
                                                user.getPersonalColor(),
                                                user.getGender(),
                                                user.getAgeGroup(),
                                                user.getBodyType(),
                                                user.getStyleMoodPreference(),
                                                chatHistory,
                                                user.getId()
                                )
                                .block();
                if (aiResponse == null || !aiResponse.isSuccess()) {
                        throw new RuntimeException("AI 응답 생성에 실패했습니다");
                }
                ChatDto chatResult = aiResponse.getData();
                applyInferredProfile(chatResult.getInferredProfile(), user);

                ChatMessage assistantMessage = ChatMessage.builder()
                                .session(session)
                                .role(ChatMessage.Role.ASSISTANT)
                                .content(chatResult.getResponse())
                                .build();
                session.getMessages().add(assistantMessage);

                chatSessionRepository.save(session);
                user.setChatProfileCompleted(Boolean.TRUE);
                userRepository.save(user);

                return ChatResponse.builder()
                                .sessionId(session.getId())
                                .messageId(assistantMessage.getId())
                                .role("assistant")
                                .content(chatResult.getResponse())
                                .sources(chatResult.getSources())
                                .items(chatResult.getItems())
                                .createdAt(assistantMessage.getCreatedAt())
                                .build();
        }

        private void applyInferredProfile(ChatDto.InferredProfileDto inferredProfile, User user) {
                if (inferredProfile == null || user == null) {
                        return;
                }

                String inferredGender = normalizeGender(inferredProfile.getGender());
                String inferredAgeGroup = normalizeAgeGroup(inferredProfile.getAgeGroup());
                String inferredBodyType = normalizeBodyType(inferredProfile.getBodyType());
                String inferredStyleMood = normalizeStyleMood(inferredProfile.getStyleMoodPreference());

                if (inferredGender == null && inferredAgeGroup == null && inferredBodyType == null && inferredStyleMood == null) {
                        return;
                }

                if (inferredGender != null) {
                        user.setGender(inferredGender);
                }
                if (inferredAgeGroup != null) {
                        user.setAgeGroup(inferredAgeGroup);
                }
                if (inferredBodyType != null) {
                        user.setBodyType(inferredBodyType);
                }
                if (inferredStyleMood != null) {
                        user.setStyleMoodPreference(inferredStyleMood);
                }

                if (isProfileComplete(user)) {
                        user.setStyleProfileCompleted(Boolean.TRUE);
                }

                userRepository.save(user);
        }

        private boolean isProfileComplete(User user) {
                return isAllowedGender(user.getGender())
                                && isNotBlank(user.getAgeGroup())
                                && isNotBlank(user.getBodyType())
                                && isNotBlank(user.getStyleMoodPreference());
        }

        private boolean isMissingGender(String gender) {
                return !isAllowedGender(gender);
        }

        private boolean isAllowedGender(String gender) {
                String normalized = normalizeGender(gender);
                return normalized != null && ALLOWED_GENDERS.contains(normalized);
        }

        private boolean isNotBlank(String value) {
                return value != null && !value.isBlank();
        }

        private String normalizeGender(String gender) {
                if (gender == null) {
                        return null;
                }

                String normalized = gender.trim().toLowerCase(Locale.ROOT);
                if (normalized.isBlank() || "undisclosed".equals(normalized) || "unknown".equals(normalized) || "none".equals(normalized)) {
                        return null;
                }

                return switch (normalized) {
                        case "male", "m", "man", "남", "남성", "남자", "메일" -> "male";
                        case "female", "f", "woman", "women", "여", "여성", "여자", "femail" -> "female";
                        default -> ALLOWED_GENDERS.contains(normalized) ? normalized : null;
                };
        }

        private String normalizeAgeGroup(String ageGroup) {
                if (ageGroup == null) {
                        return null;
                }

                String normalized = ageGroup.trim().toLowerCase(Locale.ROOT);
                if (normalized.isBlank()) {
                        return null;
                }

                return switch (normalized) {
                        case "teens", "10s", "10대", "10대 초반", "10대 중반", "10대 후반", "teen", "teens_early", "teens_late" ->
                                "teens";
                        case "20대", "20s", "20세", "20대 초반", "20대 초중반", "twenties", "twenties_early", "twenties early",
                             "20대 중반" -> "twenties_early";
                        case "20대 후반", "20s late", "twenties late", "twenties_late", "20대 중후반" -> "twenties_late";
                        case "30대", "30대 초반", "30대 초중반", "30s", "30세", "thirties", "thirties_early", "thirties early" ->
                                "thirties_early";
                        case "30대 후반", "30s late", "thirties late", "thirties_late", "30대 중반", "30대 중후반" -> "thirties_late";
                        case "40대", "40대 초반", "40대 후반", "40s", "40세", "40대 초중반", "40대 중반", "forties_plus", "forties plus",
                             "40대 이상", "50대", "50대 이상", "50s", "50세", "60대", "60대 이상", "70대" ->
                                "forties_plus";
                        case "twenties-late", "twenties-early", "thirties-late", "thirties-early" ->
                                normalized.replace('-', '_');
                        default -> null;
                };
        }

        private String normalizeBodyType(String bodyType) {
                if (bodyType == null) {
                        return null;
                }

                String normalized = bodyType.trim().toLowerCase(Locale.ROOT);
                return switch (normalized) {
                        case "slim", "슬림", "슬림핏", "슬림 플핏", "slim fit", "마른", "마른형", "마른 몸", "슬림형" -> "slim";
                        case "standard", "표준", "보통", "보통 체형", "노멀", "average", "average build", "일반" -> "standard";
                        case "curvy", "곡선형", "볼륨", "curvy body", "curly", "볼륨형", "둥근 체형", "여리한 곡선" -> "curvy";
                        case "muscular", "근육", "근육형", "운동", "운동선수형", "탄탄함", "탄탄한 체형" -> "muscular";
                        case "plus", "플러스", "통통", "통통한", "플러스 사이즈", "plus size" -> "plus";
                        default -> null;
                };
        }

        private String normalizeStyleMood(String styleMood) {
                if (styleMood == null) {
                        return null;
                }

                String normalized = styleMood.trim().toLowerCase(Locale.ROOT);
                return switch (normalized) {
                        case "casual", "캐주얼", "캐주얼한", "데일리", "일상", "일상적", "daily", "daily wear" -> "casual";
                        case "minimal", "미니멀", "심플", "심플한", "simple", "심플한 스타일" -> "minimal";
                        case "feminine", "페미닌", "여성스러운", "소녀", "feminine style" -> "feminine";
                        case "chic", "시크", "세련", "모던", "세련된", "모던한" -> "chic";
                        case "street", "스트릿", "스트릿룩", "캐주얼 스포츠" -> "street";
                        case "classic", "클래식", "클래식한", "클래식 스타일", "클래식코디" -> "classic";
                        default -> null;
                };
        }

        @Transactional
        public void deleteSession(String email, Long sessionId) {
                User user = findUserByEmail(email);
                ChatSession session = chatSessionRepository.findById(sessionId)
                                .orElseThrow(() -> new IllegalArgumentException("세션을 찾을 수 없습니다"));

                if (!session.getUser().getId().equals(user.getId())) {
                        throw new IllegalArgumentException("접근 권한이 없습니다");
                }

                chatSessionRepository.delete(session);
        }

        private User findUserByEmail(String email) {
                return userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
        }

        private String generateTitle(String message) {
                if (message.length() > 30) {
                        return message.substring(0, 30) + "...";
                }
                return message;
        }

        private ChatSessionResponse toSessionResponse(ChatSession session) {
                return ChatSessionResponse.builder()
                                .id(session.getId())
                                .title(session.getTitle())
                                .createdAt(session.getCreatedAt())
                                .build();
        }

        private ChatSessionResponse toSessionResponseWithMessages(ChatSession session) {
                List<ChatResponse> messages = session.getMessages().stream()
                                .map(msg -> ChatResponse.builder()
                                                .sessionId(session.getId())
                                                .messageId(msg.getId())
                                                .role(msg.getRole().name().toLowerCase())
                                                .content(msg.getContent())
                                                .createdAt(msg.getCreatedAt())
                                                .build())
                                .collect(Collectors.toList());

                return ChatSessionResponse.builder()
                                .id(session.getId())
                                .title(session.getTitle())
                                .createdAt(session.getCreatedAt())
                                .messages(messages)
                                .build();
        }
}
