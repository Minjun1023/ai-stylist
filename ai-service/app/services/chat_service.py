from sqlalchemy.orm import Session
from app.services.rag_service import search_similar_documents
from app.services.openai_client import chat_completion
from app.models.chat import ChatRequest, ChatResponse

# 스타일 상담 채팅 처리
def process_chat(db: Session, request: ChatRequest) -> ChatResponse:
    """스타일 상담 채팅 처리"""
    
    # 1. 관련 문서 검색 (RAG)
    documents = search_similar_documents(
        db=db,
        query=request.message,
        personal_color=request.personal_color,
        limit=3
    )
    
    # 2. 컨텍스트 구성
    context = ""
    if documents:
        context = "\n\n참고 자료:\n" + "\n".join([
            f"- {doc['content'][:200]}"
            for doc in documents
        ])
    
    # 3. 시스템 프롬프트
    system_prompt = f"""당신은 AI 패션 스타일리스트입니다.
친절하고 전문적으로 스타일 상담을 해주세요.

사용자 정보:
- 퍼스널 컬러: {request.personal_color or '미진단'}

{context}

답변 시 주의사항:
1. 사용자의 퍼스널 컬러를 고려하여 색상을 추천하세요.
2. 구체적인 아이템과 브랜드를 언급하면 좋습니다.
3. 한국어로 자연스럽게 답변하세요.
"""
    
    # 4. 대화 히스토리 구성
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in request.chat_history[-10:]:  # 최근 10개 메시지만
        messages.append({"role": msg.role, "content": msg.content})
    
    messages.append({"role": "user", "content": request.message})
    
    # 5. LLM 호출
    response = chat_completion(messages)
    
    # 6. 응답 구성
    sources = [doc["content"][:50] + "..." for doc in documents if doc["similarity"] > 0.6]
    
    return ChatResponse(
        response=response,
        sources=sources
    )