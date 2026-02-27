package com.aistylist.domain.repository;

/**
 * com/aistylist/domain/repository/PersonalColorResultRepository.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.PersonalColorResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PersonalColorResultRepository extends JpaRepository<PersonalColorResult, Long> {
    List<PersonalColorResult> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<PersonalColorResult> findFirstByUserIdOrderByCreatedAtDesc(Long userId);
}
