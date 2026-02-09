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
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "color_type", nullable = false, length = 50)
    private String colorType;

    @Column
    private Float confidence;

    @Column(length = 20)
    @Enumerated(EnumType.STRING)
    private DiagnosisMethod method;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "survey_data", columnDefinition = "jsonb")
    private String surveyData;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum DiagnosisMethod {
        SURVEY, IMAGE, HYBRID
    }
}