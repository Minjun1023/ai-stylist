from pydantic_settings import BaseSettings
from functools import lru_cache
# 환경 변수 설정
class Settings(BaseSettings):
    app_name: str = "AI Stylist Service"
    debug: bool = True
    
    database_url: str # 데이터베이스 URL
    
    openai_api_key: str # OpenAI API 키

    internal_api_key: str # 내부 API 키
    
    embedding_model: str = "text-embedding-3-small" # 임베딩 모델
    chat_model: str = "gpt-4o-mini" # 채팅 모델
    vision_model: str = "gpt-4o" # 비전 모델

    class Config:
        env_file = ".env" # 환경 변수 파일


@lru_cache # 캐시
def get_settings() -> Settings: # 설정 가져오기
    return Settings()


settings = get_settings() # 설정
