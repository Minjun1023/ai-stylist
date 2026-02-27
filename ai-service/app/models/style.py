from pydantic import BaseModel
from typing import Optional, List

# 스타일 아이템
class StyleItem(BaseModel):
    title: str = '추천 아이템' # 제목
    description: Optional[str] = None # 설명
    category: Optional[str] = None # 카테고리
    gender: Optional[str] = None # 성별
    image_url: Optional[str] = None # 이미지 URL
    purchase_url: Optional[str] = None # 구매 URL
    brand: Optional[str] = None # 브랜드
    price: Optional[str] = None # 가격
    source: Optional[str] = None # 소스
    tags: Optional[List[str]] = None # 태그

# 스타일 추천 요청
class StyleRecommendRequest(BaseModel):
    query: str # 쿼리
    season: Optional[str] = None # 계절
    personal_color: Optional[str] = None # 퍼스널 컬러
    gender: Optional[str] = None # 성별
    age_group: Optional[str] = None # 연령대
    body_type: Optional[str] = None # 체형
    style_mood_preference: Optional[str] = None # 스타일 취향
    occasion: Optional[str] = None # 상황
    user_id: int = 0 # 사용자 ID

# 스타일 추천 응답
class StyleRecommendResponse(BaseModel):
    recommendation: str = '' # 추천
    items: List[StyleItem] = [] # 아이템
    sources: List[str] = [] # 소스

# 홈 스타일 세트 아이템
class HomeStyleSetItem(StyleItem):
    brand_label: Optional[str] = None # 브랜드 라벨
    subtitle: Optional[str] = None # 부제목
    price_label: Optional[str] = None # 가격 라벨
    source_label: Optional[str] = None # 소스 라벨

# 홈 추천 세트
class HomeRecommendationSet(BaseModel):
    id: str = '' # ID
    title: str = '' # 제목
    summary: str = '' # 요약
    tag: str = 'AI 추천' # 태그
    items: List[HomeStyleSetItem] = [] # 아이템

# 홈 스타일 추천 요청
class HomeStyleRecommendRequest(BaseModel):
    query: str # 쿼리
    season: Optional[str] = None # 계절
    personal_color: Optional[str] = None # 퍼스널 컬러
    gender: Optional[str] = None # 성별
    age_group: Optional[str] = None # 연령대
    body_type: Optional[str] = None # 체형
    style_mood_preference: Optional[str] = None # 스타일 취향
    occasion: Optional[str] = None # 상황
    user_id: int = 0 # 사용자 ID

# 홈 스타일 추천 응답
class HomeStyleRecommendResponse(BaseModel):
    recommendation: str = '' # 추천
    sets: List[HomeRecommendationSet] = [] # 세트
    sources: List[str] = [] # 소스
