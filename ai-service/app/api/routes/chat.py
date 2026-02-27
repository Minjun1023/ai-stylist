from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.security import verify_internal_api_key
from app.db.database import get_db
from app.models.common import ApiResponse
from app.models.chat import ChatRequest
from app.services.chat_service import process_chat


router = APIRouter()
# 채팅 API
@router.post("") 
async def chat(
    request: ChatRequest, # 채팅 요청
    db: Session = Depends(get_db), # 데이터베이스 세션
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """AI 스타일리스트 채팅"""
    # 채팅 처리
    result = process_chat(db, request) 
    # 응답 생성
    return ApiResponse.success_response(
        data=result.model_dump(), 
        message="응답이 생성되었습니다" 
    )
