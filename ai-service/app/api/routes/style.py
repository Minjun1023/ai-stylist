from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.security import verify_internal_api_key
from app.db.database import get_db
from app.models.common import ApiResponse
from app.models.style import StyleRecommendRequest
from app.services.rag_service import generate_style_recommendation

router = APIRouter()

# /api/style/recommend
@router.post("/recommend")
async def recommend_style(
    request: StyleRecommendRequest,  # 설문 데이터
    db: Session = Depends(get_db),   # 데이터베이스 세션
    api_key: str = Depends(verify_internal_api_key) # 내부 API 키
):
    """RAG 기반 스타일 추천"""
    result = generate_style_recommendation(db, request)
    # 성공 응답
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="스타일 추천이 완료되었습니다"
    )