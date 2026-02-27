package com.aistylist.service;

/**
 * com/aistylist/service/CalendarScheduleService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.calendar.CalendarScheduleRequest;
import com.aistylist.dto.calendar.CalendarScheduleResponse;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CalendarScheduleService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;

    @PostConstruct
    public void ensureTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS calendar_schedule_events (
                    id BIGSERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    schedule_at TIMESTAMP NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);

        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_calendar_schedule_user_datetime
                ON calendar_schedule_events(user_id, schedule_at)
                """);
    }

    @Transactional(readOnly = true)
    public List<CalendarScheduleResponse> getMonthlySchedules(String email, int year, int month) {
        if (month < 1 || month > 12) {
            throw new IllegalArgumentException("month는 1~12 범위여야 합니다");
        }

        Long userId = findUserId(email);
        YearMonth ym = YearMonth.of(year, month);
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();

        return jdbcTemplate.query(
                """
                        SELECT id, schedule_at, title
                        FROM calendar_schedule_events
                        WHERE user_id = ?
                          AND schedule_at >= ?
                          AND schedule_at < ?
                        ORDER BY schedule_at ASC
                        """,
                (rs, rowNum) -> toCalendarScheduleResponse(
                        rs.getLong("id"),
                        rs.getTimestamp("schedule_at"),
                        rs.getString("title")
                ),
                userId,
                Timestamp.valueOf(from.atStartOfDay()),
                Timestamp.valueOf(to.plusDays(1).atStartOfDay())
        );
    }

    @Transactional(readOnly = true)
    public List<CalendarScheduleResponse> getSchedulesByDate(String email, LocalDate date) {
        Long userId = findUserId(email);

        return jdbcTemplate.query(
                """
                        SELECT id, schedule_at, title
                        FROM calendar_schedule_events
                        WHERE user_id = ?
                          AND schedule_at >= ?
                          AND schedule_at < ?
                        ORDER BY schedule_at ASC
                        """,
                (rs, rowNum) -> toCalendarScheduleResponse(
                        rs.getLong("id"),
                        rs.getTimestamp("schedule_at"),
                        rs.getString("title")
                ),
                userId,
                Timestamp.valueOf(date.atStartOfDay()),
                Timestamp.valueOf(date.plusDays(1).atStartOfDay())
        );
    }

    @Transactional(readOnly = true)
    public CalendarScheduleResponse getUpcomingSchedule(String email) {
        Long userId = findUserId(email);

        try {
            return jdbcTemplate.queryForObject(
                    """
                            SELECT id, schedule_at, title
                            FROM calendar_schedule_events
                            WHERE user_id = ?
                              AND schedule_at >= CURRENT_TIMESTAMP
                            ORDER BY schedule_at ASC
                            LIMIT 1
                            """,
                    (rs, rowNum) -> toCalendarScheduleResponse(
                            rs.getLong("id"),
                            rs.getTimestamp("schedule_at"),
                            rs.getString("title")
                    ),
                    userId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    @Transactional
    public CalendarScheduleResponse createSchedule(String email, LocalDate date, CalendarScheduleRequest request) {
        String title = request != null ? request.getTitle() : null;
        String time = request != null ? request.getTime() : null;

        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("일정 제목은 필수입니다");
        }

        if (title.length() > 255) {
            throw new IllegalArgumentException("일정 제목은 255자를 초과할 수 없습니다");
        }

        if (time == null || time.trim().isEmpty()) {
            throw new IllegalArgumentException("일정 시간은 필수입니다");
        }

        LocalTime parsedTime;
        try {
            parsedTime = LocalTime.parse(time.trim());
        } catch (Exception e) {
            throw new IllegalArgumentException("일정 시간 형식이 올바르지 않습니다");
        }

        LocalDateTime scheduleAt = LocalDateTime.of(date, parsedTime);
        Long userId = findUserId(email);

        Long id = jdbcTemplate.queryForObject(
                """
                        INSERT INTO calendar_schedule_events (
                            user_id, schedule_at, title, created_at, updated_at
                        )
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        RETURNING id
                        """,
                Long.class,
                userId,
                Timestamp.valueOf(scheduleAt),
                title.trim()
        );

        return toCalendarScheduleResponse(
                id,
                Timestamp.valueOf(scheduleAt),
                title.trim()
        );
    }

    @Transactional
    public void deleteSchedule(String email, Long scheduleId) {
        Long userId = findUserId(email);

        int deleted = jdbcTemplate.update(
                """
                        DELETE FROM calendar_schedule_events
                        WHERE id = ? AND user_id = ?
                        """,
                scheduleId,
                userId
        );

        if (deleted == 0) {
            throw new IllegalArgumentException("해당 일정을 찾을 수 없습니다");
        }
    }

    private CalendarScheduleResponse toCalendarScheduleResponse(Long id, Timestamp scheduleAt, String title) {
        LocalDateTime scheduleDateTime = scheduleAt.toLocalDateTime();
        return CalendarScheduleResponse.builder()
                .id(id)
                .date(scheduleDateTime.toLocalDate().toString())
                .time(scheduleDateTime.toLocalTime().format(TIME_FORMATTER))
                .title(title)
                .scheduleAt(scheduleDateTime.toString())
                .build();
    }

    private Long findUserId(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
        return user.getId();
    }
}
