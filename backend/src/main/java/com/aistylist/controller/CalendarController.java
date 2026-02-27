package com.aistylist.controller;

/**
 * com/aistylist/controller/CalendarController.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.dto.calendar.CalendarOutfitResponse;
import com.aistylist.dto.calendar.CalendarOutfitSummaryResponse;
import com.aistylist.dto.calendar.CalendarScheduleRequest;
import com.aistylist.dto.calendar.CalendarScheduleResponse;
import com.aistylist.dto.common.ApiResponse;
import com.aistylist.service.CalendarScheduleService;
import com.aistylist.service.CalendarOutfitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarController {

    private final CalendarOutfitService calendarOutfitService;
    private final CalendarScheduleService calendarScheduleService;

    @GetMapping("/outfits")
    public ResponseEntity<ApiResponse<List<CalendarOutfitSummaryResponse>>> getMonthlyOutfits(
            Authentication authentication,
            @RequestParam int year,
            @RequestParam int month) {
        String email = authentication.getName();
        log.info("달력 코디 월별 조회: {}, {}-{}", email, year, month);
        List<CalendarOutfitSummaryResponse> results = calendarOutfitService.getMonthlyOutfits(email, year, month);
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    @GetMapping("/outfits/{date}")
    public ResponseEntity<ApiResponse<CalendarOutfitResponse>> getOutfitByDate(
            Authentication authentication,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        String email = authentication.getName();
        log.info("달력 코디 일별 조회: {}, {}", email, date);
        CalendarOutfitResponse result = calendarOutfitService.getOutfitByDate(email, date);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping(value = "/outfits/{date}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CalendarOutfitResponse>> saveOutfit(
            Authentication authentication,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam("image") MultipartFile image) {
        String email = authentication.getName();
        log.info("달력 코디 저장: {}, {}", email, date);
        CalendarOutfitResponse result = calendarOutfitService.saveOutfit(email, date, image);
        return ResponseEntity.ok(ApiResponse.success("코디가 저장되었습니다", result));
    }

    @DeleteMapping("/outfits/{date}")
    public ResponseEntity<ApiResponse<Void>> deleteOutfit(
            Authentication authentication,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        String email = authentication.getName();
        log.info("달력 코디 삭제: {}, {}", email, date);
        calendarOutfitService.deleteOutfit(email, date);
        return ResponseEntity.ok(ApiResponse.success("코디 기록이 삭제되었습니다", null));
    }

    @GetMapping("/schedules")
    public ResponseEntity<ApiResponse<List<CalendarScheduleResponse>>> getMonthlySchedules(
            Authentication authentication,
            @RequestParam int year,
            @RequestParam int month) {
        String email = authentication.getName();
        log.info("달력 일정 월별 조회: {}, {}-{}", email, year, month);
        List<CalendarScheduleResponse> results = calendarScheduleService.getMonthlySchedules(email, year, month);
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    @GetMapping("/schedules/{date:\\d{4}-\\d{2}-\\d{2}}")
    public ResponseEntity<ApiResponse<List<CalendarScheduleResponse>>> getSchedulesByDate(
            Authentication authentication,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        String email = authentication.getName();
        log.info("달력 일정 일별 조회: {}, {}", email, date);
        List<CalendarScheduleResponse> results = calendarScheduleService.getSchedulesByDate(email, date);
        return ResponseEntity.ok(ApiResponse.success(results));
    }

    @GetMapping("/schedules/upcoming")
    public ResponseEntity<ApiResponse<CalendarScheduleResponse>> getUpcomingSchedule(
            Authentication authentication) {
        String email = authentication.getName();
        log.info("다가오는 일정 조회: {}", email);
        CalendarScheduleResponse result = calendarScheduleService.getUpcomingSchedule(email);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/schedules/{date}")
    public ResponseEntity<ApiResponse<CalendarScheduleResponse>> createSchedule(
            Authentication authentication,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody CalendarScheduleRequest request) {
        String email = authentication.getName();
        log.info("달력 일정 저장: {}, {}", email, date);
        CalendarScheduleResponse result = calendarScheduleService.createSchedule(email, date, request);
        return ResponseEntity.ok(ApiResponse.success("일정이 저장되었습니다", result));
    }

    @DeleteMapping("/schedules/{scheduleId}")
    public ResponseEntity<ApiResponse<Void>> deleteSchedule(
            Authentication authentication,
            @PathVariable Long scheduleId) {
        String email = authentication.getName();
        log.info("달력 일정 삭제: {}, {}", email, scheduleId);
        calendarScheduleService.deleteSchedule(email, scheduleId);
        return ResponseEntity.ok(ApiResponse.success("일정이 삭제되었습니다", null));
    }
}
