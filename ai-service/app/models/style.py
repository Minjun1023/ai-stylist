from pydantic import BaseModel
from typing import Optional, List

# 스타일 추천 요청
class StyleRecommendRequest(BaseModel):
    query: str # 스타일 추천 요청
    personal_color: Optional[str] = None # 퍼스널 컬러
    occasion: Optional[str] = None # 상황
    user_id: int # 사용자 ID

# 스타일 추천 응답
class StyleRecommendResponse(BaseModel):
    recommendation: str # 스타일 추천
    items: List[dict] = [] # 추천 아이템
    sources: List[str] = [] # 출처