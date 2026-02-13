package com.aistylist.dto.user;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Builder
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long id; // 사용자 ID
    private String email; // 이메일
    private String nickname; // 닉네임
    private String personalColor; // 퍼스널컬러
    private LocalDateTime createdAt; // 생성일
}
