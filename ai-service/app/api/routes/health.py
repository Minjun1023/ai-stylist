from fastapi import APIRouter
from app.models.common import ApiResponse

router = APIRouter()
# 헬스 체크
@router.get("")
async def health_check():
    # 응답 생성
    return ApiResponse.success_response(
        data={
            "status": "UP",
            "service": "AI Stylist AI Service",
            "version": "1.0.0"
        }
    )
