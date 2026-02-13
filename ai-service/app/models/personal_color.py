from pydantic import BaseModel
from typing import Optional, Dict, List
from enum import Enum

# 퍼스널 컬러 타입
class PersonalColorType(str, Enum):
    SPRING_WARM = "spring_warm" # 봄 웜톤
    SUMMER_COOL = "summer_cool" # 여름 쿨톤
    AUTUMN_WARM = "autumn_warm" # 가을 웜톤
    WINTER_COOL = "winter_cool" # 겨울 쿨톤

# 컬러 팔레트
class ColorPalette(BaseModel):
    primary_colors: List[str] # 추천 컬러
    secondary_colors: List[str] # 서브 컬러
    avoid_colors: List[str] # 비추천 컬러

# 설문 분석 요청
class SurveyAnalysisRequest(BaseModel):
    answers: Dict[str, str] # 설문 답변

# 이미지 분석 요청
class ImageAnalysisRequest(BaseModel):
    image_url: str # 이미지 URL
    user_id: int # 사용자 ID

# 퍼스널 컬러 분석 응답
class PersonalColorAnalysisResponse(BaseModel):
    color_type: PersonalColorType # 퍼스널 컬러 타입
    confidence: float # 신뢰도
    description: str # 설명
    palette: ColorPalette # 컬러 팔레트
    styling_tips: List[str] # 스타일링 팁