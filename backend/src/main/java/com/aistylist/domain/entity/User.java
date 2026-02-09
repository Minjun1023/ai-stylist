package com.aistylist.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 사용자 ID

    @Column(nullable = false, unique = true)
    private String email; // 사용자 이메일

    @Column(nullable = false)
    private String password; // 사용자 비밀번호

    @Column(length = 100)
    private String nickname; // 사용자 닉네임

    @Column(name = "personal_color", length = 50)
    private String personalColor; // 사용자 퍼스널 컬러

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt; // 사용자 생성 시간

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt; // 사용자 수정 시간

}
