package com.aistylist.dto.calendar;

/**
 * com/aistylist/dto/calendar/CalendarOutfitSummaryResponse.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarOutfitSummaryResponse {

    private String date;
    private LocalDateTime updatedAt;
}
