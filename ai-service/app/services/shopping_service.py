
import html
import logging
import re
import time
from difflib import SequenceMatcher
from typing import Iterable
from urllib.parse import parse_qs, quote, urlencode, urlparse, unquote

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.database import engine
from app.models.style import StyleItem

logger = logging.getLogger(__name__)

_PRODUCT_HINT_RE = re.compile(
    r"(코트|니트|스웨터|팬츠|슬랙스|바지|부츠|슈즈|신발|자켓|재킷|원피스|스커트|셔츠|가디건|블라우스|"
    r"맨투맨|후드|coat|sweater|pants|slacks|boots|shoes|jacket|dress|skirt|shirt|cardigan|blouse|hoodie)",
    re.IGNORECASE,
)


_CATEGORY_KEYWORDS = {
    "top": ["상의", "티셔츠", "셔츠", "니트", "스웨터", "맨투맨", "후드", "가디건", "탑"],
    "bottom": ["하의", "팬츠", "슬랙스", "바지", "청바지", "데님", "치노", "스키니"],
    "shoes": ["신발", "운동화", "부츠", "스니커즈", "로퍼", "샌들", "구두", "슈즈"],
    "outer": ["아우터", "자켓", "재킷", "코트", "점퍼", "블레이저", "패딩"],
    "accessory": ["가방", "백", "모자", "벨트", "목걸이", "팔찌", "시계", "반지", "스카프"],
}

_CATEGORY_REASON_LABEL = {
    "top": "상의",
    "bottom": "하의",
    "shoes": "신발",
    "outer": "아우터",
    "accessory": "액세서리",
    "other": "아이템",
}

