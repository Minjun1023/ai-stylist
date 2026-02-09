package com.aistylist.domain.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import jakarta.persistence.Id;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Table(name = "personal_color_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@EntityListeners(AuditingEntityListener.class)
public class PersonalColorResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // 퍼스널 컬러 결과 ID

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user; // 사용자

    @Column(name = "color_type", nullable = false, length = 50)
    private String colorType; // 퍼스널 컬러 타입

    @Column
    private Float confidence; // 퍼스널 컬러 신뢰도

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private DiagnosisMethod method; // 퍼스널 컬러 진단 방법

    @Column(name = "image_url")
    private String imageUrl; // 퍼스널 컬러 진단 이미지 URL

    @Column(name = "survey_data", columnDefinition = "jsonb")
    private String surveyData; // 퍼스널 컬러 진단 설문 데이터

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt; // 퍼스널 컬러 진단 생성 시간

    public enum DiagnosisMethod {
        SURVEY, IMAGE, HYBRID
    }
}