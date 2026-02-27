package com.aistylist.service;

/**
 * com/aistylist/service/PasswordResetService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.auth.ForgotPasswordRequest;
import com.aistylist.dto.auth.ResetPasswordRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.mail.internet.MimeMessage;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final Duration RESET_TOKEN_TTL = Duration.ofMinutes(20);
    private static final Duration REQUEST_COOLDOWN = Duration.ofSeconds(60);

    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;
    private final PasswordEncoder passwordEncoder;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${mail.from:no-reply@ai-stylist.local}")
    private String mailFrom;

    @Transactional(readOnly = true)
    public void requestReset(ForgotPasswordRequest request) {
        String email = normalizeEmail(request.getEmail());
        String cooldownKey = "password-reset:cooldown:" + email;

        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            return;
        }

        if (!userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("가입되지 않은 이메일입니다.");
        }
        redisTemplate.opsForValue().set(cooldownKey, "1", REQUEST_COOLDOWN);

        String token = UUID.randomUUID().toString();
        String tokenKey = "password-reset:token:" + token;
        redisTemplate.opsForValue().set(tokenKey, email, RESET_TOKEN_TTL);

        String resetLink = frontendUrl + "/reset-password?token=" + token;
        sendResetMail(email, resetLink);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String token = request.getToken().trim();
        String tokenKey = "password-reset:token:" + token;
        String email = redisTemplate.opsForValue().get(tokenKey);
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("유효하지 않거나 만료된 비밀번호 재설정 링크입니다.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        String newPassword = request.getNewPassword().trim();
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException("기존 비밀번호와 다른 비밀번호를 입력해주세요.");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        redisTemplate.delete(tokenKey);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void sendResetMail(String to, String resetLink) {
        String subject = "[AI 스타일리스트] 비밀번호 재설정 안내";
        String plainBody = resetLink + "\n\n링크는 20분 동안 유효합니다.";
        String htmlBody = """
                <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                  <p><a href="%s">%s</a></p>
                  <p>링크는 20분 동안 유효합니다.</p>
                </div>
                """.formatted(resetLink, resetLink);

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("메일 발송 설정이 없어 링크를 로그로 대체합니다. to={}, link={}", to, resetLink);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    "UTF-8"
            );
            helper.setFrom(mailFrom);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(plainBody, htmlBody);
            mailSender.send(message);
        } catch (Exception e) {
            log.warn("메일 발송 실패. 링크를 로그로 대체합니다. to={}, link={}, reason={}", to, resetLink, e.getMessage());
        }
    }
}
