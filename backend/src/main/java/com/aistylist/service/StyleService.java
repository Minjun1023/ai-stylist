package com.aistylist.service;

/**
 * com/aistylist/service/StyleService.java: Backend source file for style/recommendation related features.
 */

import com.aistylist.client.FastApiClient;
import com.aistylist.client.dto.FastApiResponse;
import com.aistylist.client.dto.StyleRecommendDto;
import com.aistylist.domain.entity.User;
import com.aistylist.domain.repository.UserRepository;
import com.aistylist.dto.style.HomeStyleRecommendRequest;
import com.aistylist.dto.style.HomeStyleRecommendResponse;
import com.aistylist.dto.style.StyleRecommendationHistoryResponse;
import com.aistylist.dto.style.StyleRecommendRequest;
import com.aistylist.dto.style.StyleRecommendResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class StyleService {
        private static final Set<String> ALLOWED_GENDERS = Set.of("male", "female");
        private static final Set<String> MISSING_GENDERS = Set.of("undisclosed", "unknown", "none", "not set");

        private final UserRepository userRepository;
        private final FastApiClient fastApiClient;
        private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;
        private final StyleRecommendationHistoryService historyService;
        private final ObjectMapper objectMapper;

        @Transactional(readOnly = true)
        public StyleRecommendResponse recommendStyle(String email, StyleRecommendRequest request) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
                String effectiveGender = resolveEffectiveGender(request.getGender(), user);

                FastApiResponse<StyleRecommendDto> aiResponse = callAiSafely(
                                "로그인 사용자 스타일 추천",
                                fastApiClient.recommendStyle(
                                                buildStageAwareQuery(request.getQuery(), user),
                                                request.getSeason(),
                                                user.getPersonalColor(),
                                                effectiveGender,
                                                user.getAgeGroup(),
                                                user.getBodyType(),
                                                user.getStyleMoodPreference(),
                                                request.getOccasion(),
                                                user.getId())
                );
                if (aiResponse == null || !aiResponse.isSuccess()) {
                        String message = aiResponse != null ? aiResponse.getMessage() : "AI 응답이 없습니다";
                        throw new IllegalStateException("스타일 추천에 실패했습니다: " + message);
                }
                StyleRecommendDto result = aiResponse.getData();
                if (result == null) {
                        throw new IllegalStateException("스타일 추천에 실패했습니다: 응답 데이터가 없습니다");
                }

                user.setStyleRecommendationCompleted(Boolean.TRUE);
                userRepository.save(user);
                List<Object> normalizedItems = normalizeStyleItems(result.getItems());

                StyleRecommendationHistoryResponse historyPayload = historyService.create(
                        request.getQuery(),
                        request.getOccasion(),
                        effectiveGender,
                        result.getRecommendation(),
                        user.getPersonalColor(),
                        normalizedItems,
                        result.getSources()
                );
                historyService.addRecommendation(user.getId(), historyPayload);

                return StyleRecommendResponse.builder()
                                .recommendation(result.getRecommendation())
                                .items(normalizedItems)
                                .sources(result.getSources())
                                .personalColor(user.getPersonalColor())
                                .build();
        }

        @Transactional(readOnly = true)
        public List<StyleRecommendationHistoryResponse> getRecentRecommendations(String email, int limit) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

                int safeLimit = Math.max(1, Math.min(limit, 30));
                return historyService.getRecentRecommendations(user.getId(), safeLimit);
        }

        @Transactional(readOnly = true)
        public StyleRecommendResponse recommendGuestStyle(StyleRecommendRequest request) {
                String effectiveGender = normalizeGender(request.getGender());
                if (effectiveGender == null || !ALLOWED_GENDERS.contains(effectiveGender)) {
                        throw new IllegalArgumentException("스타일 추천은 성별을 남성/여성으로 먼저 선택해야 합니다.");
                }

                FastApiResponse<StyleRecommendDto> aiResponse = callAiSafely(
                                "비로그인 스타일 추천",
                                fastApiClient
                                        .recommendStyle(
                                                        request.getQuery(),
                                                        request.getSeason(),
                                                        null,
                                                        effectiveGender,
                                                null,
                                                null,
                                                null,
                                                request.getOccasion(),
                                                0L)
                );

                if (aiResponse == null || !aiResponse.isSuccess()) {
                        String message = aiResponse != null ? aiResponse.getMessage() : "AI 응답이 없습니다";
                        throw new IllegalStateException("비로그인 스타일 추천에 실패했습니다: " + message);
                }

                StyleRecommendDto result = aiResponse.getData();
                if (result == null) {
                        throw new IllegalStateException("비로그인 스타일 추천에 실패했습니다: 응답 데이터가 없습니다");
                }

                return StyleRecommendResponse.builder()
                                .recommendation(result.getRecommendation())
                                .items(normalizeStyleItems(result.getItems()))
                                .sources(result.getSources())
                                .personalColor(null)
                                .build();
        }

        @Transactional(readOnly = true)
        public HomeStyleRecommendResponse recommendHomeStyle(String email, HomeStyleRecommendRequest request) {
                User user = userRepository.findByEmail(email)
                                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));
                String normalizedGender = normalizeGender(user.getGender());
                String homeGender = normalizedGender != null && ALLOWED_GENDERS.contains(normalizedGender)
                                ? normalizedGender
                                : "";

                FastApiResponse<HomeStyleRecommendResponse> aiResponse = callAiSafely(
                                "홈 스타일 추천",
                                fastApiClient.recommendHomeStyle(
                                                buildStageAwareQuery(request.getQuery(), user),
                                                request.getSeason(),
                                                user.getPersonalColor(),
                                                homeGender,
                                                user.getAgeGroup(),
                                                user.getBodyType(),
                                                user.getStyleMoodPreference(),
                                                request.getOccasion(),
                                                user.getId())
                );

                if (aiResponse == null || !aiResponse.isSuccess()) {
                        String message = aiResponse != null ? aiResponse.getMessage() : "AI 응답이 없습니다";
                        throw new IllegalStateException("홈 스타일 추천에 실패했습니다: " + message);
                }

                HomeStyleRecommendResponse result = aiResponse.getData();
                if (result == null) {
                        throw new IllegalStateException("홈 스타일 추천에 실패했습니다: 응답 데이터가 없습니다");
                }
                user.setStyleRecommendationCompleted(Boolean.TRUE);
                userRepository.save(user);

                normalizeHomeGenderWithCatalog(result, homeGender);

                return new HomeStyleRecommendResponse(
                        result.getRecommendation(),
                        result.getSets(),
                        result.getSources()
                );
        }

        private String resolveEffectiveGender(String requestGender, User user) {
                String normalizedRequestGender = normalizeGender(requestGender);
                if (normalizedRequestGender != null && ALLOWED_GENDERS.contains(normalizedRequestGender)) {
                        return normalizedRequestGender;
                }

                String userGender = normalizeGender(user.getGender());
                if (userGender == null || !ALLOWED_GENDERS.contains(userGender)) {
                        throw new IllegalArgumentException("스타일 추천은 성별을 남성/여성으로 먼저 선택해야 합니다.");
                }

                return userGender;
        }

        private String normalizeGender(String gender) {
                if (gender == null) {
                        return null;
                }

                String trimmed = gender.trim().toLowerCase(Locale.ROOT);
                if (trimmed.isBlank()) {
                        return null;
                }
                if (MISSING_GENDERS.contains(trimmed)) {
                        return null;
                }

                return switch (trimmed) {
                        case "male", "m", "man", "남", "남성", "남자", "메일" -> "male";
                        case "female", "f", "woman", "women", "여", "여성", "여자", "여성형", "femail" -> "female";
                        default -> trimmed;
                };
        }

        private String buildStageAwareQuery(String rawQuery, User user) {
                if (user == null || rawQuery == null) {
                        return "";
                }

                StringBuilder builder = new StringBuilder(rawQuery.trim());
                List<String> profiles = new ArrayList<>();

                boolean hasBasicProfile = !isBlank(user.getGender()) || !isBlank(user.getAgeGroup())
                                || !isBlank(user.getBodyType()) || !isBlank(user.getStyleMoodPreference());

                if (hasBasicProfile) {
                        profiles.add("기본 정보 기반");
                }
                if (!isBlank(user.getGender())) {
                        profiles.add(user.getGender());
                }
                if (!isBlank(user.getAgeGroup())) {
                        profiles.add(user.getAgeGroup());
                }
                if (!isBlank(user.getBodyType())) {
                        profiles.add(user.getBodyType());
                }
                if (!isBlank(user.getStyleMoodPreference())) {
                        profiles.add(user.getStyleMoodPreference());
                }

                if (Boolean.TRUE.equals(user.getPersonalColorCompleted()) && user.getPersonalColor() != null) {
                        profiles.add("퍼스널컬러:" + user.getPersonalColor());
                } else {
                        profiles.add("퍼스널컬러:미반영");
                }

                if (Boolean.TRUE.equals(user.getChatProfileCompleted())) {
                        profiles.add("채팅 이력 반영");
                }

                if (Boolean.TRUE.equals(user.getStyleRecommendationCompleted())) {
                        profiles.add("스타일 추천 이력 반영");
                }

                if (!profiles.isEmpty()) {
                        builder
                                        .append(" [")
                                        .append(String.join(" | ", profiles))
                                        .append("]");
                }

                return builder.toString();
        }

        private List<Object> normalizeStyleItems(List<Object> rawItems) {
                if (rawItems == null || rawItems.isEmpty()) {
                        return List.of();
                }

                List<Object> normalized = new ArrayList<>();
                for (Object rawItem : rawItems) {
                        Map<String, Object> item = normalizeItemToMap(rawItem);
                        if (item.isEmpty()) {
                                item = fallbackBuildItem(rawItem);
                        }

                        if (item.isEmpty()) {
                                continue;
                        }

                String category = normalizeText(readString(item, "category", "Category"));
                String gender = normalizeText(readString(item, "gender", "Gender"));
                String purchaseUrl = normalizeText(readString(item, "purchase_url", "purchaseUrl", "product_url"));
                String title = normalizeText(readString(item, "title", "name", "product_name"));
                String description = normalizeText(readString(item, "description", "desc"));
                String source = normalizeText(readString(item, "source", "Source"));
                List<String> tags = extractTagList(item);
                
                
                if (isBlank(category)) {
                        category = resolveCategoryFromPurchaseUrl(purchaseUrl);
                }
                        if (isBlank(category)) {
                                category = resolveCategoryFromText(title + " " + description);
                        }
                        if (isBlank(category)) {
                                category = resolveCategoryFromTags(extractTagList(item));
                                if (isBlank(category)) {
                                        category = "other";
                                }
                        }

                        if (!isValidGender(gender)
                                        || shouldResolveGender(source, gender, title, description, tags, purchaseUrl)) {
                                gender = normalizeGenderFromSource(source, gender, title, description, tags, purchaseUrl);
                        }

                        if (isBlank(gender)) {
                                gender = "unisex";
                        }
                        if (isBlank(category)) {
                                category = "other";
                        }

                        item.put("category", category);
                        item.put("gender", gender);
                        item.putIfAbsent("title", title);
                        item.putIfAbsent("description", description);
                        normalized.add(item);
                }
                return normalized;
        }

        private String readString(Map<String, Object> item, String... keys) {
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

        private Map<String, Object> fallbackBuildItem(Object rawItem) {
                Map<String, Object> fallback = new HashMap<>();
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
                                        Map<String, Object> parsed = objectMapper.readValue(trimmed, new TypeReference<Map<String, Object>>() {});
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

        private Map<String, Object> normalizeItemToMap(Object rawItem) {
                if (rawItem == null) {
                        return new HashMap<>();
                }

                if (rawItem instanceof Map<?, ?> map) {
                        Map<String, Object> normalized = new HashMap<>();
                        for (Map.Entry<?, ?> entry : map.entrySet()) {
                                if (entry.getKey() != null) {
                                        normalized.put(String.valueOf(entry.getKey()), entry.getValue());
                                }
                        }
                        return normalized;
                }

                try {
                        Map<String, Object> converted = objectMapper.convertValue(
                                rawItem,
                                new TypeReference<Map<String, Object>>() {}
                        );
                        if (!converted.isEmpty()) {
                                return new HashMap<>(converted);
                        }
                } catch (Exception ignored) {
                }

                try {
                        if (rawItem != null) {
                                var tree = objectMapper.valueToTree(rawItem);
                                if (tree instanceof ObjectNode objectNode) {
                                        Map<String, Object> converted = objectMapper.convertValue(objectNode, new TypeReference<Map<String, Object>>() {});
                                        if (!converted.isEmpty()) {
                                                return new HashMap<>(converted);
                                        }
                                }
                        }
                } catch (Exception ignored) {
                }

                try {
                        var bean = java.beans.Introspector.getBeanInfo(rawItem.getClass()).getPropertyDescriptors();
                        Map<String, Object> normalized = new HashMap<>();
                        for (var desc : bean) {
                                String name = desc.getName();
                                var read = desc.getReadMethod();
                                if (read == null || name.equals("class")) {
                                        continue;
                                }
                                Object value = read.invoke(rawItem);
                                if (value != null) {
                                        normalized.put(name, value);
                                }
                        }
                        return normalized;
                } catch (Exception ignored) {
                        return new HashMap<>();
                }
        }

        private List<String> toStringList(Object value) {
                if (!(value instanceof List<?> list)) {
                        return List.of();
                }
                return list.stream()
                                .map(this::normalizeText)
                                .filter(v -> !v.isBlank())
                                .toList();
        }

        private List<String> extractTagList(Map<String, Object> item) {
                if (item == null) {
                        return List.of();
                }

                Object tagsValue = item.get("tags");
                if (tagsValue == null) {
                        tagsValue = item.get("itemTags");
                }
                if (tagsValue == null) {
                        tagsValue = item.get("item_tags");
                }
                return toStringList(tagsValue);
        }

        private String resolveCategoryFromPurchaseUrl(String purchaseUrl) {
                if (isBlank(purchaseUrl)) {
                        return "";
                }

                try {
                        String category = UriComponentsBuilder.fromUriString(purchaseUrl)
                                        .build(true)
                                        .getQueryParams()
                                        .getFirst("category");
                        if (!isBlank(category)) {
                                String normalized = category.toLowerCase(Locale.ROOT).trim();
                                return normalizeCategory(normalized);
                        }
                } catch (Exception ignored) {
                }
                return "";
        }

        private String resolveCategoryFromText(String text) {
                String normalized = normalizeText(text).toLowerCase(Locale.ROOT);
                if (normalized.isBlank()) {
                        return "";
                }

                return switch (normalizedCategoryKey(normalized)) {
                        case "top" -> "top";
                        case "bottom" -> "bottom";
                        case "outer" -> "outer";
                        case "shoes" -> "shoes";
                        case "accessory" -> "accessory";
                        default -> "";
                };
        }

        private String resolveCategoryFromTags(List<String> tags) {
                if (tags == null || tags.isEmpty()) {
                        return "";
                }
                return normalizeCategory(String.join(" ", tags));
        }

        private String normalizeCategory(String value) {
                if (isBlank(value)) {
                        return "";
                }
                String normalized = normalizeText(value);
                if (normalized.equals("top") || normalized.equals("상의")) {
                        return "top";
                }
                if (normalized.equals("bottom") || normalized.equals("하의")) {
                        return "bottom";
                }
                if (normalized.equals("outer") || normalized.equals("아우터")) {
                        return "outer";
                }
                if (normalized.equals("shoes") || normalized.equals("신발")) {
                        return "shoes";
                }
                if (normalized.equals("accessory") || normalized.equals("악세서리") || normalized.equals("액세서리")) {
                        return "accessory";
                }
                return "";
        }

        private String normalizedCategoryKey(String normalizedText) {
                if (normalizedText.contains("티셔츠") || normalizedText.contains("셔츠") || normalizedText.contains("맨투맨")
                                || normalizedText.contains("후드") || normalizedText.contains("가디건") || normalizedText.contains("블라우스")
                                || normalizedText.contains("상의") || normalizedText.contains("top")) {
                        return "top";
                }
                if (normalizedText.contains("팬츠") || normalizedText.contains("바지") || normalizedText.contains("데님")
                                || normalizedText.contains("청바지") || normalizedText.contains("하의") || normalizedText.contains("치마")
                                || normalizedText.contains("bottom")) {
                        return "bottom";
                }
                if (normalizedText.contains("아우터") || normalizedText.contains("재킷") || normalizedText.contains("자켓")
                                || normalizedText.contains("코트") || normalizedText.contains("점퍼") || normalizedText.contains("패딩")
                                || normalizedText.contains("outer")) {
                        return "outer";
                }
                if (normalizedText.contains("신발") || normalizedText.contains("운동화") || normalizedText.contains("부츠")
                                || normalizedText.contains("구두") || normalizedText.contains("샌들") || normalizedText.contains("스니커즈")
                                || normalizedText.contains("shoes") || normalizedText.contains("shoes")) {
                        return "shoes";
                }
                if (normalizedText.contains("가방") || normalizedText.contains("모자") || normalizedText.contains("벨트")
                                || normalizedText.contains("시계") || normalizedText.contains("목걸이") || normalizedText.contains("팔찌")
                                || normalizedText.contains("악세서리") || normalizedText.contains("액세서리") || normalizedText.contains("accessory")) {
                        return "accessory";
                }
                return "other";
        }

        private String normalizeGenderFromSource(
                        String source,
                        String gender,
                        String title,
                        String description,
                        List<String> tags,
                        String purchaseUrl
                ) {
                String normalized = normalizeText(gender).toLowerCase(Locale.ROOT);
                String sourceType = normalizeText(source).toLowerCase(Locale.ROOT);
                String combined = (normalizeText(title) + " " + normalizeText(description) + " "
                                + String.join(" ", tags) + " " + normalizeText(purchaseUrl)).toLowerCase(Locale.ROOT);

                if (isValidGender(normalized)) {
                        if (isItemsSource(sourceType, purchaseUrl) && "unisex".equals(normalized) && isLikelyFemale(combined)) {
                                return "female";
                        }
                        if (isItemsSource(sourceType, purchaseUrl) && "unisex".equals(normalized) && isLikelyMale(combined)) {
                                return "male";
                        }
                        return normalized;
                }

                if (!isBlank(combined) && isLikelyFemale(combined)) {
                        return "female";
                }
                if (!isBlank(combined) && isLikelyMale(combined)) {
                        return "male";
                }

                if (isItemsSource(sourceType, purchaseUrl)) {
                        if (!isBlank(combined) && isLikelyFemale(combined)) {
                                return "female";
                        }
                        if (!isBlank(combined) && isLikelyMale(combined)) {
                                return "male";
                        }
                        return "unisex";
                }

                return "unisex";
        }

        private boolean shouldResolveGender(
                        String source,
                        String gender,
                        String title,
                        String description,
                        List<String> tags,
                        String purchaseUrl
                ) {
                if (!isValidGender(gender)) {
                        return true;
                }

                String normalizedSource = normalizeText(source).toLowerCase(Locale.ROOT);
                String normalizedGender = normalizeText(gender).toLowerCase(Locale.ROOT);
                if (!"unisex".equals(normalizedGender)) {
                        return false;
                }

                if (!isItemsSource(normalizedSource, purchaseUrl)) {
                        return false;
                }

                String combined = (normalizeText(title) + " " + normalizeText(description) + " "
                                + String.join(" ", tags)).toLowerCase(Locale.ROOT);
                return isLikelyFemale(combined) || isLikelyMale(combined);
        }

        private boolean isItemsSource(String source, String purchaseUrl) {
                if ("items".equals(source)) {
                        return true;
                }
                if (normalizeText(purchaseUrl).contains("/catalog/products/")) {
                        return true;
                }
                return false;
        }

        private boolean isLikelyFemale(String text) {
                return text.contains("스커트") || text.contains("원피스") || text.contains("블라우스") || text.contains("치마")
                                || text.contains("하이힐") || text.contains("레깅스")
                                || text.contains("우먼") || text.contains("women") || text.contains("womens")
                                || text.contains("여성") || text.contains("여자") || text.contains("여성복")
                                || text.contains("여성용");
        }

        private boolean isLikelyMale(String text) {
                return text.contains("남성") || text.contains("남자") || text.contains("남성용") || text.contains("남성복")
                                || text.contains("men") || text.contains("mens") || text.contains("man")
                                || text.contains("남자용") || text.contains("남자복");
        }

        private boolean isValidGender(String value) {
                return "male".equals(value) || "female".equals(value) || "unisex".equals(value);
        }

        private boolean isBlank(String value) {
                if (value == null) {
                        return true;
                }
                final String normalized = value.trim().toLowerCase(Locale.ROOT);
                return normalized.isEmpty() || "null".equals(normalized) || "undefined".equals(normalized)
                                || "none".equals(normalized);
        }

        private String normalizeText(Object value) {
                return value == null ? "" : String.valueOf(value).trim();
        }

        @Transactional(readOnly = true)
        public HomeStyleRecommendResponse recommendHomeGuestStyle(HomeStyleRecommendRequest request) {
                String effectiveGender = normalizeGender(request.getGender());
                if (effectiveGender == null || !ALLOWED_GENDERS.contains(effectiveGender)) {
                        throw new IllegalArgumentException("비로그인 홈 스타일 추천은 성별을 남성/여성으로 먼저 선택해야 합니다.");
                }

                FastApiResponse<HomeStyleRecommendResponse> aiResponse = callAiSafely(
                                "비로그인 홈 스타일 추천",
                                fastApiClient.recommendHomeStyle(
                                                request.getQuery(),
                                                request.getSeason(),
                                                null,
                                                effectiveGender,
                                                null,
                                                null,
                                                null,
                                                request.getOccasion(),
                                                0L)
                );

                if (aiResponse == null || !aiResponse.isSuccess()) {
                        String message = aiResponse != null ? aiResponse.getMessage() : "AI 응답이 없습니다";
                        throw new IllegalStateException("비로그인 홈 스타일 추천에 실패했습니다: " + message);
                }

                HomeStyleRecommendResponse result = aiResponse.getData();
                if (result == null) {
                        throw new IllegalStateException("비로그인 홈 스타일 추천에 실패했습니다: 응답 데이터가 없습니다");
                }

                normalizeHomeGenderWithCatalog(result, effectiveGender);

                return new HomeStyleRecommendResponse(
                        result.getRecommendation(),
                        result.getSets(),
                        result.getSources()
                );
        }

        private void normalizeHomeGenderWithCatalog(HomeStyleRecommendResponse response, String requestGender) {
                if (response == null || response.getSets() == null) {
                        return;
                }

                String targetGender = normalizeText(requestGender).toLowerCase(Locale.ROOT);
                boolean hasGenderRequest = isValidGender(targetGender);

                for (com.aistylist.dto.style.HomeStyleRecommendSetDto homeSet : response.getSets()) {
                        if (homeSet == null || homeSet.getItems() == null) {
                                continue;
                        }

                        Set<String> usedItems = new HashSet<>();
                        var iterator = homeSet.getItems().iterator();
                        while (iterator.hasNext()) {
                                var item = iterator.next();
                                if (item == null) {
                                        iterator.remove();
                                        continue;
                                }

                                String catalogGender = resolveCatalogGenderFromPurchaseUrl(item.getPurchaseUrl());
                                if (!catalogGender.isBlank()) {
                                        item.setGender(catalogGender);
                                }

                                if (hasGenderRequest && !isGenderCompatibleForCatalog(item.getGender(), targetGender)) {
                                        iterator.remove();
                                        continue;
                                }

                                String resolvedCategory = resolveCatalogCategory(item);
                                if (!resolvedCategory.isBlank()) {
                                        item.setCategory(resolvedCategory);
                                }

                                String itemKey = resolveItemDedupKey(item);
                                if (!usedItems.add(itemKey)) {
                                        iterator.remove();
                                }
                        }

                        int shoesCount = countCategory(homeSet.getItems(), "shoes");
                        if (shoesCount > 1) {
                                int remainShoes = 0;
                                var shoesPrune = homeSet.getItems().iterator();
                                while (shoesPrune.hasNext()) {
                                        var item = shoesPrune.next();
                                        if (item == null) {
                                                shoesPrune.remove();
                                                continue;
                                        }

                                        String category = normalizeCategory(normalizeText(item.getCategory()));
                                        if ("shoes".equals(category) && remainShoes >= 1) {
                                                shoesPrune.remove();
                                        } else if ("shoes".equals(category)) {
                                                remainShoes++;
                                        }
                                }
                                shoesCount = 1;
                        }

                        if (shoesCount == 0) {
                                com.aistylist.dto.style.HomeStyleSetItemDto fallback = pickFallbackShoes(targetGender, usedItems);
                                if (fallback != null) {
                                        homeSet.getItems().add(fallback);
                                        usedItems.add(resolveItemDedupKey(fallback));
                                        shoesCount = 1;
                                }
                        }

                        if (shoesCount == 0) {
                                String fallbackLabel = isValidGender(targetGender) ? "AI 추천" : "추천";
                                com.aistylist.dto.style.HomeStyleSetItemDto fallback = new com.aistylist.dto.style.HomeStyleSetItemDto();
                                fallback.setTitle("신발 추천 아이템");
                                fallback.setDescription("신발 추천 아이템");
                                fallback.setCategory("shoes");
                                fallback.setSource("AI 추천");
                                fallback.setSourceLabel(fallbackLabel);
                                fallback.setTag("신발");
                                homeSet.getItems().add(fallback);
                        }

                        if (homeSet.getItems() != null && homeSet.getItems().isEmpty()) {
                                homeSet.setItems(new java.util.ArrayList<>());
                        }
                }
        }

        private int countCategory(List<com.aistylist.dto.style.HomeStyleSetItemDto> items, String targetCategory) {
                if (items == null || isBlank(targetCategory)) {
                        return 0;
                }
                String normalizedTarget = normalizeCategory(targetCategory);
                int count = 0;
                for (com.aistylist.dto.style.HomeStyleSetItemDto item : items) {
                        if (item == null) {
                                continue;
                        }
                        if (normalizedTarget.equals(normalizeCategory(normalizeText(item.getCategory())))) {
                                count++;
                        }
                }
                return count;
        }

        private String resolveItemDedupKey(com.aistylist.dto.style.HomeStyleSetItemDto item) {
                if (item == null) {
                        return "null";
                }

                String id = normalizeText(item.getId());
                if (!isBlank(id)) {
                        return "id:" + id.toLowerCase(Locale.ROOT);
                }

                String purchaseUrl = normalizeText(item.getPurchaseUrl());
                String catalogProductId = extractCatalogProductIdFromUrl(purchaseUrl);
                if (!isBlank(catalogProductId)) {
                        return "product:" + catalogProductId.toLowerCase(Locale.ROOT);
                }

                String title = normalizeText(item.getTitle());
                String brand = normalizeText(item.getBrand());
                String category = normalizeCategory(normalizeText(item.getCategory()));
                String tag = normalizeText(item.getTag());

                String source = normalizeText(item.getSource());
                StringBuilder dedupBuilder = new StringBuilder("fallback:");
                dedupBuilder.append("title=").append(isBlank(title) ? "-" : title.toLowerCase(Locale.ROOT));
                dedupBuilder.append("|brand=").append(isBlank(brand) ? "-" : brand.toLowerCase(Locale.ROOT));
                dedupBuilder.append("|category=").append(isBlank(category) ? "-" : category.toLowerCase(Locale.ROOT));
                dedupBuilder.append("|tag=").append(isBlank(tag) ? "-" : tag.toLowerCase(Locale.ROOT));
                dedupBuilder.append("|source=").append(isBlank(source) ? "-" : source.toLowerCase(Locale.ROOT));
                return dedupBuilder.toString();
        }

        private String resolveCatalogCategory(com.aistylist.dto.style.HomeStyleSetItemDto item) {
                if (item == null) {
                        return "";
                }

                String category = normalizeText(item.getCategory());
                if (!isBlank(category)) {
                        String normalized = normalizeCategory(category);
                        if (!isBlank(normalized)) {
                                return normalized;
                        }
                }

                String title = normalizeText(item.getTitle());
                String description = normalizeText(item.getDescription());
                String resolved = resolveCategoryFromText(title + " " + description);
                if (!isBlank(resolved)) {
                        return resolved;
                }

                resolved = resolveCategoryFromPurchaseUrl(normalizeText(item.getPurchaseUrl()));
                if (!isBlank(resolved)) {
                        return resolved;
                }

                return resolveCategoryFromTags(item.getTags());
        }

        private com.aistylist.dto.style.HomeStyleSetItemDto pickFallbackShoes(String requestGender, Set<String> usedItems) {
                if (!isValidGender(requestGender)) {
                        return null;
                }

                String whereClause = "category = 'shoes' AND (gender = ? OR gender = 'unisex')";
                String excludedClause = buildExcludeClauseFromItems(usedItems);
                if (!isBlank(excludedClause)) {
                        whereClause += " AND id NOT IN (" + excludedClause + ")";
                }

                String sql = "SELECT id, name, brand, color, category, image_url, purchase_url, price, tags, description, gender "
                                + "FROM items WHERE "
                                + whereClause + " ORDER BY random() LIMIT 20";
                List<Map<String, Object>> candidates = jdbcTemplate.queryForList(sql, requestGender);
                if (candidates == null || candidates.isEmpty()) {
                        return null;
                }

                for (Map<String, Object> row : candidates) {
                        com.aistylist.dto.style.HomeStyleSetItemDto candidate = mapCatalogRowToHomeSetItem(row);
                        if (candidate == null) {
                                continue;
                        }

                        String candidateKey = resolveItemDedupKey(candidate);
                        if (!isBlank(candidateKey) && usedItems != null && usedItems.contains(candidateKey)) {
                                continue;
                        }

                        return candidate;
                }
                return null;
        }

        private String buildExcludeClauseFromItems(Set<String> itemIds) {
                if (itemIds == null || itemIds.isEmpty()) {
                        return "";
                }

                return itemIds.stream()
                                .map(id -> "'" + id.replace("'", "''") + "'")
                                .reduce((left, right) -> left + "," + right)
                                .orElse("");
        }

        private com.aistylist.dto.style.HomeStyleSetItemDto mapCatalogRowToHomeSetItem(Map<String, Object> row) {
                if (row == null || row.isEmpty()) {
                        return null;
                }

                com.aistylist.dto.style.HomeStyleSetItemDto item = new com.aistylist.dto.style.HomeStyleSetItemDto();
                item.setId(normalizeText(row.get("id")));
                item.setTitle(normalizeText(row.get("name")));
                item.setDescription(normalizeText(row.get("description")));
                item.setGender(normalizeText(row.get("gender")));
                item.setImageUrl(normalizeText(row.get("image_url")));
                item.setPurchaseUrl(normalizeText(row.get("purchase_url")));
                item.setBrand(normalizeText(row.get("brand")));
                item.setCategory(normalizeCategory(normalizeText(row.get("category"))));
                item.setSource("items");

                String price = normalizeText(row.get("price"));
                if (!isBlank(price)) {
                        try {
                                item.setPrice(String.format("%,d원", Long.parseLong(price)));
                        } catch (Exception ignored) {
                                item.setPrice(price);
                        }
                }

                item.setPriceRange(null);
                item.setTags(extractTagList(row.get("tags")));
                item.setBrandLabel(formatBrandLabel(item.getBrand()));
                item.setSubtitle(item.getDescription());
                item.setPriceLabel(formatPriceLabel(item.getPrice()));
                item.setSourceLabel("items");
                item.setTag("신발");

                return item;
        }

        private String formatBrandLabel(String brand) {
                String normalized = normalizeText(brand);
                if (isBlank(normalized)) {
                        return "브랜드 확인";
                }
                return "브랜드 " + normalized;
        }

        private String formatPriceLabel(String price) {
                if (isBlank(price)) {
                        return "가격 확인";
                }
                return "가격 " + price;
        }

        private List<String> extractTagList(Object tagsValue) {
                if (tagsValue == null) {
                        return List.of();
                }

                if (tagsValue instanceof List<?> list) {
                        return toStringList(list);
                }

                if (tagsValue instanceof String text && !isBlank(text)) {
                        String normalized = text.trim();
                        if (normalized.startsWith("[")) {
                                try {
                                        return objectMapper.readValue(normalized, new TypeReference<List<String>>() {});
                                } catch (Exception ignored) {
                                }
                        }
                        return List.of(normalized);
                }

                return List.of();
        }

        private String resolveCatalogGenderFromPurchaseUrl(String purchaseUrl) {
                if (isBlank(purchaseUrl)) {
                        return "";
                }

                String productId = extractCatalogProductIdFromUrl(purchaseUrl);

                if (isBlank(productId)) {
                        return "";
                }

                try {
                        var genders = jdbcTemplate.queryForList(
                                "SELECT gender FROM items WHERE id = ? LIMIT 1",
                                String.class,
                                sanitizeCatalogProductId(productId)
                                );

                        if (genders == null || genders.isEmpty() || isBlank(genders.get(0))) {
                                log.warn("no catalog gender mapping found for productId={} (source={})", sanitizeCatalogProductId(productId), purchaseUrl);
                                return "";
                        }

                        return normalizeGender(genders.get(0));
                } catch (Exception e) {
                        log.warn("catalog gender lookup failed for {}: {}", productId, e.getMessage());
                        return "";
                }
        }

        private String extractCatalogProductIdFromUrl(String purchaseUrl) {
                if (isBlank(purchaseUrl)) {
                        return "";
                }

                String productId = null;
                try {
                        var queryParams = UriComponentsBuilder.fromUriString(purchaseUrl)
                                        .build(true)
                                        .getQueryParams();
                        for (String key : List.of("product_id", "item_id", "id")) {
                                String value = queryParams.getFirst(key);
                                if (!isBlank(value)) {
                                        return sanitizeCatalogProductId(value);
                                }
                        }

                        for (Map.Entry<String, java.util.List<String>> entry : queryParams.entrySet()) {
                                if ("purchase_url".equals(entry.getKey()) && entry.getValue() != null && !entry.getValue().isEmpty()) {
                                        String nestedPurchaseUrl = entry.getValue().get(0);
                                        if (!isBlank(nestedPurchaseUrl)) {
                                                try {
                                                        String decodedNested = URLDecoder.decode(nestedPurchaseUrl, StandardCharsets.UTF_8);
                                                        String nestedProductId = extractCatalogProductIdFromUrl(decodedNested);
                                                        if (!isBlank(nestedProductId)) {
                                                                return nestedProductId;
                                                        }
                                                } catch (Exception ignored) {
                                                }
                                        }
                                }
                        }
                } catch (Exception ignored) {
                }

                java.util.regex.Matcher matcher = java.util.regex.Pattern
                                .compile("(?i)([\\?&](?:product_id|item_id|id)=([^&]+))")
                                .matcher(purchaseUrl);
                if (matcher.find()) {
                        productId = matcher.group(2);
                        return sanitizeCatalogProductId(productId);
                }

                if (purchaseUrl.contains("/catalog/products/")) {
                        java.util.regex.Matcher pathMatcher = java.util.regex.Pattern
                                        .compile("/catalog/products/([^/?#]+)")
                                        .matcher(purchaseUrl);
                        if (pathMatcher.find()) {
                                return sanitizeCatalogProductId(pathMatcher.group(1));
                        }
                }

                return "";
        }

        private String sanitizeCatalogProductId(String productId) {
                if (isBlank(productId)) {
                        return "";
                }

                try {
                        productId = URLDecoder.decode(productId, StandardCharsets.UTF_8).trim().toLowerCase(Locale.ROOT);
                } catch (Exception ignored) {
                        productId = productId.trim().toLowerCase(Locale.ROOT);
                }

                String normalized = productId.split("[?#]", 2)[0];
                if (normalized.startsWith("/catalog/products/")) {
                        normalized = normalized.substring("/catalog/products/".length());
                }
                if (normalized.startsWith("/")) {
                        normalized = normalized.substring(1);
                }
                int slashIndex = normalized.indexOf("/");
                if (slashIndex >= 0) {
                        normalized = normalized.substring(0, slashIndex);
                }
                return normalized.trim();
        }

        private boolean isGenderCompatibleForCatalog(String itemGender, String requestedGender) {
                String normalizedItemGender = normalizeGender(itemGender);
                if ("male".equals(requestedGender)) {
                        return "male".equals(normalizedItemGender) || "unisex".equals(normalizedItemGender);
                }

                if ("female".equals(requestedGender)) {
                        return "female".equals(normalizedItemGender) || "unisex".equals(normalizedItemGender);
                }

                return true;
        }

        private <T> FastApiResponse<T> callAiSafely(String action, reactor.core.publisher.Mono<FastApiResponse<T>> caller) {
                try {
                        return caller.block();
                } catch (Exception ex) {
                        throw new IllegalStateException(action + " 처리 중 오류가 발생했습니다: " + ex.getMessage(), ex);
                }
        }
}
