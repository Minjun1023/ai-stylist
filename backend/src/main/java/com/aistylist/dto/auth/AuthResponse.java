package com.aistylist.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String accessToken; // 액세스 토큰
    private String tokenType; // 토큰 타입
    private UserInfo user; // 사용자 정보

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserInfo {
        private Long id; // 사용자 ID
        private String email; // 이메일
        private String nickname; // 닉네임
        private String personalColor; // 퍼스널컬러
    }

}
