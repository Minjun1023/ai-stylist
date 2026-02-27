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


class EmbedRequest(BaseModel):
    content: str # 임베딩할 내용
    personal_color: str = "" # 퍼스널 컬러
    occasion: str = "" # 상황
    metadata: dict = {} # 메타데이터

@router.post("") # 임베딩 생성
async def create_embedding(
    request: EmbedRequest, # 임베딩 요청
    db: Session = Depends(get_db), # 데이터베이스 세션
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """패션 지식 임베딩 생성 및 저장"""    
    embedding = get_embedding(request.content) # 임베딩 생성
    
    sql = """
    INSERT INTO fashion_knowledge (content, embedding, personal_color, occasion, metadata)
    VALUES (:content, CAST(:embedding AS vector), :personal_color, :occasion, CAST(:metadata AS jsonb))
    RETURNING id
    """
    
    import json
    result = db.execute(text(sql), {
        "content": request.content, # 임베딩할 내용
        "embedding": str(embedding), # 임베딩
        "personal_color": request.personal_color, # 퍼스널 컬러
        "occasion": request.occasion, # 상황
        "metadata": json.dumps(request.metadata) if request.metadata else None # 메타데이터
    })
    db.commit()
    
    inserted_id = result.fetchone()[0] # 삽입된 ID  
    # 응답 생성
    return ApiResponse.success_response(
        data={"id": inserted_id}, # 삽입된 ID
        message="지식이 추가되었습니다" # 응답 메시지
    )
