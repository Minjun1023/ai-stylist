from sqlalchemy.orm import Session

from app.services.openai_client import chat_completion
from app.services.rag_service import search_similar_documents
from app.services.response_parser import parse_json_to_model
from app.services.shopping_service import (
    build_items_from_text,
    enrich_style_items,
    filter_items_by_gender,
    search_shopping_products,
    search_shopping_products_with_gender,
)
from app.models.chat import ChatRequest, ChatResponse
from app.models.style import StyleItem
from app.models.chat import InferredProfile 

DEFAULT_RECOMMENDATION_COUNT = 4 # 기본 추천 개수
_MALE_GENDER_VALUES = {"male", "남성", "man", "남자", "m"} # 남성 성별 값

# 계절별 컨텍스트
_SEASONAL_CONTEXTS = {
    "spring_warm": { # 봄 웜톤
        "season_keywords": ["봄", "spring", "spring warm", "웜톤", "따뜻한", "밝은"],
        "palette_positive": ["베이지", "아이보리", "크림", "핑크", "코랄", "라이트"],
        "palette_negative": ["올블랙", "딥블루", "진한주황", "네온"],
    },
    "summer_cool": { # 여름 쿨톤
        "season_keywords": ["여름", "summer", "summer cool", "쿨톤", "소프트", "파스텔", "차분한"],
        "palette_positive": ["라벤더", "민트", "연핑크", "연회색", "화이트", "블루"],
        "palette_negative": ["고채도 주황", "올리브", "카키", "진한 갈색", "브라운계 강한톤"],
    },
    "autumn_warm": { # 가을 웜톤
        "season_keywords": ["가을", "autumn", "autumn warm", "웜톤", "브라운", "오렌지", "카멜"],
        "palette_positive": ["브라운", "카키", "카멜", "머스타드", "버건디", "차콜"],
        "palette_negative": ["차가운 블루", "네온", "연분홍", "강한 청록", "원색레드"],
    },
    "winter_cool": { # 겨울 쿨톤
        "season_keywords": ["겨울", "winter", "winter cool", "쿨톤", "고대비", "선명한"],
        "palette_positive": ["블랙", "화이트", "네이비", "차콜", "에메랄드", "레드"],
        "palette_negative": ["누리끼리", "올리브", "브라운톤 과다", "연카멜", "강한 파스텔"],
    },
}

# 상황별 키워드
_OCCASION_TOKENS = {
    "date": ["데이트", "미팅", "연인", "연애", "디너", "저녁", "데이트룩", "여자친구", "남자친구"],
    "office": ["출근", "면접", "회의", "회사", "직장", "오피스", "업무", "면담", "발표"],
    "casual": ["일상", "산책", "쇼핑", "편안", "데일리", "캐주얼", "휴식"],
    "travel": ["여행", "출장", "휴가", "비행", "호텔", "캠핑", "야외"],
    "event": ["파티", "행사", "웨딩", "컨퍼런스", "모임", "결혼식", "세미나"],
}

# 연령대 매핑
_AGE_GROUP_MAP = {
    "10대": "teens",
    "10대초반": "teens",
    "10대후반": "teens",
    "20대초반": "twenties_early",
    "20대중반": "twenties_early",
    "20대초중반": "twenties_early",
    "20대후반": "twenties_late",
    "20대": "twenties_early",
    "30대초반": "thirties_early",
    "30대중반": "thirties_early",
    "30대초중반": "thirties_early",
    "30대후반": "thirties_late",
    "30대": "thirties_early",
    "40대": "forties_plus",
    "50대": "forties_plus",
    "60대": "forties_plus",
}

# 성별 정규화
def _normalize_gender(value: str | None) -> str:
    trimmed = _normalize(value)
    if trimmed in {"", "undisclosed", "unknown", "null"}:
        return ""
    if trimmed in {"m", "남", "man", "남성", "남자", "mail", "메일"}:
        return "male"
    if trimmed in {"f", "여", "woman", "women", "여성", "여자", "femail"}:
        return "female"
    return trimmed

