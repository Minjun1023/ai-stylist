
import re
from typing import List
from urllib.parse import parse_qs, unquote, urlparse

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.style import (
    HomeRecommendationSet,
    HomeStyleRecommendRequest,
    HomeStyleRecommendResponse,
    HomeStyleSetItem,
    StyleItem,
    StyleRecommendRequest,
    StyleRecommendResponse,
)
from app.services.openai_client import chat_completion, get_embedding
from app.services.response_parser import parse_json_to_model
from app.services.shopping_service import (
    build_items_from_text,
    enrich_style_items,
    filter_items_by_gender,
    get_catalog_item_by_product_id,
    _coerce_gender_for_matching,
    _is_gender_compatible,
    search_shopping_products_by_category,
    search_shopping_products,
    search_shopping_products_with_gender,
)

STYLE_RECOMMENDATION_COUNT = 9
HOME_RECOMMENDATION_CORE_SIZE = 3
HOME_RECOMMENDATION_MAX_SIZE = 4
MAX_HOME_RECOMMENDATION_SETS = 10
MIN_HOME_RECOMMENDATION_SETS = 3

_HOME_CATEGORY_KEYWORDS = {
    "top": ["티셔츠", "셔츠", "니트", "스웨터", "후드", "맨투맨", "가디건", "블라우스", "탑", "tee", "shirt", "상의"],
    "bottom": ["팬츠", "슬랙스", "바지", "데님", "청바지", "치노", "스커트", "레깅스", "하의", "bottom", "pants", "slacks", "jeans", "치마"],
    "shoes": ["신발", "스니커즈", "운동화", "부츠", "로퍼", "구두", "샌들", "슈즈", "sneaker", "boots", "shoes"],
    "accessory": ["가방", "백", "모자", "비니", "벨트", "목걸이", "귀걸이", "팔찌", "시계", "반지", "스카프", "캡", "bag", "cap", "belt", "watch", "necklace"],
    "outer": ["아우터", "재킷", "자켓", "코트", "점퍼", "블레이저", "패딩", "집업", "jacket", "coat"],
}
_HOME_REQUIRED_CATEGORIES = ("top", "bottom", "shoes")
_HOME_OPTIONAL_CATEGORY_ORDER = ("outer", "accessory")
_HOME_DISPLAY_CATEGORY_ORDER = ("outer", "top", "bottom", "shoes", "accessory", "other")
_HOME_CATEGORY_QUERY_SUFFIX = {
    "top": "상의",
    "bottom": "하의",
    "shoes": "신발",
    "accessory": "악세서리",
    "outer": "아우터",
}
_HOME_CATEGORY_KR_LABEL = {
    "top": "상의",
    "bottom": "하의",
    "shoes": "신발",
    "accessory": "악세서리",
    "outer": "아우터",
    "other": "아이템",
}


def _normalize_request_gender(value: str | None) -> str | None:
    normalized = _coerce_gender_for_matching(value)
    if normalized in {"male", "female"}:
        return normalized
    return None

_SEASONAL_CONTEXTS = {
    "spring_warm": {
        "keywords": ["spring", "spring warm", "봄", "웜톤", "따뜻한", "밝은", "가벼운"],
        "palette_positive": ["아이보리", "베이지", "크림", "핑크", "코랄", "연청", "라이트"],
        "palette_negative": ["올블랙", "네온", "짙은 네이비", "딥 퍼플", "진한 오렌지"],
    },
    "summer_cool": {
        "keywords": ["summer", "summer cool", "여름", "쿨톤", "소프트", "파스텔", "차분한", "밝은"],
        "palette_positive": ["라벤더", "라이트 블루", "민트", "핑크", "베이지", "화이트", "연회색"],
        "palette_negative": ["고채도 주황", "올리브", "카키", "진한 갈색", "강한 레드"],
    },
    "autumn_warm": {
        "keywords": ["autumn", "autumn warm", "가을", "웜톤", "브라운", "올리브", "카멜", "테라코타"],
        "palette_positive": ["브라운", "카키", "카멜", "머스타드", "버건디", "올리브", "차콜"],
        "palette_negative": ["차가운 블루", "민트", "라벤더", "네온", "연핑크"],
    },
    "winter_cool": {
        "keywords": ["winter", "winter cool", "겨울", "쿨톤", "고대비", "선명한", "클래식"],
        "palette_positive": ["블랙", "화이트", "네이비", "차콜", "레드", "에메랄드", "회색"],
        "palette_negative": ["누리끼리한", "황토", "올리브", "브라운톤 과다", "연카멜"],
    },
}

_OCCASION_TOKENS = {
    "date": ["데이트", "여자친구", "남자친구", "연인", "미팅", "저녁", "romance"],
    "office": ["출근", "오피스", "회사", "면접", "회의", "업무", "interview", "면담", "직장"],
    "travel": ["여행", "출장", "휴가", "항공", "호텔", "산책", "캠핑", "야외", "트래블"],
    "casual": ["일상", "데일리", "편안", "가벼운", "쇼핑", "산책"],
    "event": ["파티", "행사", "결혼식", "세미나", "피로연", "공연"],
}

_ITEM_REASON_CATEGORY_LABEL = {
    "top": "상의",
    "bottom": "하의",
    "shoes": "신발",
    "outer": "아우터",
    "accessory": "액세서리",
    "other": "아이템",
}


def _normalize_lower(value: str | None) -> str:
    return (value or "").strip().lower()


def _is_real_value(value: str | None) -> bool:
    normalized = _normalize_text(value)
    if not normalized:
        return False
    lower = normalized.lower()
    return lower not in {"null", "none", "undefined", ""} and not normalized.isspace()


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).replace("\n", " ").replace("\r", " ").split()).strip()


