package com.aistylist.service;

/**
 * com/aistylist/service/EmailVerificationService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final Duration VERIFICATION_COOLDOWN = Duration.ofSeconds(60);
    private static final Duration VERIFICATION_TTL = Duration.ofMinutes(10);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${mail.from:no-reply@ai-stylist.local}")
    private String mailFrom;

    public void sendSignupVerificationCode(String email) {
        String normalizedEmail = normalizeEmail(email);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }

        String cooldownKey = "signup-verification:cooldown:" + normalizedEmail;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(cooldownKey))) {
            throw new IllegalArgumentException("인증 코드는 1분 후에 다시 요청할 수 있습니다.");
        }

        String verificationCode = generateVerificationCode();
        String codeKey = "signup-verification:code:" + normalizedEmail;

        redisTemplate.opsForValue().set(codeKey, verificationCode, VERIFICATION_TTL);
        redisTemplate.opsForValue().set(cooldownKey, "1", VERIFICATION_COOLDOWN);

        sendVerificationMail(normalizedEmail, verificationCode);
    }

    public void verifySignupCode(String email, String code) {
        validateSignupCode(email, code);
    }

    public void ensureSignupCode(String email, String code) {
        validateSignupCode(email, code);
    }

    public void consumeSignupCode(String email, String code) {
        validateSignupCode(email, code);
        String normalizedEmail = normalizeEmail(email);
        String codeKey = "signup-verification:code:" + normalizedEmail;
        redisTemplate.delete(codeKey);
    }

    private void validateSignupCode(String email, String code) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedCode = normalizeCode(code);

        String codeKey = "signup-verification:code:" + normalizedEmail;
        String storedCode = redisTemplate.opsForValue().get(codeKey);

        if (storedCode == null || normalizedCode.isBlank() || !storedCode.equals(normalizedCode)) {
            throw new IllegalArgumentException("인증 코드가 올바르지 않습니다.");
        }
    }

    private String generateVerificationCode() {
        int code = RANDOM.nextInt(900_000) + 100_000;
        return Integer.toString(code);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim();
    }

    private void sendVerificationMail(String to, String verificationCode) {
        String subject = "[AI 스타일리스트] 회원가입 이메일 인증 코드";
        String plainBody = "회원가입 인증 코드: " + verificationCode + "\n\n코드는 10분 동안 유효합니다.";
        String htmlBody = """
                <div style=\"font-family: Arial, sans-serif; line-height: 1.6;\">
                  <p>회원가입을 완료하려면 아래 인증 코드를 입력해주세요.</p>
                  <p style=\"font-size: 22px; font-weight: 700; letter-spacing: 2px;\">%s</p>
                  <p>코드는 10분 동안 유효합니다.</p>
                </div>
                """.formatted(verificationCode);

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("메일 발송 설정이 없어 링크를 로그로 대체합니다. to={}, code={}", to, verificationCode);
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
            log.warn("메일 발송 실패. 코드 로그를 대체합니다. to={}, code={}, reason={}", to, verificationCode, e.getMessage());
        }
    }
}
