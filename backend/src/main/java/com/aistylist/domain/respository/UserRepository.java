package com.aistylist.domain.respository;

import com.aistylist.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email); // 이메일로 사용자 조회

    boolean existsByEmail(String email); // 이메일 중복 확인
}
