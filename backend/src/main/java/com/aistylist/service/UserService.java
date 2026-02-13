package com.aistylist.service;

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.user.UpdateProfileRequest;
import com.aistylist.dto.user.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public UserResponse getUserByEmail(String email) {
        // 이메일로 사용자 찾기
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다"));

        // 사용자 정보 반환
        return UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .personalColor(user.getPersonalColor())
                .createdAt(user.getCreatedAt())
                .build();
    }

    @Transactional
    public UserResponse updateProfile(String email, UpdateProfileRequest request) {
        // 이메일로 사용자 찾기
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다"));

        // 닉네임 업데이트
        if (request.getNickname() != null) {
            user.setNickname(request.getNickname());
        }

        // 사용자 정보 저장
        User updatedUser = userRepository.save(user);

        // 업데이트된 사용자 정보 반환
        return UserResponse.builder()
                .id(updatedUser.getId())
                .email(updatedUser.getEmail())
                .nickname(updatedUser.getNickname())
                .personalColor(updatedUser.getPersonalColor())
                .createdAt(updatedUser.getCreatedAt())
                .build();
    }
}