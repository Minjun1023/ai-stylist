from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.security import verify_internal_api_key
from app.db.database import get_db
from app.models.common import ApiResponse
from app.models.chat import ChatRequest
from app.services.chat_service import process_chat

router = APIRouter()


# /api/chat
@router.post("")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_internal_api_key)
):
    """AI 스타일리스트 채팅"""
    result = process_chat(db, request)
    # 성공 응답
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="응답이 생성되었습니다"
    )