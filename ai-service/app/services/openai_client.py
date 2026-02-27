
from openai import OpenAI
from app.core.config import settings
import base64
import httpx

client = OpenAI(api_key=settings.openai_api_key)


def get_embedding(text: str) -> list[float]:
    """텍스트를 벡터로 변환"""
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=text
    )
    return response.data[0].embedding


def chat_completion(messages: list[dict], model: str = None, json_mode: bool = False) -> str:
    """채팅 응답 생성"""
    request = {
        "model": model or settings.chat_model,
        "messages": messages,
        "temperature": 0.7
    }
    if json_mode:
        request["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(
        **request
    )
    return response.choices[0].message.content


def analyze_image_with_vision(image_url: str, prompt: str, json_mode: bool = False) -> str:
    """이미지 분석 (GPT-4 Vision)"""
    
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
        with open(image_url, "rb") as f:
            image_data = base64.b64encode(f.read()).decode("utf-8")
        image_content = {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{image_data}"
            }
        }
    
    request = {
        "model": settings.vision_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    image_content
                ]
            }
        ],
        "max_tokens": 1000
    }
    if json_mode:
        request["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**request)
    
    return response.choices[0].message.content
