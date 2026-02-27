package com.aistylist.service;

/**
 * com/aistylist/service/StyleRecommendationHistoryService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.dto.style.StyleRecommendationHistoryResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
@RequiredArgsConstructor
public class StyleRecommendationHistoryService {

    private static final int MAX_HISTORY_PER_USER = 20;

    private final ObjectMapper objectMapper;
    private final Map<Long, Deque<StyleRecommendationHistoryResponse>> historyByUser = new ConcurrentHashMap<>();
    public void addRecommendation(Long userId, StyleRecommendationHistoryResponse payload) {
        if (userId == null || payload == null) {
            return;
        }

        Deque<StyleRecommendationHistoryResponse> history =
                historyByUser.computeIfAbsent(userId, ignored -> new ConcurrentLinkedDeque<>());
        synchronized (history) {
            history.addFirst(payload);
            while (history.size() > MAX_HISTORY_PER_USER) {
                history.removeLast();
            }
        }
    }

    public List<StyleRecommendationHistoryResponse> getRecentRecommendations(Long userId, int limit) {
        if (userId == null || limit <= 0) {
            return List.of();
        }

        Deque<StyleRecommendationHistoryResponse> history = historyByUser.get(userId);
        if (history == null || history.isEmpty()) {
            return List.of();
        }

        List<StyleRecommendationHistoryResponse> result = new ArrayList<>();
        synchronized (history) {
            int idx = 0;
            for (StyleRecommendationHistoryResponse item : history) {
                if (idx++ >= limit) {
                    break;
                }
                result.add(StyleRecommendationHistoryResponse.builder()
                        .query(item.getQuery())
                        .occasion(item.getOccasion())
                        .gender(item.getGender())
                        .recommendation(item.getRecommendation())
                        .personalColor(item.getPersonalColor())
                        .items(normalizeRecommendationItems(item.getItems()))
                        .sources(item.getSources())
                        .createdAt(item.getCreatedAt())
                        .build());
            }
        }
        return result;
    }

    public StyleRecommendationHistoryResponse create(String query, String occasion, String gender,
                                                    String recommendation, String personalColor,
                                                    List<Object> items, List<String> sources) {
        return StyleRecommendationHistoryResponse.builder()
                .query(query)
                .occasion(occasion)
                .gender(gender)
                .recommendation(recommendation)
                .personalColor(personalColor)
                .items(items)
                .sources(sources)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private List<Object> normalizeRecommendationItems(List<Object> rawItems) {
        if (rawItems == null || rawItems.isEmpty()) {
            return List.of();
        }

        return rawItems.stream()
                .map(this::normalizeRecommendationItem)
                .toList();
    }

    private Object normalizeRecommendationItem(Object rawItem) {
        java.util.Map<String, Object> item = normalizeItemToMap(rawItem);
        if (item.isEmpty()) {
            item = fallbackBuildItem(rawItem);
            if (item.isEmpty()) {
                return rawItem;
            }
        }

        String category = normalizeText(readString(item, "category", "Category"));
        String source = normalizeText(readString(item, "source", "Source"));
        String purchaseUrl = normalizeText(readString(item, "purchase_url", "purchaseUrl", "product_url"));
        if (isBlank(category)) {
            category = normalizeCategoryFromPurchaseUrl(purchaseUrl);
            if (isBlank(category)) {
                String title = normalizeText(readString(item, "title", "name", "product_name"));
                String description = normalizeText(readString(item, "description", "desc"));
                category = normalizeCategoryFromText(title + " " + description);
                if (isBlank(category)) {
                    category = "other";
                }
            }
            item.put("category", category);
        }

        String gender = normalizeText(readString(item, "gender", "Gender"));
        if (isBlank(gender)) {
                String title = normalizeText(readString(item, "title", "name", "product_name"));
                String description = normalizeText(readString(item, "description", "desc"));
                String combined = (title + " " + description).toLowerCase(Locale.ROOT);
                if (isLikelyFemale(combined)) {
                    gender = "female";
                } else if ("items".equalsIgnoreCase(source)) {
                    gender = "unisex";
                } else {
                    gender = "unisex";
                }
        }
        if (isBlank(category)) {
            category = "other";
        }
        if (isBlank(gender)) {
            gender = "unisex";
        }
        item.put("gender", gender);
        item.putIfAbsent("title", normalizeText(readString(item, "title", "name", "product_name")));
        item.putIfAbsent("description", normalizeText(readString(item, "description", "desc")));
        return item;
    }

    private String readString(java.util.Map<String, Object> item, String... keys) {
        if (item == null || keys == null) {
            return "";
        }
        for (String key : keys) {
            if (key == null) {
                continue;
            }
            Object value = item.get(key);
            if (!isBlank(String.valueOf(value))) {
                return String.valueOf(value).trim();
            }
        }
        return "";
    }

    private java.util.Map<String, Object> fallbackBuildItem(Object rawItem) {
        java.util.Map<String, Object> fallback = new java.util.HashMap<>();
        if (rawItem == null) {
            fallback.put("title", "추천 아이템");
            return fallback;
        }

        if (rawItem instanceof String rawString) {
            String trimmed = rawString.trim();
            if (!trimmed.isEmpty()) {
                fallback.put("title", trimmed);
                fallback.put("description", trimmed);
            }

            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                try {
                    var parsed = objectMapper.readValue(
                            trimmed,
                            new TypeReference<java.util.Map<String, Object>>() {}
                    );
                    if (!parsed.isEmpty()) {
                        return parsed;
                    }
                } catch (Exception ignored) {
                }
            }
            return fallback;
        }

        fallback.put("title", String.valueOf(rawItem));
        fallback.put("description", String.valueOf(rawItem));
        return fallback;
    }

    private String normalizeCategoryFromPurchaseUrl(String purchaseUrl) {
        if (purchaseUrl == null || purchaseUrl.isBlank()) {
            return "";
        }
        try {
            var query = org.springframework.web.util.UriComponentsBuilder.fromUriString(purchaseUrl)
                    .build(true)
                    .getQueryParams();
            return query.getFirst("category") != null ? query.getFirst("category").toLowerCase(Locale.ROOT) : "";
        } catch (Exception e) {
            return "";
        }
    }

    private String normalizeText(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean isBlank(String value) {
        if (value == null) {
            return true;
        }

        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty()
                || "null".equals(normalized)
                || "undefined".equals(normalized)
                || "none".equals(normalized);
    }

    private java.util.Map<String, Object> normalizeItemToMap(Object rawItem) {
        if (rawItem == null) {
            return new java.util.HashMap<>();
        }

        if (rawItem instanceof java.util.Map<?, ?> map) {
            java.util.Map<String, Object> normalized = new java.util.HashMap<>();
            for (var entry : map.entrySet()) {
                if (entry.getKey() != null) {
                    normalized.put(String.valueOf(entry.getKey()), entry.getValue());
                }
            }
            return normalized;
        }

        try {
            java.util.Map<String, Object> converted = objectMapper.convertValue(
                    rawItem,
                    new TypeReference<java.util.Map<String, Object>>() {}
            );
            if (!converted.isEmpty()) {
                return converted;
            }
        } catch (Exception ignored) {
        }

        try {
            var tree = objectMapper.valueToTree(rawItem);
            if (tree instanceof ObjectNode objectNode) {
                java.util.Map<String, Object> converted = objectMapper.convertValue(
                        objectNode,
                        new TypeReference<java.util.Map<String, Object>>() {}
                );
                if (!converted.isEmpty()) {
                    return converted;
                }
            }
        } catch (Exception ignored) {
        }

        try {
            var bean = java.beans.Introspector.getBeanInfo(rawItem.getClass()).getPropertyDescriptors();
            java.util.Map<String, Object> normalized = new java.util.HashMap<>();
            for (var desc : bean) {
                var read = desc.getReadMethod();
                if (read == null || "class".equals(desc.getName())) {
                    continue;
                }
                Object value = read.invoke(rawItem);
                if (value != null) {
                    normalized.put(desc.getName(), value);
                }
            }
            return normalized;
        } catch (Exception ignored) {
            return new java.util.HashMap<>();
        }
    }

    private String normalizeCategoryFromText(String text) {
        String normalized = normalizeText(text).toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return "";
        }

        if (normalized.contains("티셔츠") || normalized.contains("셔츠") || normalized.contains("맨투맨")
                || normalized.contains("후드") || normalized.contains("가디건") || normalized.contains("블라우스")
                || normalized.contains("상의") || normalized.contains("top")) {
            return "top";
        }

        if (normalized.contains("팬츠") || normalized.contains("바지") || normalized.contains("데님")
                || normalized.contains("청바지") || normalized.contains("하의") || normalized.contains("치마")
                || normalized.contains("슬랙스") || normalized.contains("bottom")) {
            return "bottom";
        }

        if (normalized.contains("아우터") || normalized.contains("재킷") || normalized.contains("자켓")
                || normalized.contains("코트") || normalized.contains("점퍼") || normalized.contains("패딩")
                || normalized.contains("outer")) {
            return "outer";
        }

        if (normalized.contains("신발") || normalized.contains("운동화") || normalized.contains("부츠")
                || normalized.contains("구두") || normalized.contains("샌들") || normalized.contains("스니커즈")
                || normalized.contains("shoes")) {
            return "shoes";
        }

        if (normalized.contains("가방") || normalized.contains("모자") || normalized.contains("벨트")
                || normalized.contains("시계") || normalized.contains("목걸이") || normalized.contains("팔찌")
                || normalized.contains("악세서리") || normalized.contains("액세서리") || normalized.contains("accessory")) {
            return "accessory";
        }

        return "other";
    }

    private boolean isLikelyFemale(String text) {
        return text.contains("스커트")
                || text.contains("원피스")
                || text.contains("블라우스")
                || text.contains("치마")
                || text.contains("하이힐")
                || text.contains("레깅스");
    }
}
