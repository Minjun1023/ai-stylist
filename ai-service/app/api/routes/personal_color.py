from fastapi import APIRouter, Depends, UploadFile, File
from app.core.security import verify_internal_api_key
from app.models.common import ApiResponse
from app.models.personal_color import SurveyAnalysisRequest, ImageAnalysisRequest
from app.services.personal_color_service import analyze_survey, analyze_image
import os
import uuid

router = APIRouter()

# 설문 기반 퍼스널 컬러 진단
@router.post("/survey")
async def analyze_by_survey(
    request: SurveyAnalysisRequest, # 설문 요청
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """설문 기반 퍼스널 컬러 진단"""
    result = analyze_survey(request)
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="설문 분석이 완료되었습니다"
    )

# 이미지 기반 퍼스널 컬러 진단
@router.post("/image")
async def analyze_by_image(
    request: ImageAnalysisRequest, # 이미지 요청
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """이미지 기반 퍼스널 컬러 진단"""
    result = analyze_image(request.image_url) # 이미지 분석
    return ApiResponse.success_response(
        data=result.model_dump(),
        message="이미지 분석이 완료되었습니다"
    )

# 이미지 업로드 후 분석
@router.post("/upload-and-analyze")
async def upload_and_analyze(
    file: UploadFile = File(...), # 이미지 파일
    api_key: str = Depends(verify_internal_api_key) # API 키
):
    """이미지 업로드 후 분석"""
    
    upload_dir = "/app/uploads" # 업로드 디렉토리
    os.makedirs(upload_dir, exist_ok=True) # 디렉토리 생성
    
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg" # 파일 확장자
    file_name = f"{uuid.uuid4()}.{file_ext}" # 파일 이름
    file_path = os.path.join(upload_dir, file_name) # 파일 경로
        
    with open(file_path, "wb") as f:    
        content = await file.read()
        f.write(content)
    
    result = analyze_image(file_path) # 이미지 분석 
    
    return ApiResponse.success_response(
        data={
            **result.model_dump(),
            "image_url": f"/uploads/{file_name}"
        },
        message="이미지 분석이 완료되었습니다"
    )
