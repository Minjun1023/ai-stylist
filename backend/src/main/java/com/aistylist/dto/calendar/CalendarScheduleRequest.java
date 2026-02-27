package com.aistylist.dto.calendar;

/**
 * com/aistylist/dto/calendar/CalendarScheduleRequest.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarScheduleRequest {

    private String title;
    private String time;
}
