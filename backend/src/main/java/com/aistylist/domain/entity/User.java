package com.aistylist.domain.entity;

/**
 * com/aistylist/domain/entity/User.java: Backend source file for style/recommendation related features.
 */

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
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(length = 100, nullable = false, unique = true)
    private String nickname;

    @Column(name = "personal_color", length = 50)
    private String personalColor;

    @Column(length = 20)
    private String gender;

    @Column(name = "age_group", length = 20)
    private String ageGroup;

    @Column(name = "body_type", length = 30)
    private String bodyType;

    @Column(name = "style_mood_preference", length = 30)
    private String styleMoodPreference;

    @Column(name = "style_profile_completed", nullable = false)
    @Builder.Default
    private Boolean styleProfileCompleted = Boolean.FALSE;

    @Column(name = "personal_color_completed", nullable = false)
    @Builder.Default
    private Boolean personalColorCompleted = Boolean.FALSE;

    @Column(name = "chat_profile_completed", nullable = false)
    @Builder.Default
    private Boolean chatProfileCompleted = Boolean.FALSE;

    @Column(name = "style_recommendation_completed", nullable = false)
    @Builder.Default
    private Boolean styleRecommendationCompleted = Boolean.FALSE;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

}
