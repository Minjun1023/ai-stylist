package com.aistylist.service;

import com.aistylist.client.FastApiClient;
import com.aistylist.client.dto.FastApiResponse;
import com.aistylist.client.dto.StyleRecommendDto;
import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.style.StyleRecommendRequest;
import com.aistylist.dto.style.StyleRecommendResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class StyleService {

        private final UserRepository userRepository;
        private final FastApiClient fastApiClient;

        // 사용자 조회
        @Transactional(readOnly = true)
        public StyleRecommendResponse recommendStyle(String email, StyleRecommendRequest request) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

                // FastAPI 호출
                FastApiResponse<StyleRecommendDto> aiResponse = fastApiClient
                                .recommendStyle(
                                                request.getQuery(), // 사용자 메시지
                                                user.getPersonalColor(), // 개인 컬러
                                                request.getOccasion(), // 상황
                                                user.getId())// 사용자 ID
                                .block();
                // 응답 확인
                if (aiResponse == null || !aiResponse.isSuccess()) {
                        throw new RuntimeException("스타일 추천에 실패했습니다");
                }
                // 응답 데이터
                StyleRecommendDto result = aiResponse.getData();

                return StyleRecommendResponse.builder()
                                .recommendation(result.getRecommendation())// 추천
                                .items(result.getItems())// 아이템
                                .sources(result.getSources())// 소스
                                .personalColor(user.getPersonalColor())// 개인 컬러
                                .build();
        }
}