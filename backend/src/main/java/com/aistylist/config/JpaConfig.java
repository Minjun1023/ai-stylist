package com.aistylist.config;

/**
 * com/aistylist/config/JpaConfig.java: Backend source file for style/recommendation related features.
 */

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/*
 * JPA 설정
 */
@Configuration
@EnableJpaAuditing
public class JpaConfig {
}