def _sanitize_catalog_product_id_for_rag(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if not normalized:
        return ""

    normalized = unquote(normalized)
    normalized = normalized.split("
    if normalized.startswith("/catalog/products/"):
        normalized = normalized.removeprefix("/catalog/products/").strip()
    if normalized.startswith("/"):
        normalized = normalized[1:]
    normalized = normalized.split("/", 1)[0]
    return normalized.strip()


def _extract_catalog_product_id_for_rag(value: str | None) -> str:
    normalized = (value or "").strip()
    if not normalized:
        return ""

    try:
        parsed = urlparse(normalized)
    except Exception:
        parsed = None

    if parsed:
        query_values = parse_qs(parsed.query)
        for key in ("product_id", "item_id", "id"):
            candidate = (query_values.get(key) or [None])[0]
            if candidate:
                sanitized = _sanitize_catalog_product_id_for_rag(candidate)
                if sanitized:
                    return sanitized

        nested_purchase_urls = query_values.get("purchase_url") or []
        for nested in nested_purchase_urls:
            if not nested:
                continue
            nested_candidate = _extract_catalog_product_id_for_rag(unquote(str(nested)))
            if nested_candidate:
                return nested_candidate

        path = (parsed.path or "").strip()
        if path.startswith("/catalog/products/"):
            candidate = path.removeprefix("/catalog/products/").strip()
            sanitized = _sanitize_catalog_product_id_for_rag(candidate)
            if sanitized:
                return sanitized

    for key in ("product_id", "item_id", "id"):
        match = re.search(rf"[?&]{key}=([^&]+)", normalized, flags=re.IGNORECASE)
        if match:
            sanitized = _sanitize_catalog_product_id_for_rag(match.group(1))
            if sanitized:
                return sanitized

    if "/catalog/products/" in normalized:
        match = re.search(r"/catalog/products/([^/?
        if match:
            return _sanitize_catalog_product_id_for_rag(match.group(1))

    return ""


def _normalize_style_item_output(item: StyleItem, fallback_query: str) -> StyleItem:
    ensured = _ensure_style_item_fields(item, fallback_query=fallback_query)
    category = _normalize_text(ensured.category) or "other"
    gender = _normalize_text(ensured.gender) or "unisex"
    if category != _normalize_home_category(category):
        category = _detect_home_category(ensured) or "other"
    return StyleItem(
        title=ensured.title,
        description=ensured.description,
        category=category,
        gender=gender,
        image_url=ensured.image_url,
        purchase_url=ensured.purchase_url,
        brand=ensured.brand,
        price=ensured.price,
        source=ensured.source,
        tags=ensured.tags,
    )


def _extract_requested_season(value: str | None) -> str:
    normalized = _normalize_lower(value)
    if not normalized:
        return ""

    season_keywords = {
        "spring_warm": ["봄", "spring", "웜톤", "spring warm", "따뜻한", "봄용", "봄코디", "봄옷"],
        "summer_cool": ["여름", "summer", "summer cool", "시원한", "여름용", "여름 코디", "썸머", "한여름"],
        "autumn_warm": ["가을", "autumn", "autumn warm", "가을용", "오렌지톤", "가을코디", "단풍"],
        "winter_cool": ["겨울", "winter", "winter cool", "겨울용", "겨울 코디", "추운", "긴팔"],
    }

    for key, tokens in season_keywords.items():
        if any(token in normalized for token in tokens):
            return key

    return ""


def _normalize_recommendation_items(items: list[StyleItem], max_items: int = 5) -> list[StyleItem]:
    normalized: list[StyleItem] = []
    limit = max(1, min(max_items, 5))
    for item in items:
        title = _normalize_text(item.title) or "추천 아이템"
        description = _normalize_text(item.description) or f"{title} 스타일 구성에 어울리는 아이템입니다."
        purchase_url = _normalize_text(item.purchase_url)
        if not purchase_url:
            continue

        normalized.append(
            StyleItem(
                title=title,
                description=description,
                category=_normalize_text(item.category) or "other",
                gender=_normalize_text(item.gender) or "unisex",
                image_url=_normalize_text(item.image_url),
                purchase_url=purchase_url,
                brand=_normalize_text(item.brand),
                price=_normalize_text(item.price),
                source=_normalize_text(item.source),
                tags=item.tags or [],
            )
        )
        if len(normalized) >= limit:
            break

    return normalized


def _ensure_style_item_fields(item: StyleItem, fallback_query: str = "") -> StyleItem:
    source_category = _normalize_home_category(item.category) if _is_real_value(item.category) else "other"
    resolved_category = source_category

    if item.purchase_url:
        try:
            parsed = parse_qs(urlparse(item.purchase_url).query)
            raw_category = (parsed.get("category") or [None])[0]
            if raw_category:
                normalized = _normalize_home_category(str(raw_category))
                if normalized != "other":
                    resolved_category = normalized
        except Exception:
            pass

    if resolved_category == "other":
        resolved_category = _detect_home_category(item)
        if resolved_category == "other":
            resolved_category = _detect_home_category(
                StyleItem(
                    title=fallback_query,
                    description=item.description,
                    brand=item.brand,
                    image_url=item.image_url,
                    purchase_url=item.purchase_url,
                    price=item.price,
                    source=item.source,
                    tags=item.tags,
                )
            )

    normalized_gender = _resolve_gender_from_product_id(item)
    if not normalized_gender:
        normalized_gender = _coerce_gender_for_matching(item.gender) if _is_real_value(item.gender) else ""
    if normalized_gender == "unisex" and is_likely_female_product(item.title, item.description, item.tags):
        normalized_gender = "female"
    if not normalized_gender:
        normalized_gender = (
            "female" if is_likely_female_product(item.title, item.description, item.tags) else "unisex"
        )

    if not resolved_category or resolved_category == "other":
        resolved_category = _detect_home_category(
            StyleItem(
                title=fallback_query,
                description=item.description,
                brand=item.brand,
                image_url=item.image_url,
                purchase_url=item.purchase_url,
                price=item.price,
                source=item.source,
                tags=item.tags,
            )
        ) or "other"

    return StyleItem(
        title=item.title,
        description=item.description,
        category=resolved_category,
        gender=normalized_gender,
        image_url=item.image_url,
        purchase_url=item.purchase_url,
        brand=item.brand,
        price=item.price,
        source=item.source,
        tags=item.tags,
    )


def _build_style_context(request: StyleRecommendRequest) -> dict[str, list[str] | str]:
    requested_season = _extract_requested_season(request.season)
    if not requested_season:
        season_source = " ".join(filter(None, [request.query, request.occasion]))
        requested_season = _extract_requested_season(season_source)

    profile_season = _normalize_lower(request.personal_color)
    season_key = requested_season or profile_season
    occasion_text = _normalize_lower(request.occasion)
    season_meta = _SEASONAL_CONTEXTS.get(season_key, {})

    detected_occasion = "일반"
    occasion_hits: list[str] = []
    for key, tokens in _OCCASION_TOKENS.items():
        if any(token in occasion_text for token in tokens):
            detected_occasion = key
            occasion_hits.extend(tokens)

    if not occasion_hits and occasion_text:
        occasion_hits = [request.occasion or ""]

    return {
        "season": season_key,
        "season_keywords": list(season_meta.get("keywords", [])),
        "palette_positive": list(season_meta.get("palette_positive", [])),
        "palette_negative": list(season_meta.get("palette_negative", [])),
        "requested_season": requested_season,
        "profile_season": profile_season,
        "occasion": detected_occasion,
        "occasion_keywords": occasion_hits,
        "age_group": request.age_group or "",
        "body_type": request.body_type or "",
        "style_mood_preference": request.style_mood_preference or "",
        "gender": request.gender or "",
    }


def _build_sources(documents: List[dict]) -> List[str]:
    """RAG 검색 결과를 사람이 읽기 쉬운 출처 문자열로 정제해 반환한다."""
    prepared: List[str] = []
    for index, doc in enumerate(documents, start=1):
        try:
            similarity = float(doc.get("similarity") or 0.0)
        except (TypeError, ValueError):
            similarity = 0.0

        if similarity < 0.5:
            continue

        doc_id = _normalize_text(str(doc.get("id") or ""))
        if doc_id:
            doc_id = f"지식베이스

        personal_color = _normalize_lower(doc.get("personal_color") or "")
        occasion = _normalize_lower(doc.get("occasion") or "")
        content = _normalize_text(doc.get("content") or "")
        if not content:
            continue

        title = content.split("\n", 1)[0].strip()
        if len(title) > 68:
            title = title[:65] + "..."
        if not title:
            title = "스타일 가이드"

        context_parts = ["RAG"]
        if doc_id:
            context_parts.append(doc_id)
        if personal_color:
            context_parts.append(f"톤:{personal_color}")
        if occasion:
            context_parts.append(f"상황:{occasion}")

        context_label = " | ".join(context_parts)
        prepared.append(f"[{index}] {context_label} (유사도 {similarity:.2f}) {title}")

    deduped = []
    seen = set()
    for source in prepared:
        key = _normalize_text(source)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(source)

    return deduped[:4] if deduped else ["참고 자료 없음"]


def _build_home_query(request: HomeStyleRecommendRequest) -> str:
    profile_bits: list[str] = ["홈 코디 추천", request.personal_color or "일반"]
    if request.occasion:
        profile_bits.append(f"{request.occasion} 상황")
    if request.gender:
        profile_bits.append("남성 기준" if request.gender == "male" else "여성 기준")
    if request.age_group:
        profile_bits.append(request.age_group)
    if request.body_type:
        profile_bits.append(request.body_type)
    if request.style_mood_preference:
        profile_bits.append(request.style_mood_preference)
    profile_bits.append("상하의/신발 조합")
    return " ".join(bit for bit in profile_bits if bit).strip() or request.query


def _normalize_home_category(value: str | None) -> str:
    normalized = _normalize_text(value or "").strip().lower()
    if not normalized:
        return "other"

    if normalized in {"outer", "top", "bottom", "shoes", "accessory"}:
        return normalized

    if normalized in {"아우터", "재킷", "자켓", "자켓", "코트", "점퍼", "블레이저", "패딩"}:
        return "outer"
    if normalized in {"상의", "티셔츠", "셔츠", "니트", "스웨터", "후드", "맨투맨", "가디건", "블라우스", "탑"}:
        return "top"
    if normalized in {"하의", "팬츠", "슬랙스", "바지", "데님", "청바지", "치노", "진"}:
        return "bottom"
    if normalized in {"신발", "스니커즈", "운동화", "부츠", "로퍼", "구두", "샌들", "슈즈"}:
        return "shoes"
    if normalized in {"악세서리", "액세서리", "가방", "백", "모자", "벨트", "목걸이", "반지", "시계", "스카프"}:
        return "accessory"

    return "other"


def is_likely_female_product(title: str | None, description: str | None, tags: list[str] | None) -> bool:
    text = _normalize_text(" ".join(filter(None, [title, description, " ".join(tags or [])]))).lower()
    return any(
        keyword in text
        for keyword in [
            "스커트",
            "원피스",
            "블라우스",
            "치마",
            "하이힐",
            "레깅스",
            "우먼",
            "여성",
            "여자",
            "여성용",
            "여성복",
            "women",
            "woman",
            "womens",
            "lady",
            "ladies",
        ]
    )


def _resolve_gender_from_product_id(item: StyleItem) -> str:
    if not item.purchase_url:
        return ""

    product_id = _extract_catalog_product_id_for_rag(item.purchase_url)
    if not product_id:
        return ""

    catalog_item = get_catalog_item_by_product_id(str(product_id))
    if not catalog_item:
        return ""

    return _coerce_gender_for_matching(str(catalog_item.get("gender") or ""))


def _normalize_home_item_key(item: StyleItem) -> str:
    url = _normalize_text(item.purchase_url)
    if url:
        return url.split("?")[0].lower()

    image = _normalize_text(item.image_url)
    title = _normalize_text(item.title).lower()
    brand = _normalize_text(item.brand).lower()
    return f"{image}|{title}|{brand}".strip("|")


def _normalize_home_set_output_key(item: StyleItem | HomeStyleSetItem) -> str:
    if isinstance(item, HomeStyleSetItem):
        if item.purchase_url:
            return _normalize_text(item.purchase_url).split("?")[0].lower()

        image = _normalize_text(item.image_url)
        title = _normalize_text(item.title).lower()
        brand = _normalize_text(item.brand).lower()
        category = _normalize_text(item.category).lower()
        return f"{category}|{image}|{title}|{brand}".strip("|")

    return _normalize_home_item_key(item)


def _build_home_set_signature(items: list[StyleItem] | list[HomeStyleSetItem]) -> tuple[str, ...]:
    keys: list[str] = []
    for item in items:
        key = _normalize_home_set_output_key(item)
        if key:
            keys.append(key)
    return tuple(sorted(keys))


def _resolve_catalog_gender_hint(item: StyleItem | HomeStyleSetItem) -> str:
    if not item.purchase_url:
        return ""

    product_id = _extract_catalog_product_id_for_rag(item.purchase_url)
    if not product_id:
        return ""

    catalog_item = get_catalog_item_by_product_id(str(product_id))
    if not catalog_item:
        return ""

    return _coerce_gender_for_matching(str(catalog_item.get("gender") or ""))


def _is_home_candidate_compatible(item: StyleItem | HomeStyleSetItem, gender: str | None) -> bool:
    if not gender:
        return True

    if not _is_gender_compatible(item.gender, gender):
        return False

    normalized_gender = (gender or "").strip().lower()
    catalog_gender = _resolve_catalog_gender_hint(item)
    if catalog_gender:
        if not _is_gender_compatible(catalog_gender, gender):
            return False

    if normalized_gender == "male" and is_likely_female_product(item.title, item.description, item.tags):
        return False

    return True


def _detect_home_category(item: StyleItem) -> str:
    if item.category:
        mapped = _normalize_home_category(item.category)
        if mapped != "other":
            return mapped

    tags_text = " ".join(item.tags or [])
    text = _normalize_text(" ".join(filter(None, [item.category, item.title, item.description, item.brand, tags_text, item.purchase_url]))).lower()
    for category, keywords in _HOME_CATEGORY_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return category
    return "other"


def _order_home_items(items: List[StyleItem]) -> List[StyleItem]:
    grouped = {category: [] for category in _HOME_DISPLAY_CATEGORY_ORDER}
    grouped["other"] = []

    for item in items:
        category = _detect_home_category(item)
        grouped.setdefault(category, grouped["other"]).append(item)

    ordered: list[StyleItem] = []
    used = set()
    for category in _HOME_DISPLAY_CATEGORY_ORDER:
        for candidate in grouped.get(category, []):
            key = _normalize_home_item_key(candidate)
            if key in used:
                continue
            used.add(key)
            ordered.append(candidate)

    for candidate in items:
        key = _normalize_home_item_key(candidate)
        if key in used:
            continue
        used.add(key)
        ordered.append(candidate)

    return ordered


def _placeholder_home_item(category: str) -> HomeStyleSetItem:
    category_label = _HOME_CATEGORY_KR_LABEL.get(category, category)
    return HomeStyleSetItem(
        title=f"{category_label} 추천 아이템",
        description=f"{category_label} 추천 아이템",
        category=category,
        image_url=None,
        purchase_url=None,
        brand=None,
        price=None,
        source="AI 추천",
        tags=[category_label],
        brand_label="브랜드 확인",
        subtitle=f"{category_label} 아이템",
        price_label="가격 확인",
        source_label="AI 추천",
    )


def _build_home_set_item(item: StyleItem, index: int = 1) -> HomeStyleSetItem:
    category = _detect_home_category(item)
    source = _normalize_text(item.source) or "AI 추천"
    brand = _normalize_text(item.brand)
    title = _normalize_text(item.title) or f"추천 아이템 {index}"
    description = _normalize_text(item.description)
    if not description:
        description = f"{brand + ' ' if brand else ''}{title} 추천 아이템"
    elif title not in description:
        description = f"{brand + ' ' if brand else ''}{title}"

    existing_tags = item.tags or []
    merged_tags = [tag for tag in existing_tags if tag]
    if category not in merged_tags:
        merged_tags.append(category)
    if category == "other":
        merged_tags.append(_HOME_CATEGORY_KR_LABEL[category])

    return HomeStyleSetItem(
        category=category,
        title=title,
        description=description,
        image_url=item.image_url,
        purchase_url=item.purchase_url,
        brand=brand or None,
        price=item.price,
        source=source,
        gender=_coerce_gender_for_matching(item.gender),
        tags=merged_tags,
        brand_label=f"브랜드 {brand}" if brand else "브랜드 확인",
        subtitle=description,
        price_label=f"가격 {item.price}" if item.price else "가격 확인",
        source_label=source,
    )


def _pick_candidate(
    candidates: List[StyleItem],
    start: int,
    blocked: set[str],
) -> tuple[StyleItem | None, int]:
    if not candidates:
        return None, start

    for offset in range(len(candidates)):
        item = candidates[(start + offset) % len(candidates)]
        key = _normalize_home_item_key(item)
        if key in blocked:
            continue
        return item, (start + offset + 1) % len(candidates)

    return None, start


def _to_home_set(set_no: int, items: List[StyleItem]) -> HomeRecommendationSet:
    ordered = [
        _build_home_set_item(item, index + 1)
        if isinstance(item, StyleItem)
        else _placeholder_home_item(f"아이템 {index + 1}")
        for index, item in enumerate(_order_home_items(items))
    ]

    ordered = ordered[:HOME_RECOMMENDATION_MAX_SIZE]
    summary = " · ".join([item.title for item in ordered if item.title]).strip(" · ")

    return HomeRecommendationSet(
        id=f"home-set-{set_no}",
        title=f"코디 세트 {set_no}",
        summary=summary or "스타일 추천",
        tag="AI 추천",
        items=ordered,
    )


def _build_home_recommendation_sets(
    items: List[StyleItem],
    gender: str | None = None,
    used_set_signatures: set[tuple[str, ...]] | None = None,
) -> List[HomeRecommendationSet]:
    if not items:
        return []

    used_set_signatures = used_set_signatures or set()

    deduped: list[StyleItem] = []
    seen: set[str] = set()
    for item in items:
        key = _normalize_home_item_key(item)
        if key in seen:
            continue
        if not _is_home_candidate_compatible(item, gender):
            continue
        seen.add(key)
        deduped.append(item)

    buckets: dict[str, list[StyleItem]] = {category: [] for category in _HOME_CATEGORY_KEYWORDS.keys()}
    buckets["other"] = []
    for item in deduped:
        category = _detect_home_category(item)
        buckets.setdefault(category, buckets["other"]).append(item)

    target_set_count = max(
        MIN_HOME_RECOMMENDATION_SETS,
        min(MAX_HOME_RECOMMENDATION_SETS, max(1, len(deduped) // HOME_RECOMMENDATION_CORE_SIZE)),
    )

    category_cursors = {category: 0 for category in buckets.keys()}
    results: list[HomeRecommendationSet] = []

    for set_no in range(1, target_set_count + 1):
        set_items: list[StyleItem] = []
        set_keys: set[str] = set()

        def _take(category: str) -> StyleItem | None:
            candidate, next_cursor = _pick_candidate(
                buckets.get(category, []),
                category_cursors.get(category, 0),
                set_keys,
            )
            category_cursors[category] = next_cursor
            if candidate is None:
                return None
            key = _normalize_home_item_key(candidate)
            set_keys.add(key)
            return candidate

        outer_item = _take("outer")
        top_item = _take("top")
        bottom_item = _take("bottom")
        shoes_item = _take("shoes")

        if not top_item or not bottom_item or not shoes_item:
            continue

        if outer_item is not None:
            set_items.append(outer_item)
        set_items.extend([top_item, bottom_item, shoes_item])

        for category in _HOME_OPTIONAL_CATEGORY_ORDER:
            optional_item = _take(category)
            if optional_item is not None:
                set_items.append(optional_item)

        set_signature = _build_home_set_signature(set_items)
        if set_signature in used_set_signatures:
            continue
        used_set_signatures.add(set_signature)
        results.append(_to_home_set(set_no, set_items))

    return results


def _search_home_category_items(
    query: str,
    category: str,
    gender: str | None,
    display: int,
    strict_category_match: bool = False,
) -> list[StyleItem]:
    suffix = _HOME_CATEGORY_QUERY_SUFFIX.get(category, "")
    search_query = f"{query} {suffix}".strip()
    candidates = search_shopping_products(search_query, display=display, gender=gender)
    candidates = filter_items_by_gender(candidates, gender)
    strict = [item for item in candidates if _detect_home_category(item) == category]
    if strict:
        return strict
    if strict_category_match:
        return []
    return candidates


def _build_home_fallback_sets(
    query: str, gender: str | None, used_set_signatures: set[tuple[str, ...]] | None = None
) -> List[HomeRecommendationSet]:
    fallback_count = max(1, MIN_HOME_RECOMMENDATION_SETS)
    category_pool_size = max(6, fallback_count * 2)
    used_set_signatures = used_set_signatures or set()

    outer_pool = [
        item for item in _search_home_category_items(query, "outer", gender, category_pool_size, strict_category_match=True)
        if _is_home_candidate_compatible(item, gender)
    ]
    top_pool = [
        item for item in _search_home_category_items(query, "top", gender, category_pool_size, strict_category_match=True)
        if _is_home_candidate_compatible(item, gender)
    ]
    bottom_pool = [
        item for item in _search_home_category_items(query, "bottom", gender, category_pool_size, strict_category_match=True)
        if _is_home_candidate_compatible(item, gender)
    ]
    shoes_pool = [
        item for item in _search_home_category_items(query, "shoes", gender, category_pool_size, strict_category_match=True)
        if _is_home_candidate_compatible(item, gender)
    ]
    accessory_pool = [
        item for item in _search_home_category_items(query, "accessory", gender, category_pool_size)
        if _is_home_candidate_compatible(item, gender)
    ]

    outer_cursor = 0
    top_cursor = 0
    bottom_cursor = 0
    shoes_cursor = 0
    accessory_cursor = 0

    results: list[HomeRecommendationSet] = []
    for set_no in range(1, fallback_count + 1):
        outer_item = outer_pool[outer_cursor % len(outer_pool)] if outer_pool else None
        top_item = top_pool[top_cursor % len(top_pool)] if top_pool else None
        bottom_item = bottom_pool[bottom_cursor % len(bottom_pool)] if bottom_pool else None
        shoes_item = shoes_pool[shoes_cursor % len(shoes_pool)] if shoes_pool else None
        accessory_item = accessory_pool[accessory_cursor % len(accessory_pool)] if accessory_pool else None

        if outer_item:
            outer_cursor += 1
        if top_item:
            top_cursor += 1
        if bottom_item:
            bottom_cursor += 1
        if shoes_item:
            shoes_cursor += 1
        if accessory_item:
            accessory_cursor += 1

        items: list[StyleItem | HomeStyleSetItem] = []
        if outer_item:
            items.append(outer_item)
        items.extend(
            [
                top_item if top_item else _placeholder_home_item("top"),
                bottom_item if bottom_item else _placeholder_home_item("bottom"),
                shoes_item if shoes_item else _placeholder_home_item("shoes"),
            ]
        )
        if accessory_item:
            items.append(accessory_item)

        summary = " · ".join(
            [
                _normalize_text(item.title) if isinstance(item, StyleItem) else _normalize_text(item.title)
                for item in items
                if _normalize_text(item.title)
            ]
        ).strip(" · ")

        built_items = [
            _build_home_set_item(item, index + 1) if isinstance(item, StyleItem) else item
            for index, item in enumerate(items[:HOME_RECOMMENDATION_MAX_SIZE])
        ]

        filtered_items: list[HomeStyleSetItem] = []
        seen_keys: set[str] = set()
        for candidate in built_items:
            key = _normalize_home_set_output_key(candidate)
            if not key or key in seen_keys:
                continue
            seen_keys.add(key)
            filtered_items.append(candidate)

        if len(filtered_items) < HOME_RECOMMENDATION_CORE_SIZE:
            continue

        set_signature = _build_home_set_signature(filtered_items)
        if set_signature in used_set_signatures:
            continue
        used_set_signatures.add(set_signature)

        results.append(
            HomeRecommendationSet(
                id=f"home-set-{set_no}",
                title=f"코디 세트 {set_no}",
                summary=summary or "상하의/신발 코디",
                tag="AI 추천",
                items=filtered_items,
            )
        )

    return results


def _sanitize_home_sets_for_gender(
    sets: list[HomeRecommendationSet],
    gender: str | None,
) -> list[HomeRecommendationSet]:
    if not gender:
        return sets

    filtered_sets: list[HomeRecommendationSet] = []
    for home_set in sets:
        valid_items = [item for item in home_set.items if _is_home_candidate_compatible(item, gender)]
        if len(valid_items) < HOME_RECOMMENDATION_CORE_SIZE:
            continue
        summary = " · ".join(
            item.title for item in valid_items[:HOME_RECOMMENDATION_MAX_SIZE] if item.title
        ).strip(" · ")
        if not summary:
            summary = home_set.summary or "코디 세트"

        filtered_sets.append(
            HomeRecommendationSet(
                id=home_set.id,
                title=home_set.title,
                summary=summary,
                tag=home_set.tag,
                items=valid_items[:HOME_RECOMMENDATION_MAX_SIZE],
            )
        )

    return filtered_sets


def _sanitize_sources(sources: List[str] | None) -> List[str]:
    if not sources:
        return []
    ignored = {"참고자료", "참고 자료", "자료 출처", "source", "...", "참고 1", "참고 2", "참고 3", "참고 4", "참고 5"}
    normalized = []
    for source in sources:
        text = source.strip() if source else ""
        if not text:
            continue
        lowered = text.lower()
        if lowered in ignored:
            continue
        compact = text.replace(" ", "")
        if len(compact) < 8:
            continue
        if compact in {"참고자료", "자료없음", "참고없음", "자료없음입니다", "참고자료없음"}:
            continue
        normalized.append(text)
    return normalized


def _score_match(text: str, keywords: list[str], weight: float = 1.0) -> float:
    if not text or not keywords:
        return 0.0

    lower = text.lower()
    return sum(weight for keyword in keywords if _normalize_lower(keyword) in lower)


def _score_document(document: dict, context: dict[str, list[str] | str]) -> float:
    score = float(document.get("similarity") or 0.0)
    content = (document.get("content") or "").lower()
    score += _score_match(content, context.get("season_keywords", []), weight=0.06)
    score += _score_match(content, context.get("occasion_keywords", []), weight=0.07)

    if _normalize_lower(document.get("personal_color")) == context.get("season"):
        score += 0.25
    if _normalize_lower(document.get("occasion")) and _normalize_lower(document.get("occasion")) in _normalize_lower(
        ",".join(context.get("occasion_keywords", []))
    ):
        score += 0.2
    return score


def _rank_documents(documents: List[dict], context: dict[str, list[str] | str]) -> List[dict]:
    return sorted(documents, key=lambda item: _score_document(item, context), reverse=True)


def _score_item_color(item: StyleItem, context: dict[str, list[str] | str]) -> float:
    haystack = " ".join([
        item.title or "",
        item.description or "",
        item.price or "",
        item.source or "",
    ]).lower()
    positive = list(context.get("palette_positive", []))
    negative = list(context.get("palette_negative", []))
    score = _score_match(haystack, positive, weight=1.0)
    score -= _score_match(haystack, negative, weight=1.0)
    score += _score_match(haystack, context.get("season_keywords", []), weight=0.5)
    score += _score_match(haystack, context.get("occasion_keywords", []), weight=0.3)
    if _normalize_lower(context.get("gender", "")) == "male":
        score += 0.1
    return score


def _rank_recommendation_items(items: List[StyleItem], context: dict[str, list[str] | str]) -> List[StyleItem]:
    if not items:
        return []
    ranked = sorted(((-_score_item_color(item, context), idx, item) for idx, item in enumerate(items)))
    return [item for _, _, item in ranked]


def _is_low_quality_item_reason(reason: str | None, item: StyleItem) -> bool:
    normalized = _normalize_text(reason)
    if not normalized:
        return True

    compact = normalized.replace(" ", "")
    if len(compact) < 14:
        return True
    if "추천아이템" in compact or "아이템입니다" in compact:
        return True

    title = _normalize_lower(item.title)
    if title and title not in _normalize_lower(normalized):
        return True
    return False


def _item_fit_hint(item: StyleItem) -> str:
    text = _normalize_lower(" ".join(filter(None, [item.title, item.description, " ".join(item.tags or [])])))
    if "와이드" in text or "wide" in text:
        return "와이드 실루엣으로 활동성과 체형 커버"
    if "슬림" in text or "slim" in text:
        return "슬림한 라인으로 깔끔한 인상"
    if "오버핏" in text or "oversized" in text:
        return "여유 핏으로 편안함과 트렌디함"
    if "테이퍼드" in text or "tapered" in text:
        return "테이퍼드 핏으로 하체 비율 정돈"
    if "스니커즈" in text or "신발" in text or "로퍼" in text or "부츠" in text:
        return "발끝 밸런스로 코디 마무리 완성"
    return "높은 활용도와 무난한 매치력"


def _is_template_like_reason(reason: str | None) -> bool:
    normalized = _normalize_text(reason)
    if not normalized:
        return True

    repeated_patterns = (
        "활용하기 좋은",
        "코디 완성도를 높여줍니다",
        "실루엣과 활용도 측면",
    )
    return sum(1 for token in repeated_patterns if token in normalized) >= 2


def _detect_reason_category(item: StyleItem) -> str:
    title_brand_tags = " ".join(
        filter(
            None,
            [
                item.title or "",
                item.brand or "",
                " ".join(item.tags or []),
            ],
        )
    ).lower()
    for category, keywords in _HOME_CATEGORY_KEYWORDS.items():
        if any(keyword in title_brand_tags for keyword in keywords):
            return category
    return _detect_home_category(item)


def _has_personal_color_context(context: dict[str, list[str] | str]) -> bool:
    requested = _normalize_lower(str(context.get("requested_season") or ""))
    profile = _normalize_lower(str(context.get("profile_season") or ""))
    return bool(requested or profile)


def _sanitize_evidence_sentence(sentence: str) -> str:
    cleaned = _normalize_text(sentence)
    cleaned = re.sub(r"^
    cleaned = re.sub(r"^[-*]\s*", "", cleaned)
    cleaned = cleaned.replace("
    return cleaned


def _ends_with_batchim(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return False
    last_char = normalized[-1]
    if not ("가" <= last_char <= "힣"):
        return False
    code = ord(last_char) - ord("가")
    return (code % 28) != 0


def _with_particle(text: str, particle_type: str) -> str:
    normalized = _normalize_text(text)
    if not normalized:
        return ""

    has_batchim = _ends_with_batchim(normalized)
    if particle_type == "subject":
        particle = "은" if has_batchim else "는"
    elif particle_type == "object":
        particle = "을" if has_batchim else "를"
    else:
        particle = ""
    return f"{normalized}{particle}"


def _resolve_occasion_label(context: dict[str, list[str] | str]) -> str:
    occasion = _normalize_lower(str(context.get("occasion") or ""))
    if occasion == "date":
        return "데이트 상황에서"
    if occasion == "office":
        return "출근/오피스 상황에서"
    if occasion == "travel":
        return "여행/외출 상황에서"
    if occasion == "event":
        return "행사/모임 상황에서"
    return "일상 코디에서"


def _split_knowledge_sentences(content: str) -> List[str]:
    raw = str(content or "")
    if not raw.strip():
        return []

    normalized: List[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        stripped = _sanitize_evidence_sentence(stripped)
        if len(stripped) < 6:
            continue
        for part in re.split(r"(?<=[.!?])\s+| · | – | - ", stripped):
            sentence = _sanitize_evidence_sentence(part)
            if len(sentence) < 10:
                continue
            normalized.append(sentence)
    return normalized


def _build_reason_keywords(item: StyleItem, context: dict[str, list[str] | str]) -> List[str]:
    category = _detect_reason_category(item)
    keywords = list(_HOME_CATEGORY_KEYWORDS.get(category, []))
    keywords.extend([_normalize_text(item.brand), _normalize_text(item.title)])
    keywords.extend([_normalize_text(keyword) for keyword in context.get("season_keywords", [])[:4]])
    keywords.extend([_normalize_text(keyword) for keyword in context.get("occasion_keywords", [])[:3]])
    return [token.lower() for token in keywords if token]


def _extract_rag_evidence(
    item: StyleItem,
    context: dict[str, list[str] | str],
    documents: List[dict],
    used_evidence: set[str] | None = None,
) -> str:
    if not documents:
        return ""

    keywords = _build_reason_keywords(item, context)
    allow_personal_color = _has_personal_color_context(context)
    blocked_personal_color_tokens = (
        "퍼스널컬러",
        "spring warm",
        "summer cool",
        "autumn warm",
        "winter cool",
        "웜톤",
        "쿨톤",
    )

    candidates: list[tuple[float, str]] = []
    for rank, document in enumerate(documents[:4]):
        content = str(document.get("content") or "")
        for sentence in _split_knowledge_sentences(content):
            lowered = sentence.lower()
            if not allow_personal_color and any(token in lowered for token in blocked_personal_color_tokens):
                continue
            if "피해야 할 조합" in sentence:
                continue
            if used_evidence and sentence in used_evidence:
                continue

            hit_score = float(sum(1 for keyword in keywords if keyword in lowered))
            base_score = float(document.get("similarity") or 0.0)
            order_penalty = rank * 0.03
            if hit_score <= 0:
                hit_score = 0.15
            candidates.append((base_score + hit_score - order_penalty, sentence))

    if candidates:
        candidates.sort(key=lambda pair: pair[0], reverse=True)
        best = candidates[0][1]
        if used_evidence is not None:
            used_evidence.add(best)
        return best

    for document in documents[:2]:
        for sentence in _split_knowledge_sentences(str(document.get("content") or "")):
            lowered = sentence.lower()
            if not allow_personal_color and any(token in lowered for token in blocked_personal_color_tokens):
                continue
            if used_evidence and sentence in used_evidence:
                continue
            if used_evidence is not None:
                used_evidence.add(sentence)
            return sentence
    return ""


def _build_rag_item_reason(
    item: StyleItem,
    context: dict[str, list[str] | str],
    documents: List[dict],
    evidence: str = "",
    item_index: int = 0,
) -> str:
    brand = _normalize_text(item.brand)
    title = _normalize_text(item.title) or "추천 아이템"
    display_name = f"{brand} {title}".strip()
    subject_name = _with_particle(display_name, "subject") or display_name
    object_name = _with_particle(display_name, "object") or display_name
    category = _detect_reason_category(item)
    category_label = _ITEM_REASON_CATEGORY_LABEL.get(category, "아이템")
    fit_hint = _item_fit_hint(item)
    occasion_label = _resolve_occasion_label(context)

    category_use_hint = {
        "top": "얼굴 주변 톤과 무드 정리에 유리합니다.",
        "bottom": "전체 실루엣 비율을 안정적으로 잡아줍니다.",
        "shoes": "코디의 마무리 균형을 잡아줍니다.",
        "outer": "레이어드 구성의 중심축 역할을 합니다.",
        "accessory": "단조로운 착장에 포인트를 더해줍니다.",
    }.get(category, "전체 코디 조합을 정돈해줍니다.")

    opening_templates = [
        f"{occasion_label} 코디에서 {subject_name} {category_label} 밸런스를 안정적으로 만들어줍니다.",
        f"{subject_name} {occasion_label} 기준으로 {category_label} 축을 잡아주는 핵심 아이템입니다.",
        f"{occasion_label}에 맞춰 보면 {subject_name} {category_label} 레이어를 자연스럽게 정리해줍니다.",
        f"{object_name} {occasion_label} 룩에 넣으면 {category_label} 비중이 과하지 않게 맞춰집니다.",
    ]
    opening = opening_templates[item_index % len(opening_templates)]
    base_reason = f"{opening} 특히 {fit_hint} 장점이 있고, {category_use_hint}"
    if evidence:
        return f"{base_reason} 추천 포인트: {evidence}"
    return base_reason


def _apply_rag_item_reasons(
    items: List[StyleItem],
    context: dict[str, list[str] | str],
    documents: List[dict],
) -> List[StyleItem]:
    if not items:
        return []

    rewritten: List[StyleItem] = []
    used_evidence: set[str] = set()
    for index, item in enumerate(items):
        description = _normalize_text(item.description)
        evidence = _extract_rag_evidence(item, context, documents, used_evidence)

        if _is_low_quality_item_reason(description, item) or _is_template_like_reason(description):
            description = _build_rag_item_reason(item, context, documents, evidence=evidence, item_index=index)
        elif evidence and "추천 포인트:" not in description and "근거:" not in description:
            description = f"{description} 추천 포인트: {evidence}"

        if not description:
            description = _build_rag_item_reason(item, context, documents, evidence=evidence, item_index=index)

        rewritten.append(
            _ensure_style_item_fields(
                StyleItem(
                    title=item.title,
                    description=description,
                    category=item.category,
                    gender=item.gender,
                    image_url=item.image_url,
                    purchase_url=item.purchase_url,
                    brand=item.brand,
                    price=item.price,
                    source=item.source,
                    tags=item.tags,
                ),
                fallback_query="",
            )
        )
    return rewritten



def search_similar_documents(
    db: Session,
    query: str,
    personal_color: str = None,
    occasion: str = None,
    limit: int = 5,
) -> List[dict]:
    """벡터 유사도 검색"""

    query_embedding = get_embedding(query)

    sql = """
    SELECT 
        id,
        content,
        personal_color,
        occasion,
        metadata,
        1 - (embedding <=> CAST(:embedding AS vector) ) as similarity
    FROM fashion_knowledge
    WHERE 1=1
    """

    params = {"embedding": str(query_embedding)}
    if personal_color:
        sql += " AND (personal_color = :personal_color OR personal_color IS NULL)"
        params["personal_color"] = personal_color

    normalized_occasion = _normalize_lower(occasion)
    if normalized_occasion:
        sql += " AND (occasion IS NULL OR occasion ILIKE :occasion_like OR occasion = :occasion)"
        params["occasion"] = normalized_occasion
        params["occasion_like"] = f"%{normalized_occasion}%"

    sql += """
    ORDER BY embedding <=> CAST(:embedding AS vector)
    LIMIT :limit
    """
    params["limit"] = limit

    result = db.execute(text(sql), params)

    documents = []
    for row in result:
        documents.append(
            {
                "id": row.id,
                "content": row.content,
                "personal_color": row.personal_color,
                "occasion": row.occasion,
                "similarity": float(row.similarity) if row.similarity else 0,
            }
        )

    context = _build_style_context(
        StyleRecommendRequest(
            query=query,
            personal_color=personal_color,
            occasion=occasion,
            user_id=0,
        )
    )
    return _rank_documents(documents, context)


def _enforce_required_style_categories(
    items: List[StyleItem], query: str, gender: str | None
) -> List[StyleItem]:
    def _text_only_category(item: StyleItem) -> str:
        text = _normalize_text(
            " ".join(
                filter(
                    None,
                    [
                        item.title,
                        item.description,
                        item.brand,
                        " ".join(item.tags or []),
                    ],
                )
            )
        ).lower()
        if not text:
            return "other"
        for category, keywords in _HOME_CATEGORY_KEYWORDS.items():
            if any(keyword in text for keyword in keywords):
                return category
        return "other"

    def _slot_category(item: StyleItem) -> str:
        from_field = _normalize_home_category(item.category)
        from_text = _text_only_category(item)

        if from_field != "other":
            return from_field
        if from_text != "other":
            return from_text
        return _detect_home_category(item)

    def _matches_category(item: StyleItem, category: str) -> bool:
        return _slot_category(item) == category

    grouped = {"top": [], "bottom": [], "shoes": [], "outer": [], "accessory": [], "other": []}
    for item in items:
        cat = _slot_category(item)
        if cat in grouped:
            grouped[cat].append(item)
        else:
            grouped["other"].append(item)

    required = ["top", "bottom", "shoes"]

    def _fetch_required_item(category: str) -> StyleItem | None:
        strict_candidates = _search_home_category_items(
            query, category, gender, display=6, strict_category_match=True
        )
        for candidate in strict_candidates:
            if _matches_category(candidate, category):
                return candidate

        suffix = _HOME_CATEGORY_QUERY_SUFFIX.get(category, category)

        suffix_candidates = _search_home_category_items(
            f"{query} {suffix}", category, gender, display=6
        )
        for candidate in suffix_candidates:
            if _matches_category(candidate, category):
                return candidate

        direct_candidates = search_shopping_products_with_gender(
            f"{suffix} {query}", gender, display=8
        )
        for candidate in direct_candidates:
            if _matches_category(candidate, category):
                return candidate

        last_candidates = search_shopping_products_with_gender(suffix, gender, display=8)
        for candidate in last_candidates:
            if _matches_category(candidate, category):
                return candidate

        direct_category_candidates = search_shopping_products_by_category(category, gender, display=8)
        if not direct_category_candidates:
            direct_category_candidates = search_shopping_products_by_category(category, None, display=8)

        for candidate in direct_category_candidates:
            if _matches_category(candidate, category):
                return candidate

        return None

    for req in required:
        if not grouped[req]:
            fetched = _fetch_required_item(req)
            if fetched is not None:
                grouped[req].append(fetched)
    used_keys = set()

    def _item_key(item: StyleItem) -> str:
        return f"{_normalize_text(item.title).lower()}|{_normalize_text(item.purchase_url).lower()}"

    def _pick_one(category: str) -> StyleItem | None:
        for candidate in grouped.get(category, []):
            key = _item_key(candidate)
            if key in used_keys:
                continue
            used_keys.add(key)
            return candidate
        return None

    required_selected: dict[str, StyleItem] = {}
    for req in required:
        picked = _pick_one(req)
        if picked is not None:
            required_selected[req] = picked
            continue

        fetched = _fetch_required_item(req)
        if fetched is not None:
            key = _item_key(fetched)
            if key not in used_keys and _slot_category(fetched) == req:
                used_keys.add(key)
                required_selected[req] = fetched
                continue

        for candidate in search_shopping_products_by_category(req, gender, display=20):
            key = _item_key(candidate)
            if key in used_keys:
                continue
            if _slot_category(candidate) != req:
                continue
            used_keys.add(key)
            required_selected[req] = candidate
            break

    slots: list[StyleItem] = []
    optional_outer = _pick_one("outer")
    if optional_outer is not None:
        slots.append(optional_outer)

    for req in ("top", "bottom", "shoes"):
        selected = required_selected.get(req)
        if selected is not None:
            slots.append(selected)

    optional_accessory = _pick_one("accessory")
    if optional_accessory is not None:
        slots.append(optional_accessory)

    present_required = {_slot_category(item) for item in slots}
    for req in required:
        if req in present_required:
            continue
        for candidate in search_shopping_products_by_category(req, gender, display=20):
            key = _item_key(candidate)
            if key in used_keys:
                continue
            if _slot_category(candidate) != req:
                continue
            used_keys.add(key)
            if req == "top":
                insert_at = 1 if slots and _slot_category(slots[0]) == "outer" else 0
                slots.insert(insert_at, candidate)
            elif req == "bottom":
                insert_at = 2 if len(slots) > 1 and _slot_category(slots[0]) == "outer" else 1
                slots.insert(min(insert_at, len(slots)), candidate)
            else:
                insert_at = 3 if len(slots) > 2 and _slot_category(slots[0]) == "outer" else 2
                slots.insert(min(insert_at, len(slots)), candidate)
            present_required.add(req)
            break

    return slots


def generate_style_recommendation(
    db: Session,
    request: StyleRecommendRequest,
) -> StyleRecommendResponse:
    """RAG 기반 스타일 추천"""
    normalized_gender = _normalize_request_gender(request.gender)
    if normalized_gender != request.gender:
        request = request.model_copy(update={"gender": normalized_gender})

    context = _build_style_context(request)

    documents = search_similar_documents(
        db=db,
        query=request.query,
        personal_color=str(context["season"]),
        occasion=request.occasion,
        limit=8,
    )

    context_text = "\n\n".join([f"[참고 {i+1}] {doc['content']}" for i, doc in enumerate(documents)])

    system_prompt = """당신은 한국어로 답변하는 패션 스타일리스트입니다.

다음 JSON 형식으로만 응답하세요.

응답 스키마:
{
  "recommendation": "텍스트 추천 설명",
  "items": [
    {
      "title": "상품명",
      "description": "추천 이유를 한 줄로 설명",
      "image_url": "https://...",
      "purchase_url": "https://...",
      "brand": "브랜드",
      "price": "가격",
      "source": "자료 출처",
      "tags": ["스타일", "색상"]
    }
  ],
  "sources": ["지식베이스 참조1", "지식베이스 참조2"]
}

규칙:
1) 각 추천 상품은 title, description, purchase_url를 최대한 채워 주세요.
2) 1~5개 정도만 정확하게 제시해 주세요.
2-1) 성별이 male이면 여성 전용 의류(스커트, 원피스, 블라우스, 하이힐 등)는 제외하세요.
2-2) 사용자의 시즌/상황/색 톤에 맞는 코디를 우선 제시하세요.
3) 텍스트는 markdown, 설명, 불필요한 문장 없이 순수 JSON으로만 작성하고 코드블록을 사용하지 마세요.
4) 상품이 없으면 items는 빈 배열 []로 반환하세요.
"""

    user_prompt = f"""
사용자 질문: {request.query}

"""

    if request.personal_color:
        user_prompt += f"사용자 퍼스널 컬러: {request.personal_color}\n\n"
    if request.gender:
        user_prompt += f"사용자 성별: {request.gender}\n\n"
    if request.age_group:
        user_prompt += f"사용자 연령대: {request.age_group}\n\n"
    if request.body_type:
        user_prompt += f"사용자 체형: {request.body_type}\n\n"
    if request.style_mood_preference:
        user_prompt += f"사용자 분위기 선호: {request.style_mood_preference}\n\n"
    if request.occasion:
        user_prompt += f"상황/TPO: {request.occasion}\n\n"

    palette_hint = ", ".join(context["palette_positive"][:6]) if context["palette_positive"] else ""
    avoid_hint = ", ".join(context["palette_negative"][:6]) if context["palette_negative"] else ""
    season_hint = ", ".join(context["season_keywords"][:6]) if context["season_keywords"] else ""
    if palette_hint:
        user_prompt += f"색상 조합 가이드(선호): {palette_hint}\n"
    if avoid_hint:
        user_prompt += f"색상 조합 가이드(회피): {avoid_hint}\n"
    if season_hint:
        user_prompt += f"계절/톤 키워드: {season_hint}\n"
    if context.get("requested_season"):
        user_prompt += "요청된 계절 조건을 최우선으로 반영해 코디를 제시하세요.\n"
    elif context.get("profile_season"):
        user_prompt += "요청된 계절 조건이 없으면 사용자 프로필 기준 계절/톤을 반영하세요.\n"

    user_prompt += """
추천할 코디는 1~5개 아이템으로 제시하고, 상의/하의/신발이 포함된 코디 구성으로 가능하면 우선 제시해 주세요.
"""

    if context_text:
        user_prompt += f"\n참고 자료:\n{context_text}\n\n"

    user_prompt += "위 정보를 참고해 JSON 형식으로 스타일 추천을 반환해 주세요."

    response = chat_completion(
        [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        json_mode=True,
    )

    parsed = parse_json_to_model(response, StyleRecommendResponse)
    if parsed:
        sources = _sanitize_sources(parsed.sources) or _build_sources(documents)
        parsed_items = list(parsed.items)

        enriched_items = enrich_style_items(parsed_items, fallback_query=request.query, gender=request.gender)
        enriched_items = filter_items_by_gender(enriched_items, request.gender)
        enriched_items = _rank_recommendation_items(enriched_items, context)
        if not enriched_items:
            enriched_items = build_items_from_text(response, max_items=STYLE_RECOMMENDATION_COUNT, gender=request.gender)
            enriched_items = filter_items_by_gender(enriched_items, request.gender)
            enriched_items = _rank_recommendation_items(enriched_items, context)
        if not enriched_items:
            gender_prefixed_query = (
                f"남성 {request.query}" if (request.gender or "").strip().lower() == "male" else request.query
            )
            enriched_items = search_shopping_products_with_gender(gender_prefixed_query, request.gender, display=STYLE_RECOMMENDATION_COUNT)
            enriched_items = filter_items_by_gender(enriched_items, request.gender)
            enriched_items = _rank_recommendation_items(enriched_items, context)

        enriched_items = _enforce_required_style_categories(enriched_items, request.query, request.gender)
        enriched_items = _apply_rag_item_reasons(enriched_items, context, documents)
        enriched_items = [_normalize_style_item_output(item, request.query) for item in enriched_items]
        enriched_items = _normalize_recommendation_items(enriched_items, max_items=5)
        return StyleRecommendResponse(recommendation=parsed.recommendation or "", items=enriched_items, sources=sources)

    fallback_items = build_items_from_text(response, max_items=STYLE_RECOMMENDATION_COUNT, gender=request.gender)
    fallback_items = filter_items_by_gender(fallback_items, request.gender)
    if not fallback_items:
        gender_prefixed_query = (
            f"남성 {request.query}" if (request.gender or "").strip().lower() == "male" else request.query
        )
        fallback_items = search_shopping_products_with_gender(gender_prefixed_query, request.gender, display=STYLE_RECOMMENDATION_COUNT)
        fallback_items = filter_items_by_gender(fallback_items, request.gender)
    fallback_items = _rank_recommendation_items(fallback_items, context)
    fallback_items = _enforce_required_style_categories(fallback_items, request.query, request.gender)
    fallback_items = _apply_rag_item_reasons(fallback_items, context, documents)
    fallback_items = [_normalize_style_item_output(item, request.query) for item in fallback_items]
    fallback_items = _normalize_recommendation_items(fallback_items, max_items=5)
    return StyleRecommendResponse(recommendation=response, items=fallback_items, sources=_build_sources(documents))

def generate_home_style_recommendation(
    db: Session,
    request: HomeStyleRecommendRequest,
) -> HomeStyleRecommendResponse:
    """홈 화면용 코디 세트 추천"""
    normalized_gender = _normalize_request_gender(request.gender)
    if normalized_gender != request.gender:
        request = request.model_copy(update={"gender": normalized_gender})

    query = _build_home_query(request)
    style_request = StyleRecommendRequest(
        query=query,
        personal_color=request.personal_color,
        gender=request.gender,
        age_group=request.age_group,
        body_type=request.body_type,
        style_mood_preference=request.style_mood_preference,
        occasion=request.occasion,
        user_id=request.user_id,
    )
    style_result = generate_style_recommendation(db, style_request)
    base_items = list(style_result.items)

    min_required_items = MIN_HOME_RECOMMENDATION_SETS * HOME_RECOMMENDATION_CORE_SIZE
    merged = list(base_items)

    for category in _HOME_REQUIRED_CATEGORIES:
        category_items = _search_home_category_items(
            query=query,
            category=category,
            gender=request.gender,
            display=max(6, MIN_HOME_RECOMMENDATION_SETS * 2),
            strict_category_match=True,
        )
        merged.extend(category_items)

    optional_items = _search_home_category_items(
        query=query,
        category="outer",
        gender=request.gender,
        display=max(4, MIN_HOME_RECOMMENDATION_SETS),
    )
    optional_items.extend(
        _search_home_category_items(
            query=query,
            category="accessory",
            gender=request.gender,
            display=max(4, MIN_HOME_RECOMMENDATION_SETS),
        )
    )
    merged.extend(optional_items)

    if len(merged) < min_required_items:
        extra = search_shopping_products_with_gender(
            f"{query} 상의 하의 신발 코디", display=min_required_items * 2, gender=request.gender
        )
        extra = filter_items_by_gender(extra, request.gender)
        merged.extend(extra)

    merged = enrich_style_items(merged, fallback_query=query, gender=request.gender)
    merged = filter_items_by_gender(merged, request.gender)
    merged = [item for item in merged if _is_home_candidate_compatible(item, request.gender)]
    merged = _rank_recommendation_items(merged, _build_style_context(style_request))
    used_set_signatures: set[tuple[str, ...]] = set()
    sets = _build_home_recommendation_sets(merged, request.gender, used_set_signatures)

    if len(sets) < MIN_HOME_RECOMMENDATION_SETS:
        fallback_sets = _build_home_fallback_sets(query, request.gender, used_set_signatures)
        for fallback_set in fallback_sets:
            fallback_items = fallback_set.items[:HOME_RECOMMENDATION_MAX_SIZE]
            sets.append(
                HomeRecommendationSet(
                    id=fallback_set.id,
                    title=fallback_set.title,
                    summary=fallback_set.summary,
                    tag=fallback_set.tag,
                    items=fallback_items,
                )
            )
            if len(sets) >= MIN_HOME_RECOMMENDATION_SETS:
                break

    if request.gender:
        sets = _sanitize_home_sets_for_gender(sets, request.gender)
        sets = sets[:MAX_HOME_RECOMMENDATION_SETS]

    return HomeStyleRecommendResponse(
        recommendation=style_result.recommendation or "",
        sets=sets[:MAX_HOME_RECOMMENDATION_SETS],
        sources=_sanitize_sources(style_result.sources) or style_result.sources,
    )
