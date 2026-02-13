from pydantic_settings import BaseSettings
from functools import lru_cache

# 설정 클래스
class Settings(BaseSettings):
    # App
    app_name: str = "AI Stylist Service"
    debug: bool = True
    
    # Database
    database_url: str
    
    # OpenAI
    openai_api_key: str
    
    # Internal API Security
    internal_api_key: str
    
    # Model Settings
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"
    vision_model: str = "gpt-4o"
    
    class Config:
        env_file = ".env"


# 설정 캐시
@lru_cache
def get_settings() -> Settings:
    return Settings()


# 설정 인스턴스
settings = get_settings()