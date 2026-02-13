from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

# API 응답 모델
class ApiResponse(BaseModel):
    success: bool   # 성공 여부
    message: Optional[str] = None   # 메시지
    data: Optional[Any] = None  # 데이터
    timestamp: datetime = datetime.now()   # 타임스탬프
    
    # 성공 응답
    @classmethod
    def success_response(cls, data: Any = None, message: str = None):
        return cls(success=True, data=data, message=message)
    
    # 실패 응답
    @classmethod
    def error_response(cls, message: str):
        return cls(success=False, message=message)