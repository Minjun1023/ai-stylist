from openai import OpenAI
from app.core.config import settings
import base64
import httpx

# OpenAI 클라이언트 초기화
client = OpenAI(api_key=settings.openai_api_key)


# 텍스트를 벡터로 변환
def get_embedding(text: str) -> list[float]:
    """텍스트를 벡터로 변환"""
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=text
    )
    # 벡터 반환
    return response.data[0].embedding


# 채팅 응답 생성
def chat_completion(messages: list[dict], model: str = None) -> str:
    """채팅 응답 생성"""
    response = client.chat.completions.create(
        model=model or settings.chat_model,
        messages=messages,
        temperature=0.7
    )
    # 응답 반환
    return response.choices[0].message.content


# 이미지 분석 (GPT-4 Vision)
def analyze_image_with_vision(image_url: str, prompt: str) -> str:
    """이미지 분석 (GPT-4 Vision)"""
    
    # URL에서 이미지를 base64로 변환
    if image_url.startswith("http"):
        response = httpx.get(image_url)
        image_data = base64.b64encode(response.content).decode("utf-8")
        image_content = {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{image_data}"
            }
        }
    else:
        # 로컬 파일 경로인 경우
        with open(image_url, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        image_content = {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{image_data}"
            }
        }
    
    # 이미지 분석
    response = client.chat.completions.create(
        # 모델 선택
        model=settings.vision_model,
        # 메시지
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    image_content
                ]
            }
        ],
        # 최대 토큰 수
        max_tokens=1000
    )
    
    # 응답 반환
    return response.choices[0].message.content