from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.routes import health, personal_color, style, chat, embed
from app.core.config import settings

# FastAPI 앱 생성
app = FastAPI(
    title=settings.app_name, # 앱 이름
    description="AI 스타일리스트 AI 서비스", # 앱 설명
    version="1.0.0" # 앱 버전
)

# CORS 설정
app.add_middleware(
    CORSMiddleware, # CORS 미들웨어
    allow_origins=["*"],  # 실제 운영에서는 특정 도메인만 허용
    allow_credentials=True, # 인증 정보 허용
    allow_methods=["*"], # HTTP 메서드 허용
    allow_headers=["*"], # HTTP 헤더 허용
)

# Static files (업로드된 이미지)
upload_dir = "/app/uploads" # 업로드 디렉토리
os.makedirs(upload_dir, exist_ok=True) # 디렉토리 생성
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads") # 정적 파일 마운트

# Routes
app.include_router(health.router, prefix="/health", tags=["Health"]) # 헬스 체크 라우터
app.include_router(personal_color.router, prefix="/analyze/personal-color", tags=["Personal Color"]) # 퍼스널 컬러 분석 라우터
app.include_router(style.router, prefix="/style", tags=["Style"]) # 스타일 추천 라우터
app.include_router(chat.router, prefix="/chat", tags=["Chat"]) # 채팅 라우터
app.include_router(embed.router, prefix="/embed", tags=["Embedding"]) # 임베딩 라우터

# 루트 엔드포인트
@app.get("/")
async def root():
    return {
        "message": "AI Stylist AI Service", # 앱 이름
        "docs": "/docs", # API 문서
        "health": "/health" # 헬스 체크
    }