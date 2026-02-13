from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.core.security import verify_internal_api_key
from app.db.database import get_db
from app.models.common import ApiResponse
from app.services.openai_client import get_embedding

router = APIRouter()


# /api/embed
class EmbedRequest(BaseModel):
    content: str
    personal_color: Optional[str] = None
    occasion: Optional[str] = None
    metadata: Optional[dict] = None

@router.post("")
async def create_embedding(
    request: EmbedRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(verify_internal_api_key)
):
    """패션 지식 임베딩 생성 및 저장"""
    
    # 임베딩 생성
    embedding = get_embedding(request.content)
    
    # DB 저장
    sql = """
    INSERT INTO fashion_knowledge (content, embedding, personal_color, occasion, metadata)
    VALUES (:content, :embedding::vector, :personal_color, :occasion, :metadata::jsonb)
    RETURNING id
    """
    
    # SQL 실행
    import json
    result = db.execute(text(sql), {
        "content": request.content,
        "embedding": str(embedding),
        "personal_color": request.personal_color,
        "occasion": request.occasion,
        "metadata": json.dumps(request.metadata) if request.metadata else None
    })
    db.commit()
    
    # 결과 반환
    inserted_id = result.fetchone()[0]
    
    # 성공 응답
    return ApiResponse.success_response(
        data={"id": inserted_id},
        message="지식이 추가되었습니다"
    )