# 연령대 정규화
def _normalize_age_group(value: str | None) -> str:
    trimmed = _normalize(value)
    if not trimmed:
        return ""
    for key, mapped in _AGE_GROUP_MAP.items():
        if key in trimmed:
            return mapped
    if trimmed in {"teens", "twenties_early", "twenties_late", "thirties_early", "thirties_late", "forties_plus"}: 
        return trimmed
    return ""

# 체형 정규화
def _normalize_body_type(value: str | None) -> str:
    trimmed = _normalize(value)
    if not trimmed:
        return ""
    if "slim" in trimmed or "슬림" in trimmed or "마른" in trimmed:
        return "slim"
    if "curvy" in trimmed or "통통" in trimmed or "볼륨" in trimmed:
        return "curvy"
    if "muscular" in trimmed or "근육" in trimmed or "체격" in trimmed or "몸짱" in trimmed:
        return "muscular"
    if "plus" in trimmed or "플러스" in trimmed:
        return "plus"
    if "standard" in trimmed or "보통" in trimmed:
        return "standard"
    return ""

# 스타일 무드 정규화
def _normalize_style_mood(value: str | None) -> str:
    trimmed = _normalize(value)
    if not trimmed:
        return ""
    if "캐주얼" in trimmed or "casual" in trimmed:
        return "casual"
    if "minimal" in trimmed or "미니멀" in trimmed:
        return "minimal"
    if "femin" in trimmed or "여성" in trimmed:
        return "feminine"
    if "chic" in trimmed or "시크" in value.lower():
        return "chic"
    if "street" in trimmed or "스트릿" in trimmed:
        return "street"
    if "classic" in trimmed or "클래식" in trimmed:
        return "classic"
    return ""


# 키워드로 프로필 추출
def _extract_profile_by_keywords(message: str) -> InferredProfile:
    normalized = _normalize(message)
    result = InferredProfile()

    # 성별 추출
    for token in ("남성", "남자", "male", "man", "m"):
        if token in normalized:
            result.gender = "male"
            break
    if not result.gender:
        for token in ("여성", "여자", "female", "woman", "f"):
            if token in normalized:
                result.gender = "female"
                break

    # 연령대 추출
    for token, mapped in _AGE_GROUP_MAP.items():
        if token in normalized:
            result.age_group = mapped
            break

    # 체형 추출
    if "슬림" in normalized or "마른" in normalized or "슬림한" in normalized:
        result.body_type = "slim"
    elif "통통" in normalized or "곡선" in normalized or "볼륨" in normalized:
        result.body_type = "curvy"
    elif "근육" in normalized or "운동" in normalized or "단단" in normalized:
        result.body_type = "muscular"
    elif "플러스" in normalized or "플러스사이즈" in normalized:
        result.body_type = "plus"
    elif result.body_type == "":
        result.body_type = "standard" if "보통" in normalized else ""

    # 스타일 무드 추출
    if any(token in normalized for token in ("편한", "캐주얼", "데일리", "일상", "자연스러운")):
        result.style_mood_preference = "casual"
    elif any(token in normalized for token in ("미니멀", "심플", "깔끔")):
        result.style_mood_preference = "minimal"
    elif any(token in normalized for token in ("페미닌", "여성스러운", "소녀", "로맨틱", "feminine")):
        result.style_mood_preference = "feminine"
    elif any(token in normalized for token in ("시크", "고급", "도시")):
        result.style_mood_preference = "chic"
    elif any(token in normalized for token in ("스트릿", "빈티", "히프합")):
        result.style_mood_preference = "street"
    elif any(token in normalized for token in ("클래식", "깔끔", "심플", "오피스")):
        result.style_mood_preference = "classic"

    return result


