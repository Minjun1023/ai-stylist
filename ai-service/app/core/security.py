from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

# API 키 헤더
api_key_header = APIKeyHeader(name="X-Internal-API-Key", auto_error=False)


# API 키 검증
async def verify_internal_api_key(api_key: str = Security(api_key_header)):
    """Spring Boot에서 오는 요청만 허용"""
    if api_key is None or api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key"
        )
    return api_key