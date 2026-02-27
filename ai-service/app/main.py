
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.routes import health, personal_color, style, chat, embed
from app.core.config import settings

app = FastAPI(
    title=settings.app_name,
    description="AI 스타일리스트 AI 서비스",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_dir = "/app/uploads"
os.makedirs(upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(personal_color.router, prefix="/analyze/personal-color", tags=["Personal Color"])
app.include_router(style.router, prefix="/style", tags=["Style"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(embed.router, prefix="/embed", tags=["Embedding"])

@app.get("/")
async def root():
    return {
        "message": "AI Stylist AI Service",
        "docs": "/docs",
        "health": "/health"
    }
