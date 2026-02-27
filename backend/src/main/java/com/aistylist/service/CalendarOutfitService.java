package com.aistylist.service;

/**
 * com/aistylist/service/CalendarOutfitService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.calendar.CalendarOutfitResponse;
import com.aistylist.dto.calendar.CalendarOutfitSummaryResponse;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CalendarOutfitService {

    private static final long MAX_IMAGE_BYTES = 8L * 1024L * 1024L;

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;

    @PostConstruct
    public void ensureTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS calendar_outfits (
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    outfit_date DATE NOT NULL,
                    image_data BYTEA NOT NULL,
                    mime_type VARCHAR(100) NOT NULL,
                    original_filename VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, outfit_date)
                )
                """);

        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_calendar_outfits_user_date
                ON calendar_outfits(user_id, outfit_date)
                """);
    }

    @Transactional(readOnly = true)
    public List<CalendarOutfitSummaryResponse> getMonthlyOutfits(String email, int year, int month) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("month는 1~12 범위여야 합니다");
        }

        Long userId = findUserId(email);
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();

        return jdbcTemplate.query(
                """
                        SELECT outfit_date, updated_at
                        FROM calendar_outfits
                        WHERE user_id = ?
                          AND outfit_date BETWEEN ? AND ?
                        ORDER BY outfit_date
                        """,
                (rs, rowNum) -> CalendarOutfitSummaryResponse.builder()
                        .date(rs.getDate("outfit_date").toLocalDate().toString())
                        .updatedAt(toLocalDateTime(rs.getTimestamp("updated_at")))
                        .build(),
                userId,
                Date.valueOf(from),
                Date.valueOf(to)
        );
    }

    @Transactional(readOnly = true)
    public CalendarOutfitResponse getOutfitByDate(String email, LocalDate date) {
        Long userId = findUserId(email);
        return findOutfit(userId, date).orElse(null);
    }

    @Transactional
    public CalendarOutfitResponse saveOutfit(String email, LocalDate date, MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("이미지 파일은 필수입니다");
        }

        String mimeType = Optional.ofNullable(image.getContentType()).orElse("application/octet-stream");
        if (!mimeType.toLowerCase().startsWith("image/")) {
            throw new IllegalArgumentException("이미지 파일만 업로드할 수 있습니다");
        }

        if (image.getSize() > MAX_IMAGE_BYTES) {
            throw new IllegalArgumentException("이미지는 8MB 이하만 업로드할 수 있습니다");
        }

        byte[] imageData;
        try {
            imageData = image.getBytes();
        } catch (IOException e) {
            throw new IllegalStateException("이미지 파일을 읽는 중 오류가 발생했습니다", e);
        }

        Long userId = findUserId(email);
        String originalFilename = Optional.ofNullable(image.getOriginalFilename())
                .map(name -> new String(name.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8))
                .orElse("outfit-image");

        jdbcTemplate.update(
                """
                        INSERT INTO calendar_outfits (
                            user_id, outfit_date, image_data, mime_type, original_filename, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, outfit_date)
                        DO UPDATE SET
                            image_data = EXCLUDED.image_data,
                            mime_type = EXCLUDED.mime_type,
                            original_filename = EXCLUDED.original_filename,
                            updated_at = CURRENT_TIMESTAMP
                        """,
                userId,
                Date.valueOf(date),
                imageData,
                mimeType,
                originalFilename
        );

        return findOutfit(userId, date)
                .orElseThrow(() -> new IllegalStateException("저장 후 조회에 실패했습니다"));
    }

    @Transactional
    public void deleteOutfit(String email, LocalDate date) {
        Long userId = findUserId(email);
        jdbcTemplate.update(
                """
                        DELETE FROM calendar_outfits
                        WHERE user_id = ? AND outfit_date = ?
                        """,
                userId,
                Date.valueOf(date)
        );
    }

    private Optional<CalendarOutfitResponse> findOutfit(Long userId, LocalDate date) {
        try {
            CalendarOutfitResponse found = jdbcTemplate.queryForObject(
                    """
                            SELECT outfit_date, image_data, mime_type, original_filename, updated_at
                            FROM calendar_outfits
                            WHERE user_id = ? AND outfit_date = ?
                            """,
                    (rs, rowNum) -> {
                        String mimeType = rs.getString("mime_type");
                        byte[] imageData = rs.getBytes("image_data");
                        String base64 = Base64.getEncoder().encodeToString(imageData);
                        return CalendarOutfitResponse.builder()
                                .date(rs.getDate("outfit_date").toLocalDate().toString())
                                .fileName(rs.getString("original_filename"))
                                .mimeType(mimeType)
                                .imageDataUrl("data:" + mimeType + ";base64," + base64)
                                .updatedAt(toLocalDateTime(rs.getTimestamp("updated_at")))
                                .build();
                    },
                    userId,
                    Date.valueOf(date)
            );
            return Optional.ofNullable(found);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    private Long findUserId(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
        return user.getId();
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp != null ? timestamp.toLocalDateTime() : null;
    }
}
