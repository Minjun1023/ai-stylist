package com.aistylist.dto.calendar;

/**
 * com/aistylist/dto/calendar/CalendarOutfitResponse.java: Backend source file for style/recommendation related features.
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
public class CalendarOutfitResponse {

    private String date;
    private String fileName;
    private String mimeType;
    private String imageDataUrl;
    private LocalDateTime updatedAt;
}