# 프로필 추론
def _infer_profile(request: ChatRequest, parsed: ChatResponse | None) -> InferredProfile:
    if parsed and parsed.inferred_profile is not None: # 파싱된 프로필이 있는 경우
        source = parsed.inferred_profile # 파싱된 프로필
        if source.gender is not None: # 성별 정규화
            source.gender = _normalize_gender(source.gender)
        if source.age_group is not None: # 연령대 정규화
            source.age_group = _normalize_age_group(source.age_group)
        if source.body_type is not None: # 체형 정규화
            source.body_type = _normalize_body_type(source.body_type)
        if source.style_mood_preference is not None: # 스타일 무드 정규화
            source.style_mood_preference = _normalize_style_mood(source.style_mood_preference)
        return source

    keyword_profile = _extract_profile_by_keywords(request.message) # 키워드로 프로필 추출
    keyword_profile.gender = _normalize_gender(keyword_profile.gender) # 성별 정규화
    keyword_profile.age_group = _normalize_age_group(keyword_profile.age_group or "") # 연령대 정규화
    keyword_profile.body_type = _normalize_body_type(keyword_profile.body_type or "") # 체형 정규화
    keyword_profile.style_mood_preference = _normalize_style_mood(keyword_profile.style_mood_preference or "") # 스타일 무드 정규화
    return keyword_profile # 키워드로 추출한 프로필 반환


# 문자열 정규화
def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


# 계절 추출
def _extract_requested_season(value: str | None) -> str:
    normalized = _normalize(value)
    if not normalized:
        return ""
    # 계절 키워드
    season_keywords = {
        "spring_warm": ["봄", "spring", "웜톤", "spring warm", "따뜻한", "봄용", "봄코디", "봄옷"],
        "summer_cool": ["여름", "summer", "summer cool", "시원한", "여름용", "여름 코디", "썸머", "한여름"],
        "autumn_warm": ["가을", "autumn", "autumn warm", "가을용", "오렌지톤", "가을코디", "단풍"],
        "winter_cool": ["겨울", "winter", "winter cool", "겨울용", "겨울 코디", "추운", "긴팔"],
    }
    # 계절 키워드 확인
    for key, tokens in season_keywords.items():
        if any(token in normalized for token in tokens):
            return key

    return ""


# 상황 추출
def _extract_occasion_text(message: str) -> dict[str, list[str] | str]:
    normalized = _normalize(message)
    if not normalized:
        return {"detected": "일반", "keywords": []}

    hits: list[str] = []
    detected = "일반"
    for key, tokens in _OCCASION_TOKENS.items():
        if any(token in normalized for token in tokens):
            detected = key
            hits.extend(tokens)

    if not hits:
        hits = [normalized[:20]]

    return {"detected": detected, "keywords": hits}


# 남성인지 확인
def _is_male(gender: str | None) -> bool:
    return _normalize(gender) in _MALE_GENDER_VALUES


# 성별에 따라 쿼리 접두사 추가
def _prefixed_query_by_gender(message: str, gender: str | None) -> str:
    return f"남성 {message}" if _is_male(gender) else message


def _build_chat_context(request: ChatRequest) -> dict[str, list[str] | str]:
    requested_season = _extract_requested_season(request.season)
    profile_season = _extract_requested_season(request.message)
    if not profile_season and request.personal_color:
        profile_season = _normalize(request.personal_color)
    resolved_season = requested_season or profile_season
    season_meta = _SEASONAL_CONTEXTS.get(resolved_season, {})
    occasion = _extract_occasion_text(request.message)
    return {
        "season": resolved_season,
        "season_keywords": list(season_meta.get("season_keywords", [])),
        "palette_positive": list(season_meta.get("palette_positive", [])),
        "palette_negative": list(season_meta.get("palette_negative", [])),
        "requested_season": requested_season,
        "profile_season": profile_season,
        "occasion": occasion["detected"],
        "occasion_keywords": list(occasion["keywords"]),
    }


