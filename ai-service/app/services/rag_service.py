from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.openai_client import get_embedding, chat_completion
from app.models.style import StyleRecommendRequest, StyleRecommendResponse
from typing import List

# 벡터 유사도 검색
def search_similar_documents(
    db: Session,    # 데이터베이스 세션
    query: str,     # 검색 쿼리
    personal_color: str = None, # 퍼스널 컬러
    limit: int = 5  # 검색 결과 수
) -> List[dict]: # 검색 결과 리스트
    """벡터 유사도 검색"""
    
    # 쿼리 임베딩 생성
    query_embedding = get_embedding(query)
    
    # 벡터 검색 SQL
    sql = """
    SELECT 
        id,
        content,
        personal_color,
        occasion,
        metadata,
        1 - (embedding <=> :embedding::vector) as similarity
    FROM fashion_knowledge
    WHERE 1=1
    """
    
    params = {"embedding": str(query_embedding)} # 쿼리 임베딩
    # 퍼스널 컬러 필터링
    if personal_color:
        sql += " AND (personal_color = :personal_color OR personal_color IS NULL)" # 퍼스널 컬러 또는 NULL
        params["personal_color"] = personal_color   # 퍼스널 컬러
    # 유사도 순 정렬
    sql += """
    ORDER BY embedding <=> :embedding::vector
    LIMIT :limit
    """
    params["limit"] = limit # 검색 결과 수
    
    result = db.execute(text(sql), params) # SQL 실행
    
    documents = [] # 검색 결과 리스트
    for row in result: # 검색 결과 순회
        documents.append({  # 검색 결과 추가
            "id": row.id,   # 문서 ID
            "content": row.content, # 문서 내용
            "personal_color": row.personal_color,   # 퍼스널 컬러
            "occasion": row.occasion,   # 상황/TPO
            "similarity": float(row.similarity) if row.similarity else 0 # 유사도
        })
    # 검색 결과 반환
    return documents

# RAG 기반 스타일 추천
def generate_style_recommendation(
    db: Session, # 데이터베이스 세션
    request: StyleRecommendRequest # 스타일 추천 요청
) -> StyleRecommendResponse: # 스타일 추천 응답
    """RAG 기반 스타일 추천"""
    
    # 1. 관련 문서 검색
    documents = search_similar_documents(
        db=db, # 데이터베이스 세션
        query=request.query, # 검색 쿼리
        personal_color=request.personal_color, # 퍼스널 컬러
        limit=5 # 검색 결과 수
    )
    
    # 2. 컨텍스트 구성
    context = "\n\n".join([
        f"[참고 {i+1}] {doc['content']}" # 참고 자료 추가
        for i, doc in enumerate(documents) # 검색 결과 순회
    ])
    
    # 3. 프롬프트 구성
    system_prompt = """당신은 전문 패션 스타일리스트입니다.
사용자의 질문에 친절하고 전문적으로 답변해주세요.
참고 자료를 활용하되, 자연스럽게 답변하세요.""" # 시스템 프롬프트

    user_prompt = f"""
사용자 질문: {request.query}

""" # 사용자 질문
    
    if request.personal_color:
        user_prompt += f"사용자 퍼스널 컬러: {request.personal_color}\n\n" # 사용자 퍼스널 컬러
    
    if request.occasion:
        user_prompt += f"상황/TPO: {request.occasion}\n\n" # 상황/TPO
    
    if context:
        user_prompt += f"참고 자료:\n{context}\n\n" # 참고 자료
    
    user_prompt += "위 정보를 참고하여 스타일 추천을 해주세요." # 스타일 추천 요청
    
    # 4. LLM 호출
    response = chat_completion([
        {"role": "system", "content": system_prompt}, # 시스템 프롬프트
        {"role": "user", "content": user_prompt} # 사용자 프롬프트
    ])
    
    # 5. 응답 구성
    sources = [doc["content"][:100] + "..." for doc in documents if doc["similarity"] > 0.5] # 참고 자료
    # 스타일 추천 응답 반환
    return StyleRecommendResponse(
        recommendation=response, # 추천 결과
        sources=sources # 참고 자료
    )