_CATEGORY_THEME = {
    "top": ("
    "bottom": ("
    "shoes": ("
    "outer": ("
    "accessory": ("
    "other": ("
}

_SEASON_TOKENS = {
    "봄": ["봄", "spring", "라이트"],
    "여름": ["여름", "summer", "시원", "린넨"],
    "가을": ["가을", "autumn", "브라운"],
    "겨울": ["겨울", "winter", "코트", "니트"],
}

_MOOD_TOKENS = ["캐주얼", "미니멀", "페미닌", "시크", "스트릿", "클래식", "데이트", "오피스"]

_CATEGORY_LABEL_MAP = {
    "상의": "top",
    "하의": "bottom",
    "아우터": "outer",
    "신발": "shoes",
    "악세서리": "accessory",
}

_MALE_GENDER_KEYWORDS = {
    "남성",
    "남자",
    "남성용",
    "남자용",
    "남성복",
    "남성복형",
    "남성형",
    "남친",
    "아저씨",
    "man",
    "men",
    "mens",
    "male",
    "gents",
    "menswear",
}

_FEMALE_GENDER_KEYWORDS = {
    "여성",
    "여자",
    "여성용",
    "여성복",
    "여자용",
    "우먼",
    "womens",
    "women",
    "woman",
    "girls",
    "girl",
    "femail",
    "female",
    "여친",
}

_MALE_GENDER_TEXT_SHORTCUTS = {"m", "남", "남자친구", "남성복형", "male", "man", "men", "mens", "gents", "menswear"}
_FEMALE_GENDER_TEXT_SHORTCUTS = {"f", "여", "여자친구", "여성용", "female", "woman", "women", "womens", "girl", "girls"}


def _contains_gender_keyword(text: str, keywords: set[str], *, ignore_single_char: bool = False) -> bool:
    normalized = _normalize_text(text).lower()
    if not normalized:
        return False
    candidate_tokens = set(re.findall(r"[a-z]+|[가-힣]+", normalized))
    for token in candidate_tokens:
        if ignore_single_char and len(token) == 1:
            continue
        if token in keywords:
            return True
    for keyword in keywords:
        if ignore_single_char and len(keyword) == 1:
            continue
        if keyword in normalized:
            return True
    return False

_DB_READY = False
_DB_DISABLED = False
_CATALOG_CACHE: list[dict[str, object]] = []
_CATALOG_CACHE_AT = 0.0
_CACHE_TTL_SECONDS = 120


def _normalize_product_id(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().lower()


def _sanitize_catalog_product_id(value: str | None) -> str:
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
    return normalized


def _extract_catalog_product_id_from_url(value: str | None) -> str:
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
                sanitized = _sanitize_catalog_product_id(candidate)
                if sanitized:
                    return sanitized

        nested_purchase_urls = query_values.get("purchase_url") or []
        for nested_purchase_url in nested_purchase_urls:
            if not nested_purchase_url:
                continue
            nested_candidate = _extract_catalog_product_id_from_url(unquote(nested_purchase_url))
            if nested_candidate:
                return nested_candidate

        path = (parsed.path or "").strip()
        if path.startswith("/catalog/products/"):
            path_candidate = path.removeprefix("/catalog/products/").strip()
            if path_candidate:
                return _sanitize_catalog_product_id(path_candidate)

    for key in ("product_id", "item_id", "id"):
        match = re.search(rf"[?&]{key}=([^&]+)", normalized, flags=re.IGNORECASE)
        if match:
            sanitized = _sanitize_catalog_product_id(match.group(1))
            if sanitized:
                return sanitized

    if "/catalog/products/" in normalized:
        match = re.search(r"/catalog/products/([^/?
        if match:
            return _sanitize_catalog_product_id(match.group(1))

    return ""


def get_catalog_item_by_product_id(product_id: str | None) -> dict[str, object] | None:
    if _DB_DISABLED or not product_id:
        return None

    normalized_product_id = _sanitize_catalog_product_id(_normalize_product_id(product_id))
    if not normalized_product_id:
        return None

    _ensure_products_ready()
    if _DB_DISABLED:
        return None

    select_sql = text(
        """
        SELECT
            id,
            gender,
            category,
            name,
            brand,
            tags,
            season,
            mood,
            description,
            price,
            image_url,
            purchase_url
        FROM items
        WHERE id = :product_id
        LIMIT 1
        """
    )

    try:
        with engine.connect() as conn:
            row = conn.execute(select_sql, {"product_id": normalized_product_id}).mappings().first()
        if not row:
            return None

        result = {
            "id": str(row.get("id") or normalized_product_id),
            "gender": str(row.get("gender") or ""),
            "category": str(row.get("category") or ""),
            "name": str(row.get("name") or ""),
            "brand": str(row.get("brand") or ""),
            "tags": row.get("tags"),
            "season": str(row.get("season") or ""),
            "mood": str(row.get("mood") or ""),
            "description": str(row.get("description") or ""),
            "price": row.get("price"),
            "image_url": str(row.get("image_url") or ""),
            "purchase_url": str(row.get("purchase_url") or ""),
        }
        return result
    except SQLAlchemyError as exc:
        logger.warning("failed to load catalog item by id=%s: %s", normalized_product_id, exc)
        return None


def _parse_catalog_id_from_url(value: str | None) -> str:
    return _extract_catalog_product_id_from_url(value)


def _resolve_catalog_gender_for_item(item: StyleItem) -> str:
    catalog_product_id = _parse_catalog_id_from_url(item.purchase_url)
    if not catalog_product_id:
        return ""

    catalog_item = get_catalog_item_by_product_id(catalog_product_id)
    if not catalog_item:
        return ""

    return _coerce_gender_for_matching(str(catalog_item.get("gender") or ""))


def _normalize_token(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", "", re.sub(r"[^\w가-힣]+", "", html.unescape(value).lower()))


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return html.unescape(value).replace("*", "").strip()


def _format_price(value: int) -> str:
    return f"{value:,}원"


def _detect_category(text: str | None) -> str:
    haystack = (_normalize_text(text) or "").lower()
    for category, tokens in _CATEGORY_KEYWORDS.items():
        if any(token in haystack for token in tokens):
            return category
    return "other"


def _to_svg_image(category: str, name: str, brand: str, seed_index: int) -> str:
    bg, fg, label = _CATEGORY_THEME.get(category, _CATEGORY_THEME["other"])
    title = _normalize_text(name)[:24] or "추천 아이템"
    brand_text = _normalize_text(brand)[:20] or "AI Stylist"
    seed = f"{category}-{seed_index}"
    svg = f"""
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
  <defs>
    <linearGradient id="g-{seed}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="{bg}"/>
      <stop offset="100%" stop-color="
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(
  <rect x="64" y="88" width="512" height="624" rx="28" fill="
  <text x="320" y="210" text-anchor="middle" fill="{fg}" font-size="34" font-family="Arial, sans-serif" font-weight="700">{label}</text>
  <text x="320" y="270" text-anchor="middle" fill="{fg}" fill-opacity="0.85" font-size="24" font-family="Arial, sans-serif">{brand_text}</text>
  <text x="320" y="330" text-anchor="middle" fill="{fg}" fill-opacity="0.85" font-size="24" font-family="Arial, sans-serif">{title}</text>
  <text x="320" y="700" text-anchor="middle" fill="{fg}" fill-opacity="0.65" font-size="20" font-family="Arial, sans-serif">AI STYLIST SAMPLE PRODUCT</text>
</svg>
"""
    return f"data:image/svg+xml;utf8,{quote(svg.strip())}"


def _to_image_url(seed_index: int, category: str, name: str, brand: str) -> str:
    return _to_svg_image(category=category, name=name, brand=brand, seed_index=seed_index)


def _extract_seed_index(sku: str | None, fallback: int) -> int:
    if not sku:
        return max(fallback, 1)
    match = re.search(r"(\d+)$", sku)
    if not match:
        return max(fallback, 1)
    return max(int(match.group(1)), 1)


def _to_local_product_url(
    sku: str,
    name: str,
    brand: str,
    description: str,
    category: str,
    price_text: str,
    source: str,
    external_purchase_url: str | None = None,
    image_url: str | None = None,
    product_id: str | None = None,
) -> str:
    normalized_external_url = _normalize_text(external_purchase_url or "")
    normalized_image_url = _normalize_text(image_url or "")
    normalized_product_id = _normalize_text(product_id or "")
    params = urlencode(
        {
            "title": _normalize_text(name),
            "brand": _normalize_text(brand),
            "description": _normalize_text(description),
            "category": _normalize_text(category),
            "price": _normalize_text(price_text),
            "source": _normalize_text(source),
            "purchase_url": normalized_external_url,
            "image_url": normalized_image_url,
            "product_id": normalized_product_id,
            "detail_source": "items",
        }
    )
    return f"/catalog/products/{quote(sku)}?{params}"


def _normalize_product_url(
    value: str | None,
    *,
    sku: str,
    name: str,
    brand: str,
    description: str,
    category: str,
    price_text: str,
    source: str,
    image_url: str | None = None,
    product_id: str | None = None,
) -> str:
    raw = _normalize_text(value)
    normalized_external = _normalize_text(value)
    if raw.startswith("/catalog/products/"):
        return raw
    if source == "items":
        return _to_local_product_url(
            sku=sku,
            name=name,
            brand=brand,
            description=description,
            category=category,
            price_text=price_text,
            source=source,
            external_purchase_url=normalized_external,
            image_url=image_url,
            product_id=product_id,
        )
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    return _to_local_product_url(
        sku=sku,
        name=name,
        brand=brand,
        description=description,
        category=category,
        price_text=price_text,
        source=source,
        image_url=image_url,
        product_id=product_id,
    )


def _normalize_image_url(value: str | None, seed_index: int, category: str, name: str, brand: str) -> str:
    raw = _normalize_text(value)
    if not raw:
        return _to_image_url(seed_index, category, name, brand)

    lowered = raw.lower()
    if "placeholder" in lowered or "dummyimage" in lowered or "example.com" in lowered:
        return _to_image_url(seed_index, category, name, brand)

    if lowered.startswith("data:image/svg+xml"):
        return raw

    if lowered.startswith("http://") or lowered.startswith("https://"):
        return raw

    return _to_image_url(seed_index, category, name, brand)


def _normalize_gender(value: str | None) -> str:
    candidate = _normalize_text(value).lower()
    if not candidate:
        return "unisex"

    if _contains_gender_keyword(candidate, _MALE_GENDER_TEXT_SHORTCUTS, ignore_single_char=True):
        return "male"
    if _contains_gender_keyword(candidate, _MALE_GENDER_KEYWORDS, ignore_single_char=True):
        return "male"
    if _contains_gender_keyword(candidate, _FEMALE_GENDER_TEXT_SHORTCUTS, ignore_single_char=True):
        return "female"
    if _contains_gender_keyword(candidate, _FEMALE_GENDER_KEYWORDS, ignore_single_char=True):
        return "female"
    return "unisex"


def _normalize_gender_with_text(value: str | None, title: str | None = None, description: str | None = None, tags: list[str] | None = None) -> str:
    normalized_gender = _coerce_gender_for_matching(value)
    if normalized_gender == "unisex":
        text = _normalize_text(" ".join(filter(None, [title, description, " ".join(tags or [])]))).lower()
        if any(keyword in text for keyword in _FEMALE_GENDER_KEYWORDS):
            return "female"
        if any(keyword in text for keyword in _MALE_GENDER_KEYWORDS):
            return "male"
    return normalized_gender


def _coerce_gender_for_matching(value: str | None) -> str:
    candidate = _normalize_gender(value)
    if candidate in {"male", "female"}:
        return candidate
    return "unisex"


def _is_gender_compatible(item_gender: str | None, requested_gender: str | None) -> bool:
    item_value = _coerce_gender_for_matching(item_gender)
    normalized_request = (requested_gender or "").strip().lower()

    if normalized_request == "male":
        return item_value in {"male", "unisex"}
    if normalized_request == "female":
        return item_value in {"female", "unisex"}
    return True


def _normalize_category(value: str | None) -> str:
    raw = _normalize_text(value).lower()
    for category in ("top", "bottom", "outer", "shoes", "accessory"):
        if raw == category:
            return category
    if "top" in raw or "상의" in raw or "셔츠" in raw:
        return "top"
    if "bottom" in raw or "하의" in raw or "바지" in raw or "팬츠" in raw or "슬랙스" in raw:
        return "bottom"
    if "outer" in raw or "아우터" in raw or "자켓" in raw or "재킷" in raw or "코트" in raw:
        return "outer"
    if "shoe" in raw or "신발" in raw or "부츠" in raw or "운동화" in raw or "스니커" in raw:
        return "shoes"
    if "acc" in raw or "악세" in raw or "가방" in raw or "모자" in raw or "벨트" in raw or "시계" in raw:
        return "accessory"
    return "other"


def _to_reason_category_label(item: StyleItem) -> str:
    category = _detect_category(" ".join(filter(None, [item.title, _normalize_text(" ".join(item.tags or []))])))
    return _CATEGORY_REASON_LABEL.get(category, "아이템")


def _to_fit_hint(title: str) -> str:
    lowered = (title or "").lower()
    if "와이드" in lowered or "wide" in lowered:
        return "여유 있는 실루엣으로 체형 커버가 쉽고"
    if "슬림" in lowered or "slim" in lowered:
        return "슬림한 라인으로 깔끔한 인상을 만들기 좋고"
    if "오버핏" in lowered or "oversized" in lowered:
        return "오버핏 실루엣으로 편안하면서 트렌디한 무드를 주고"
    if "테이퍼드" in lowered or "tapered" in lowered:
        return "발목으로 갈수록 정리되는 핏이라 비율이 안정적으로 보이고"
    if "크루넥" in lowered or "crewneck" in lowered:
        return "목선이 단정하게 정리되어 다양한 아우터와 매치가 쉽고"
    if "로퍼" in lowered or "스니커즈" in lowered or "운동화" in lowered or "shoes" in lowered:
        return "착용 밸런스가 좋아 데일리 코디 완성도를 높여주고"
    return "실루엣과 활용도 측면에서 밸런스가 좋아"


def _to_occasion_hint(query: str) -> str:
    lowered = _normalize_text(query).lower()
    if any(token in lowered for token in ("데이트", "date", "여자친구", "남자친구", "미팅")):
        return "데이트 상황에서"
    if any(token in lowered for token in ("출근", "회사", "오피스", "면접", "회의", "office")):
        return "출근/오피스 상황에서"
    if any(token in lowered for token in ("여행", "출장", "trip", "travel", "휴가")):
        return "여행/외출 상황에서"
    if any(token in lowered for token in ("하객", "결혼식", "모임", "event", "파티")):
        return "모임/행사 상황에서"
    return "일상 코디에서"


def _is_low_quality_reason(value: str | None, title: str, brand: str) -> bool:
    normalized = _normalize_text(value)
    if not normalized:
        return True
    compact = _normalize_token(normalized)
    if len(compact) < 12:
        return True
    if "추천아이템" in compact or "가격확인" in compact:
        return True

    normalized_title = _normalize_token(title)
    normalized_brand = _normalize_token(brand)
    if normalized_title and normalized_title not in compact:
        return True
    if normalized_brand and normalized_brand not in compact:
        return True
    return False


def _compose_item_reason(item: StyleItem, query: str) -> str:
    title = _normalize_text(item.title) or "추천 아이템"
    brand = _normalize_text(item.brand) or "추천 브랜드"
    category_label = _to_reason_category_label(item)
    fit_hint = _to_fit_hint(title)
    occasion_hint = _to_occasion_hint(query)
    return (
        f"{brand} {title}은 {occasion_hint} 활용하기 좋은 {category_label}로, "
        f"{fit_hint} 코디 완성도를 높여줍니다."
    )


def _map_category(category: str | None) -> str:
    normalized = _normalize_text(category).strip()
    if not normalized:
        return "other"
    if normalized in _CATEGORY_LABEL_MAP:
        return _CATEGORY_LABEL_MAP[normalized]
    return _normalize_category(normalized)


def _to_price_label(price: int | str | None) -> str:
    if price is None:
        return "가격 정보 없음"
    if isinstance(price, int):
        return _format_price(price)
    text_value = _normalize_text(str(price))
    return text_value or "가격 정보 없음"


def _parse_tags(tags_value: object) -> list[str]:
    if isinstance(tags_value, list):
        return [str(tag).strip() for tag in tags_value if str(tag).strip()]
    if isinstance(tags_value, str):
        if not tags_value:
            return []
        parts = tags_value.strip().lstrip("[").rstrip("]")
        return [part.strip().strip("\"'") for part in parts.split(",") if part.strip().strip("\"'")]
    return []


def _resolve_gender_by_text(
    value: str | None,
    title: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
) -> str:
    normalized_value = _normalize_gender(value)
    if normalized_value in {"male", "female"}:
        return normalized_value

    text = _normalize_text(" ".join(filter(None, [title, description, " ".join(tags or [])]))).lower()
    if any(keyword in text for keyword in _FEMALE_GENDER_KEYWORDS):
        return "female"
    if any(keyword in text for keyword in _MALE_GENDER_KEYWORDS):
        return "male"
    return "unisex"


def _build_style_item(product: dict[str, object]) -> StyleItem:
    raw_gender = str(product.get("gender") or "")
    name = str(product.get("name") or "")
    title = str(product.get("title") or product.get("name") or "추천 아이템")
    description = _normalize_text(str(product.get("description") or ""))
    tags = [str(tag) for tag in (product.get("tags") or [])]
    normalized_gender = _resolve_gender_by_text(raw_gender, title=name, description=description, tags=tags)
    normalized_category = _normalize_category(str(product.get("category") or ""))
    if normalized_category != "other" and normalized_category not in tags:
        tags.append(normalized_category)

    return StyleItem(
        title=_normalize_text(title),
        description=description,
        category=normalized_category,
        gender=normalized_gender,
        image_url=str(product.get("image_url") or ""),
        purchase_url=str(product.get("purchase_url") or ""),
        brand=str(product.get("brand") or ""),
        price=str(product.get("price") or ""),
        source=str(product.get("source") or "샘플 DB"),
        tags=tags,
    )

def _ensure_products_ready() -> None:
    global _DB_READY, _DB_DISABLED

    if _DB_READY or _DB_DISABLED:
        return

    try:
        with engine.begin() as conn:
            conn.execute(
                text("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'items'")
            )
        _DB_READY = True
    except SQLAlchemyError as exc:
        _DB_DISABLED = True
        logger.warning("items table availability check failed, fallback to catalog unavailable: %s", exc)


def _load_catalog_from_db() -> list[dict[str, object]]:
    if _DB_DISABLED:
        return []

    _ensure_products_ready()
    if _DB_DISABLED:
        return []

    select_sql = text(
        """
        SELECT
            id,
            name,
            brand,
            category,
            gender,
            season,
            mood,
            description,
            price,
            image_url,
            purchase_url,
            tags
        FROM items
        ORDER BY id ASC
        """
    )

    try:
        with engine.connect() as conn:
            rows = conn.execute(select_sql).mappings().all()

        catalog: list[dict[str, object]] = []
        for idx, row in enumerate(rows, start=1):
            tags = _parse_tags(row.get("tags"))
            name = str(row.get("name") or "추천 아이템")
            brand = str(row.get("brand") or "")
            sku = str(row.get("id") or "")
            category = str(row.get("category") or "other")
            description = str(row.get("description") or "")
            category = _map_category(category)
            price_value = row.get("price")
            description = description or _compose_item_reason(
                StyleItem(
                    title=name,
                    brand=brand,
                    tags=tags,
                ),
                query="",
            )
            seed_index = _extract_seed_index(sku, idx)
            purchase_url = _normalize_product_url(
                str(row.get("purchase_url") or ""),
                sku=sku,
                name=name,
                brand=brand,
                description=description,
                category=category,
                price_text=_to_price_label(price_value),
                source="items",
                image_url=str(row.get("image_url") or ""),
                product_id=sku,
            )
            image_url = _normalize_image_url(str(row.get("image_url") or ""), seed_index, category, name, brand)

            catalog.append(
                {
                    "id": sku,
                    "sku": sku,
                    "name": name,
                    "title": f"{brand} {name}".strip(),
                    "description": description,
                    "brand": brand,
                    "category": category,
                    "gender": _resolve_gender_by_text(
                        str(row.get("gender") or ""),
                        title=name,
                        description=description,
                        tags=tags,
                    ),
                    "tags": tags,
                    "season": str(row.get("season") or ""),
                    "mood": str(row.get("mood") or ""),
                    "price": _to_price_label(price_value),
                    "source": "items",
                    "image_url": image_url,
                    "purchase_url": purchase_url,
                }
            )

        return catalog
    except SQLAlchemyError as exc:
        logger.warning("failed to load items from db, no catalog available: %s", exc)
        return []


def _get_catalog() -> list[dict[str, object]]:
    global _CATALOG_CACHE, _CATALOG_CACHE_AT

    now = time.monotonic()
    if _CATALOG_CACHE and (now - _CATALOG_CACHE_AT) < _CACHE_TTL_SECONDS:
        return _CATALOG_CACHE

    db_catalog = _load_catalog_from_db()
    if db_catalog:
        _CATALOG_CACHE = db_catalog
        _CATALOG_CACHE_AT = now
        return db_catalog

    _CATALOG_CACHE = []
    _CATALOG_CACHE_AT = now
    return _CATALOG_CACHE


def _match_score(candidate: StyleItem, query: str, requested_category: str | None) -> float:
    haystack = " ".join(
        filter(
            None,
            [
                candidate.title,
                candidate.description,
                candidate.brand,
                " ".join(candidate.tags or []),
                candidate.price,
            ],
        )
    ).lower()

    tokens = [token.strip() for token in re.split(r"[\s,./|]+", _normalize_text(query).lower()) if token.strip()]
    if not tokens:
        tokens = [_normalize_text(query).lower()]

    normalized_haystack = _normalize_token(haystack)
    score = 0.0

    for token in tokens:
        normalized = _normalize_token(token)
        if not normalized:
            continue
        if normalized in normalized_haystack:
            score += 1.2
        score += SequenceMatcher(None, normalized, normalized_haystack).ratio() * 0.35

    if requested_category:
        if candidate.tags and any(_normalize_token(tag) == requested_category for tag in candidate.tags):
            score += 1.8
        if requested_category == _detect_category(candidate.title):
            score += 1.2

    return score


def _dedupe(items: list[StyleItem]) -> list[StyleItem]:
    seen: set[str] = set()
    result: list[StyleItem] = []
    for item in items:
        key = f"{_normalize_text(item.title).lower()}|{_normalize_text(item.brand).lower()}|{(item.purchase_url or '').split('?')[0]}"
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def search_shopping_products(query: str, display: int = 5, gender: str | None = None) -> list[StyleItem]:
    requested = max(1, min(display, 30))
    catalog = _get_catalog()
    if not catalog:
        return []

    if not (query or "").strip():
        items = _dedupe([_build_style_item(product) for product in catalog[:requested]])
        return filter_items_by_gender(items, gender)

    requested_category = _detect_category(query)
    ranked: list[tuple[float, StyleItem]] = []
    for product in catalog:
        candidate = _build_style_item(product)
        score = _match_score(candidate, query, requested_category)
        if requested_category != "other" and requested_category == _detect_category(candidate.title):
            score += 1.0
        ranked.append((score, candidate))

    ranked.sort(key=lambda pair: pair[0], reverse=True)
    picked = [item for score, item in ranked if score > 0.0]
    if not picked:
        picked = [_build_style_item(product) for product in catalog[:requested]]

    items = _dedupe(picked)[:requested]
    return filter_items_by_gender(items, gender)


def _search_catalog_by_query(query: str, display: int, gender: str | None = None) -> list[StyleItem]:
    candidates = search_shopping_products(query, display=display)
    if not candidates:
        return []
    if not gender:
        return candidates

    filtered = filter_items_by_gender(candidates, gender)
    return filtered


def enrich_style_items(items: Iterable[StyleItem], fallback_query: str = "", gender: str | None = None) -> list[StyleItem]:
    enriched: list[StyleItem] = []
    for item in items:
        query = " ".join(part for part in [item.brand, item.title, fallback_query] if part).strip()
        best = search_shopping_products(query or fallback_query, display=1, gender=gender)
        if not best:
            if gender:
                continue
            if item.image_url and item.purchase_url:
                enriched.append(item)
            continue

        source = best[0]
        title = source.title or item.title
        brand = source.brand or item.brand or ""
        selected_description = _normalize_text(item.description) or _normalize_text(source.description)
        if _is_low_quality_reason(selected_description, title or "", brand):
            selected_description = _compose_item_reason(
                StyleItem(
                    title=title or "추천 아이템",
                    brand=brand,
                    tags=source.tags or item.tags,
                ),
                fallback_query,
            )

        resolved_gender = _resolve_catalog_gender_for_item(source) or _resolve_catalog_gender_for_item(item)
        if not resolved_gender:
            resolved_gender = _coerce_gender_for_matching(source.gender)

        enriched.append(
            StyleItem(
                title=title,
                description=selected_description,
                category=source.category or item.category,
                gender=resolved_gender,
                image_url=source.image_url or item.image_url,
                purchase_url=source.purchase_url or item.purchase_url,
                brand=brand,
                price=source.price or item.price,
                source=source.source or item.source,
                tags=source.tags or item.tags,
            )
        )

    return [item for item in _dedupe(enriched) if item.purchase_url]


def _extract_item_queries_from_text(text_value: str) -> list[str]:
    if not text_value:
        return []

    queries: list[str] = []
    seen: set[str] = set()

    for line in text_value.splitlines():
        match = re.search(r"(?:^|\s*[-*]\s*|\s*\d+\.\s*)(.+)", line)
        if not match:
            continue

        raw = _normalize_text(match.group(1))
        if not raw:
            continue

        bold_tokens = re.findall(r"\*\*(.*?)\*\*", raw)
        if bold_tokens:
            product = " ".join(token for token in bold_tokens if _PRODUCT_HINT_RE.search(token))
            if product:
                brand = next((token for token in bold_tokens if not _PRODUCT_HINT_RE.search(token)), None)
                query = f"{brand} {product}".strip()
            else:
                query = " ".join(bold_tokens[:2])
        else:
            query = raw

        if query and query not in seen:
            seen.add(query)
            queries.append(query)

        if len(queries) >= 5:
            break

    return queries


def build_items_from_text(text_value: str, max_items: int = 4, gender: str | None = None) -> list[StyleItem]:
    queries = _extract_item_queries_from_text(text_value)
    if not queries:
        return []

    results: list[StyleItem] = []
    for query in queries:
        items = search_shopping_products(query, display=1, gender=gender)
        if items:
            results.extend(items)
        if len(results) >= max_items:
            break

    return results[:max_items]


def filter_items_by_gender(items: Iterable[StyleItem], gender: str | None) -> list[StyleItem]:
    item_list = list(items)
    if (gender or "").strip().lower() not in {"male", "female"}:
        return item_list

    normalized_gender = (gender or "").strip().lower()

    return [item for item in item_list if _is_gender_compatible(item.gender, normalized_gender)]


def search_shopping_products_with_gender(query: str, gender: str | None, display: int = 5) -> list[StyleItem]:
    return _search_catalog_by_query(query, display, gender)


def search_shopping_products_by_category(category: str, gender: str | None, display: int = 5) -> list[StyleItem]:
    requested = max(1, min(display, 30))
    normalized_category = _normalize_category(category)
    if normalized_category == "other":
        return []

    catalog = _get_catalog()
    if not catalog:
        return []

    exact = [
        _build_style_item(product)
        for product in catalog
        if _normalize_category(str(product.get("category") or "")) == normalized_category
    ]
    exact = filter_items_by_gender(_dedupe(exact), gender)
    return exact[:requested]
