package com.aistylist.controller;

/**
 * com/aistylist/controller/AssetController.java: Backend source file for style/recommendation related features.
 */

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@RestController
@RequestMapping("/api/assets")
public class AssetController {
    private static final Pattern OG_IMAGE_PATTERN = Pattern.compile(
            "<meta\\s+property=[\"']og:image[\"']\\s+content=[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern TWITTER_IMAGE_PATTERN = Pattern.compile(
            "<meta\\s+name=[\"']twitter:image[\"']\\s+content=[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern GOODS_IMAGE_URL_PATTERN = Pattern.compile(
            "https?://[^\"'\\s>]+",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern SALE_PRICE_PATTERN = Pattern.compile(
            "\"salePrice\"\\s*:\\s*\"?(\\d{2,9})\"?",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern GOODS_PRICE_PATTERN = Pattern.compile(
            "\"goodsPrice\"\\s*:\\s*\"?(\\d{2,9})\"?",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern NORMAL_PRICE_PATTERN = Pattern.compile(
            "\"normalPrice\"\\s*:\\s*\"?(\\d{2,9})\"?",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern JSON_PRICE_PATTERN = Pattern.compile(
            "\"price\"\\s*:\\s*\"?(\\d{2,9})\"?",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern WON_TEXT_PRICE_PATTERN = Pattern.compile(
            "([0-9]{1,3}(?:,[0-9]{3}){1,3})\\s*원",
            Pattern.CASE_INSENSITIVE
    );

    private final HttpClient httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @GetMapping("/image")
    public ResponseEntity<byte[]> proxyImage(
            @RequestParam(required = false) String productId,
            @RequestParam(required = false) String url,
            @RequestParam(required = false) String imageUrl
    ) {
        List<String> candidates = buildCandidates(productId, url, imageUrl);
        for (String candidate : candidates) {
            try {
                boolean isMusinsaHost = isMusinsaHost(candidate);
                HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                        .uri(URI.create(candidate))
                        .timeout(Duration.ofSeconds(8))
                        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                        .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8");
                if (isMusinsaHost) {
                    requestBuilder = requestBuilder.header("Referer", "https://www.musinsa.com/");
                }
                HttpRequest request = requestBuilder.GET().build();
                HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    log.debug("image candidate non-2xx: {} status={}", candidate, response.statusCode());
                    continue;
                }

                String contentType = response.headers().firstValue("content-type").orElse("application/octet-stream");
                String lowerContentType = contentType.toLowerCase(Locale.ROOT);
                if (!lowerContentType.startsWith("image/") && !lowerContentType.contains("octet-stream")) {
                    log.debug("image candidate invalid content-type: {} contentType={}", candidate, contentType);
                    continue;
                }

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.parseMediaType(contentType));
                headers.setCacheControl(CacheControl.maxAge(30, TimeUnit.MINUTES).cachePublic().getHeaderValue());
                return new ResponseEntity<>(response.body(), headers, HttpStatus.OK);
            } catch (Exception ex) {
                log.warn("image proxy request failed candidate={} errorType={} message={}",
                        candidate, ex.getClass().getSimpleName(), ex.getMessage());
            }
        }

        log.debug("image proxy no candidates succeeded");
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/price")
    public ResponseEntity<Map<String, Object>> getLivePrice(
            @RequestParam(required = false) String productId,
            @RequestParam(required = false) String url
    ) {
        List<String> candidates = buildPriceCandidates(productId, url);
        for (String candidate : candidates) {
            try {
                String html = fetchHtml(candidate);
                if (html.isBlank()) {
                    continue;
                }
                Long price = parsePriceFromHtml(html);
                if (price == null || price <= 0) {
                    continue;
                }

                Map<String, Object> payload = new HashMap<>();
                payload.put("success", true);
                payload.put("price", formatPrice(price));
                payload.put("value", price);
                payload.put("sourceUrl", candidate);
                return ResponseEntity.ok()
                        .cacheControl(CacheControl.maxAge(1, TimeUnit.MINUTES).cachePublic())
                        .body(payload);
            } catch (Exception ex) {
                log.warn("price proxy request failed candidate={} errorType={} message={}",
                        candidate, ex.getClass().getSimpleName(), ex.getMessage());
            }
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("success", false);
        payload.put("price", "");
        payload.put("value", null);
        payload.put("sourceUrl", "");
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .body(payload);
    }

    private boolean isMusinsaHost(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(value);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            return host.endsWith("msscdn.net") || host.contains("musinsa.com");
        } catch (Exception ex) {
            return false;
        }
    }

    private List<String> buildPriceCandidates(String productId, String url) {
        List<String> candidates = new ArrayList<>();
        String normalizedProductId = normalizeProductId(productId);
        String normalizedUrl = normalizeProductPageUrl(url);

        if (!normalizedProductId.isBlank()) {
            candidates.add("https://www.musinsa.com/products/" + normalizedProductId);
        }
        if (!normalizedUrl.isBlank()) {
            candidates.add(normalizedUrl);
        }

        if (normalizedProductId.isBlank() && !normalizedUrl.isBlank()) {
            String extractedId = extractProductId(normalizedUrl);
            if (!extractedId.isBlank()) {
                candidates.add("https://www.musinsa.com/products/" + extractedId);
            }
        }

        return candidates.stream().distinct().toList();
    }

    private List<String> buildCandidates(String productId, String url, String imageUrl) {
        List<String> candidates = new ArrayList<>();

        if (isAllowedImageUrl(imageUrl)) {
            candidates.add(normalizeImageUrl(imageUrl));
        }

        String resolvedProductId = normalizeProductId(productId);
        if (resolvedProductId.isBlank()) {
            resolvedProductId = extractProductId(url);
        }

        if (!resolvedProductId.isBlank()) {
            addGoodsImageCandidates(candidates, resolvedProductId);
        }

        if (isAllowedProductPage(url)) {
            List<String> pageImages = extractImagesFromProductPage(url);
            for (String pageImage : pageImages) {
                if (isAllowedImageUrl(pageImage)) {
                    candidates.add(normalizeImageUrl(pageImage));
                }
            }
        }

        return candidates;
    }

    private void addGoodsImageCandidates(List<String> candidates, String productId) {
        for (int index = 1; index <= 3; index++) {
            candidates.add(toGoodsImage(productId, "_" + index + "_500.jpg"));
            candidates.add(toGoodsImage(productId, "_" + index + "_400.jpg"));
            candidates.add(toGoodsImage(productId, "_" + index + "_125.jpg"));
            candidates.add(toGoodsImage(productId, "_" + index + "_500.png"));
            candidates.add(toGoodsImage(productId, "_" + index + "_500.webp"));
        }
        candidates.add(toGoodsImage(productId, "_1_1000.jpg"));
    }

    private String toGoodsImage(String productId, String suffix) {
        return "https://image.msscdn.net/images/goods_img/" + productId + "/" + productId + suffix;
    }

    private String extractProductId(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        try {
            URI uri = URI.create(value);
            String path = uri.getPath() == null ? "" : uri.getPath();
            String[] segments = path.split("/");
            for (int i = 0; i < segments.length - 1; i++) {
                if ("products".equals(segments[i])) {
                    String candidate = segments[i + 1];
                    if (candidate != null && candidate.matches("\\d{5,}")) {
                        return candidate;
                    }
                }
            }
        } catch (Exception ex) {
            return "";
        }
        return "";
    }

    private String normalizeProductPageUrl(String value) {
        if (!isAllowedProductPage(value)) {
            return "";
        }
        String trimmed = value.trim();
        try {
            URI uri = URI.create(trimmed);
            String path = uri.getPath() == null ? "" : uri.getPath();
            Matcher appGoodsMatcher = Pattern.compile("^/app/goods/(\\d{5,})$", Pattern.CASE_INSENSITIVE).matcher(path);
            if (appGoodsMatcher.find()) {
                return "https://www.musinsa.com/products/" + appGoodsMatcher.group(1);
            }
            if (path.matches("^/products/\\d{5,}$")) {
                return trimmed;
            }
            String extracted = extractProductId(trimmed);
            if (!extracted.isBlank()) {
                return "https://www.musinsa.com/products/" + extracted;
            }
            return "";
        } catch (Exception ex) {
            return "";
        }
    }

    private String normalizeProductId(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.matches("\\d{5,}") ? trimmed : "";
    }

    private boolean isAllowedImageUrl(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(normalizeImageUrl(value));
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            return host.equals("image.msscdn.net")
                    || host.endsWith(".msscdn.net")
                    || host.equals("img.musinsa.com")
                    || host.equals("musinsa.com")
                    || host.equals("www.musinsa.com");
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean isAllowedProductPage(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(value.trim());
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            return host.equals("musinsa.com") || host.equals("www.musinsa.com");
        } catch (Exception ex) {
            return false;
        }
    }

    private List<String> extractImagesFromProductPage(String productUrl) {
        List<String> extracted = new ArrayList<>();
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(productUrl))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return extracted;
            }
            String html = new String(response.body(), StandardCharsets.UTF_8);

            Matcher ogMatcher = OG_IMAGE_PATTERN.matcher(html);
            if (ogMatcher.find()) {
                extracted.add(ogMatcher.group(1));
            }

            Matcher twitterMatcher = TWITTER_IMAGE_PATTERN.matcher(html);
            if (twitterMatcher.find()) {
                extracted.add(twitterMatcher.group(1));
            }

            Matcher goodsMatcher = GOODS_IMAGE_URL_PATTERN.matcher(html);
            while (goodsMatcher.find()) {
                extracted.add(goodsMatcher.group());
            }
            return extracted;
        } catch (Exception ex) {
            return extracted;
        }
    }

    private String fetchHtml(String productUrl) {
        if (!isAllowedProductPage(productUrl)) {
            return "";
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(productUrl))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return "";
            }
            return new String(response.body(), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            return "";
        }
    }