def _score_match(text: str, keywords: list[str], weight: float = 1.0) -> float:
    if not text or not keywords:
        return 0.0
    lower = text.lower()
    return sum(weight for keyword in keywords if _normalize(keyword) in lower)


def _rank_items_by_color(items: list[StyleItem], context: dict[str, list[str] | str]) -> list[StyleItem]:
    if not items:
        return []

    def _score(item: StyleItem) -> float:
        haystack = " ".join(
            [
                item.title or "",
                item.description or "",
                item.brand or "",
                item.source or "",
            ]
        ).lower()

        positive = _score_match(haystack, list(context.get("palette_positive", [])), weight=1.0)
        negative = _score_match(haystack, list(context.get("palette_negative", [])), weight=1.0)
        season = _score_match(haystack, list(context.get("season_keywords", [])), weight=0.6)
        occasion = _score_match(haystack, list(context.get("occasion_keywords", [])), weight=0.4)
        return (positive - negative) + season + occasion

    ranked = sorted(
        enumerate(items),
        key=lambda pair: (-_score(pair[1]), pair[0]),
    )
    return [item for _, item in ranked]


def _build_sources(documents: list[dict]) -> list[str]:
    sources = [doc["content"][:50] + "..." for doc in documents if doc["similarity"] > 0.6]
    return sources if sources else ["참고 자료 없음"]


def _sanitize_sources(sources: list[str] | None) -> list[str]:
    if not sources:
        return []

    ignored = {"참고자료", "참고 자료", "자료 출처", "source", "..."}
    normalized = [source.strip() for source in sources if source and source.strip()]
    return [source for source in normalized if source.lower() not in ignored]


