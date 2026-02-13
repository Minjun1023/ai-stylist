from fastapi import APIRouter
from app.models.common import ApiResponse

router = APIRouter()

# /api/health
@router.get("")
async def health_check():
    # 상태 확인
    return ApiResponse.success_response(
        data={
            "status": "UP",
            "service": "AI Stylist AI Service",
            "version": "1.0.0"
        }
    )