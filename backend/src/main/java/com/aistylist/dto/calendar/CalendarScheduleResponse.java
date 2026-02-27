package com.aistylist.dto.calendar;

/**
 * com/aistylist/dto/calendar/CalendarScheduleResponse.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarScheduleResponse {

    private Long id;
    private String date;
    private String time;
    private String title;
    private String scheduleAt;
    private String createdAt;
    private String updatedAt;
}
