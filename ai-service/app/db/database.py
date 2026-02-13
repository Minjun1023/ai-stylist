from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pgvector.sqlalchemy import Vector
from app.core.config import settings

# Database URL 변환 (asyncpg 지원을 위해)
database_url = settings.database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg2://")

# 데이터베이스 연결
engine = create_engine(database_url, echo=settings.debug)
# 데이터베이스 세션
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# 데이터베이스 모델
Base = declarative_base()

# 데이터베이스 세션 가져오기
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()