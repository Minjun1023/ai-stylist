from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.security import verify_internal_api_key
from app.db.database import get_db
from app.models.common import ApiResponse
from app.models.style import StyleRecommendRequest, HomeStyleRecommendRequest
from app.services.rag_service import generate_home_style_recommendation, generate_style_recommendation

router = APIRouter()
# RAG 기반 로그인 스타일 추천
@router.post("/recommend")
async def recommend_style(
    request: StyleRecommendRequest, # 스타일 추천 요청
    db: Session = Depends(get_db), # 데이터베이스 세션
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """RAG 기반 스타일 추천"""
    result = generate_style_recommendation(db, request) # 스타일 추천
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="스타일 추천이 완료되었습니다"
    )

# RAG 기반 비로그인 스타일 추천
@router.post("/recommend/guest")
async def recommend_style_guest(
    request: StyleRecommendRequest, # 스타일 추천 요청
    db: Session = Depends(get_db), # 데이터베이스 세션
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """RAG 기반 비로그인 스타일 추천"""
    normalized_request = request.model_copy(update={"user_id": 0}) # 비로그인 사용자 설정
    result = generate_style_recommendation(db, normalized_request)
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="비로그인 스타일 추천이 완료되었습니다"
    )

# 홈 화면용 코디 세트 추천
@router.post("/home")
async def recommend_home_style(
    request: HomeStyleRecommendRequest, # 홈 스타일 추천 요청
    db: Session = Depends(get_db), # 데이터베이스 세션
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """홈 화면용 코디 세트 추천"""
    result = generate_home_style_recommendation(db, request)
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="홈 스타일 추천이 완료되었습니다"
    )
# 홈 화면 비로그인 사용자 코디 세트 추천
@router.post("/home/guest")
async def recommend_home_style_guest(
    request: HomeStyleRecommendRequest, # 홈 스타일 추천 요청
    db: Session = Depends(get_db), # 데이터베이스 세션
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """홈 화면 비로그인 사용자 코디 세트 추천"""
    normalized_request = request.model_copy(update={"user_id": 0}) # 비로그인 사용자 설정
    result = generate_home_style_recommendation(db, normalized_request) # 홈 스타일 추천
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="비로그인 홈 스타일 추천이 완료되었습니다"
    )
