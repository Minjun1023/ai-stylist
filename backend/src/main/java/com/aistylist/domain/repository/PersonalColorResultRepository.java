package com.aistylist.domain.repository;

import com.aistylist.domain.entity.PersonalColorResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PersonalColorResultRepository extends JpaRepository<PersonalColorResult, Long> {
    List<PersonalColorResult> findByUserIdOrderByCreatedAtDesc(Long userId); // 사용자 ID로 퍼스널 컬러 결과 목록 조회 (최신순)

    Optional<PersonalColorResult> findFirstByUserIdOrderByCreatedAtDesc(Long userId); // 사용자 ID로 가장 최근 퍼스널 컬러 결과 조회
}
