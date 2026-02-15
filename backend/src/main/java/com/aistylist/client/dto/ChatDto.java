package com.aistylist.client.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatDto {

    private String response; // 응답
    private List<String> sources; // 소스
}
