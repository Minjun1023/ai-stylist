from pydantic import BaseModel, Field
from typing import Optional, List
from app.models.style import StyleItem

# 채팅 메시지
class ChatMessage(BaseModel):
    role: str # 역할
    content: str # 내용

# 채팅 요청
class ChatRequest(BaseModel):
    message: str # 메시지
    season: Optional[str] = None # 계절
    personal_color: Optional[str] = None # 퍼스널 컬러
    gender: Optional[str] = None # 성별
    age_group: Optional[str] = None # 연령대
    body_type: Optional[str] = None # 체형
    style_mood_preference: Optional[str] = None # 스타일 취향
    chat_history: List[ChatMessage] = Field(default_factory=list) # 채팅 기록
    user_id: int # 사용자 ID


# 추론된 프로필
class InferredProfile(BaseModel):
    gender: Optional[str] = None # 성별
    age_group: Optional[str] = None # 연령대
    body_type: Optional[str] = None # 체형
    style_mood_preference: Optional[str] = None # 스타일 취향
    confidence: Optional[float] = None # 신뢰도


# 채팅 응답
class ChatResponse(BaseModel):
    response: str = '' # 응답
    sources: List[str] = Field(default_factory=list) # 소스
    items: List[StyleItem] = Field(default_factory=list) # 아이템
    inferred_profile: Optional[InferredProfile] = None # 추론된 프로필
