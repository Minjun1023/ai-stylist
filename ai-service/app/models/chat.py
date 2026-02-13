from pydantic import BaseModel
from typing import Optional, List

# 채팅 메시지 모델
class ChatMessage(BaseModel):
    role: str  # user, assistant, system
    content: str

# 채팅 요청 모델
class ChatRequest(BaseModel):
    message: str
    personal_color: Optional[str] = None
    chat_history: List[ChatMessage] = []
    user_id: int

# 채팅 응답 모델
class ChatResponse(BaseModel):
    response: str
    sources: List[str] = []