def process_chat(db: Session, request: ChatRequest) -> ChatResponse:
    """스타일 상담 채팅 처리"""

    context = _build_chat_context(request)
    documents = search_similar_documents(
        db=db,
        query=request.message,
        personal_color=context.get("season"),
        occasion=str(context["occasion"]),
        limit=3,
    )

    context_text = ""
    if documents:
        context_text = "\n\n참고 자료:\n" + "\n".join([
            f"- {doc['content'][:200]}"
            for doc in documents
        ])

    system_prompt = f"""당신은 AI 패션 스타일리스트입니다.
친절하고 전문적으로 스타일 상담을 해주세요.

사용자 정보:
- 퍼스널 컬러: {request.personal_color or '미진단'}
- 성별: {request.gender or '미입력'}
- 연령대: {request.age_group or '미입력'}
- 체형: {request.body_type or '미입력'}
- 분위기 선호: {request.style_mood_preference or '미입력'}

{context_text}

답변 시 주의사항:
1. 사용자의 퍼스널 컬러를 고려하여 색상을 추천하세요.
2. 성별/연령대/체형/분위기 선호 정보가 있으면 해당 맥락에 맞춰 추천하세요.
2-1. 성별이 male이면 여성 전용 의류(스커트, 원피스, 블라우스, 하이힐 등)는 절대 추천하지 마세요.
2-2. 성별이 male이면 남성 캐주얼/스트릿/미니멀 아이템 위주로 추천하세요.
3. 체형 보완(핏, 실루엣) 포인트를 간단히 포함하세요.
4. 계절 톤과 상황 맥락에 맞는 색 조합(회피/선호)을 우선 반영하세요.
5. 한국어로 자연스럽게 답변하세요.
6. 아래 형식의 JSON만 반환하세요.

{{
  "response": "상담 답변",
  "items": [
    {{
      "title": "상품명",
      "description": "추천 이유를 한 줄로 설명",
      "image_url": "https://...",
      "purchase_url": "https://...",
      "brand": "브랜드",
      "price": "가격",
      "source": "자료 출처",
      "tags": ["스타일", "질문"]
    }}
  ],
  "sources": ["참고자료"],
  "inferred_profile": {
    "gender": "male|female|undisclosed",
    "age_group": "teens|twenties_early|twenties_late|thirties_early|thirties_late|forties_plus",
    "body_type": "slim|standard|curvy|muscular|plus",
    "style_mood_preference": "casual|minimal|feminine|chic|street|classic",
    "confidence": 0.0
  }
}}

상품이 없으면 items를 빈 배열로 반환하세요.
답변에는 JSON 외 텍스트를 추가하지 마세요.
"""

    user_prompt = f"""사용자 질문: {request.message}

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
    if context.get("palette_positive"):
        user_prompt += f"선호 색상군: {', '.join(context['palette_positive'])}\n"
    if context.get("palette_negative"):
        user_prompt += f"회피 색상군: {', '.join(context['palette_negative'])}\n"
    if context.get("requested_season"):
        user_prompt += "요청된 계절 조건이 있으면 이를 최우선으로 반영해 추천해 주세요.\n"
    elif context.get("profile_season"):
        user_prompt += "요청된 계절이 없으면 사용자 프로필 기준 계절/톤으로 반영해 주세요.\n"
    user_prompt += (
        "\n답변에서 코디 제안 시 상하의/아우터/신발 간 톤 앵글을 맞추고, "
        "계절/상황에 맞는 색 조합을 우선 제시하세요.\n"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in request.chat_history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_prompt})

    response = chat_completion(messages, json_mode=True)
    parsed = parse_json_to_model(response, ChatResponse)
    inferred_profile = _infer_profile(request, parsed)

    sources = _build_sources(documents)
    if parsed:
        parsed_sources = _sanitize_sources(parsed.sources) or sources
        parsed_items = []
        for item in parsed.items:
            parsed_items.append(
                StyleItem(
                    title=item.title,
                    description=item.description,
                    image_url=item.image_url,
                    purchase_url=item.purchase_url,
                    brand=item.brand,
                    price=item.price,
                    source=item.source,
                    tags=item.tags,
                )
            )

        enriched_items = enrich_style_items(parsed_items, fallback_query=request.message, gender=request.gender)
        enriched_items = filter_items_by_gender(enriched_items, request.gender)
        enriched_items = _rank_items_by_color(enriched_items, context)
        if not enriched_items:
            enriched_items = build_items_from_text(
                parsed.response or "", max_items=DEFAULT_RECOMMENDATION_COUNT, gender=request.gender
            )
            enriched_items = filter_items_by_gender(enriched_items, request.gender)
            enriched_items = _rank_items_by_color(enriched_items, context)
        if not enriched_items:
            gender_prefixed_query = _prefixed_query_by_gender(request.message, request.gender)
            enriched_items = search_shopping_products_with_gender(
                gender_prefixed_query, request.gender, display=DEFAULT_RECOMMENDATION_COUNT
            )
            enriched_items = filter_items_by_gender(enriched_items, request.gender)
            enriched_items = _rank_items_by_color(enriched_items, context)

        return ChatResponse(
            response=parsed.response or "",
            sources=parsed_sources,
            items=enriched_items,
            inferred_profile=inferred_profile,
        )

    fallback_items = build_items_from_text(response, max_items=DEFAULT_RECOMMENDATION_COUNT, gender=request.gender)
    fallback_items = filter_items_by_gender(fallback_items, request.gender)
    fallback_items = _rank_items_by_color(fallback_items, context)
    if not fallback_items:
        gender_prefixed_query = _prefixed_query_by_gender(request.message, request.gender)
        fallback_items = search_shopping_products_with_gender(
            gender_prefixed_query, request.gender, display=DEFAULT_RECOMMENDATION_COUNT
        )
        fallback_items = filter_items_by_gender(fallback_items, request.gender)
        fallback_items = _rank_items_by_color(fallback_items, context)

    return ChatResponse(
        response=response,
        sources=sources,
        items=fallback_items,
        inferred_profile=inferred_profile,
    )
