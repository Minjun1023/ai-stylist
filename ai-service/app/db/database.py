
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pgvector.sqlalchemy import Vector
from app.core.config import settings

database_url = settings.database_url # 데이터베이스 URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg2://")

engine = create_engine(database_url, echo=settings.debug) # 데이터베이스 엔진
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine) # 데이터베이스 세션
Base = declarative_base() # 데이터베이스 모델

def get_db(): # 데이터베이스 세션
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
