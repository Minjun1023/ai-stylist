from fastapi import APIRouter, Depends, UploadFile, File
from app.core.security import verify_internal_api_key
from app.models.common import ApiResponse
from app.models.personal_color import SurveyAnalysisRequest, ImageAnalysisRequest
from app.services.personal_color_service import analyze_survey, analyze_image
import os
import uuid

router = APIRouter()

# /api/personal-color/survey
@router.post("/survey")
async def analyze_by_survey(
    request: SurveyAnalysisRequest,  # 설문 데이터
    api_key: str = Depends(verify_internal_api_key) # 내부 API 키
):
    """설문 기반 퍼스널 컬러 진단"""
    result = analyze_survey(request)
    # 성공 응답
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="설문 분석이 완료되었습니다"
    )


# /api/personal-color/image
@router.post("/image")
async def analyze_by_image(
    request: ImageAnalysisRequest,  # 이미지 URL
    api_key: str = Depends(verify_internal_api_key) # 내부 API 키
):
    """이미지 기반 퍼스널 컬러 진단"""
    result = analyze_image(request.image_url)
    # 성공 응답
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="이미지 분석이 완료되었습니다"
    )

# /api/personal-color/upload-and-analyze
@router.post("/upload-and-analyze")
async def upload_and_analyze(
    file: UploadFile = File(...),   # 업로드 파일
    api_key: str = Depends(verify_internal_api_key) # 내부 API 키
):
    """이미지 업로드 후 분석"""
    
    # 파일 저장
    upload_dir = "/app/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    # 파일 이름 생성
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_name = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(upload_dir, file_name)
    
    # 파일 저장
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # 분석
    result = analyze_image(file_path)
    
    # 성공 응답
    return ApiResponse.success_response(
        data={
            **result.model_dump(),
            "image_url": f"/uploads/{file_name}"
        },
        message="이미지 분석이 완료되었습니다"
    )