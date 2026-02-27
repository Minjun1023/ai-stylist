from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
# 공통 응답
class ApiResponse(BaseModel):
    success: bool # 성공 여부
    message: Optional[str] = None # 메시지
    data: Optional[Any] = None # 데이터
    timestamp: datetime = datetime.now() # 타임스탬프
    
    @classmethod
    def success_response(cls, data: Any = None, message: str = None): # 성공 응답
        return cls(success=True, data=data, message=message)
    
    @classmethod
    def error_response(cls, message: str): # 실패 응답
        return cls(success=False, message=message)