    private Long parsePriceFromHtml(String html) {
        Long salePrice = extractNumericPrice(SALE_PRICE_PATTERN, html);
        if (salePrice != null && salePrice > 0) {
            return salePrice;
        }
        Long goodsPrice = extractNumericPrice(GOODS_PRICE_PATTERN, html);
        if (goodsPrice != null && goodsPrice > 0) {
            return goodsPrice;
        }
        Long normalPrice = extractNumericPrice(NORMAL_PRICE_PATTERN, html);
        if (normalPrice != null && normalPrice > 0) {
            return normalPrice;
        }
        Long jsonPrice = extractNumericPrice(JSON_PRICE_PATTERN, html);
        if (jsonPrice != null && jsonPrice > 0) {
            return jsonPrice;
        }
        Long textPrice = extractNumericPrice(WON_TEXT_PRICE_PATTERN, html);
        if (textPrice != null && textPrice > 0) {
            return textPrice;
        }
        return null;
    }

    private Long extractNumericPrice(Pattern pattern, String html) {
        Matcher matcher = pattern.matcher(html);
        while (matcher.find()) {
            String raw = matcher.group(1);
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String digitsOnly = raw.replaceAll("[^0-9]", "");
            if (digitsOnly.isBlank()) {
                continue;
            }
            try {
                long value = Long.parseLong(digitsOnly);
                if (value > 100) {
                    return value;
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private String formatPrice(Long value) {
        if (value == null || value <= 0) {
            return "";
        }
        return String.format(Locale.KOREA, "%,d원", value);
    }

    private String normalizeImageUrl(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.startsWith("//")) {
            return "https:" + trimmed;
        }
        return trimmed;
    }

}
