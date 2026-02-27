from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

api_key_header = APIKeyHeader(name="X-Internal-API-Key", auto_error=False) # API 키 헤더


async def verify_internal_api_key(api_key: str = Security(api_key_header)): # API 키 검증
    """Spring Boot에서 오는 요청만 허용"""
    if api_key is None or api_key != settings.internal_api_key: # API 키 검증
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, # 403 Forbidden
            detail="Invalid or missing API key" # API 키가 없거나 잘못되었습니다
        )
    return api_key # API 키 반환
