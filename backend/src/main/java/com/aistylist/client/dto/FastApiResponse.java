package com.aistylist.client.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FastApiResponse<T> {

    private boolean success; // 성공 여부
    private String message; // 메시지
    private T data; // 데이터
    private String timestamp; // 시간
}