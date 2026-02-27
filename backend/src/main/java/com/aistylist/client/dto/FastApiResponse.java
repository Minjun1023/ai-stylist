package com.aistylist.client.dto;

/**
 * com/aistylist/client/dto/FastApiResponse.java: Backend source file for style/recommendation related features.
 */

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FastApiResponse<T> {

    private boolean success;
    private String message;
    private T data;
    private String timestamp;
}
