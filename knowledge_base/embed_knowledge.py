"""
패션 지식 임베딩 스크립트
이 스크립트를 실행하면 knowledge_base의 모든 마크다운 파일을
벡터화하여 PostgreSQL에 저장합니다.
"""

import os
import glob
import httpx
from pathlib import Path

# 설정
FASTAPI_URL = os.getenv("FASTAPI_URL", "http://localhost:8000")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "your-internal-api-key")

def read_markdown_file(filepath: str) -> dict:
    """마크다운 파일 읽기 및 메타데이터 추출"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 파일 경로에서 메타데이터 추출
    path_parts = Path(filepath).parts
    
    # personal_color 추출
    personal_color = None
    if "personal_color" in path_parts:
        filename = Path(filepath).stem
        if filename in ["spring_warm", "summer_cool", "autumn_warm", "winter_cool"]:
            personal_color = filename
    
    # occasion 추출
    occasion = None
    if "occasion" in path_parts:
        occasion = Path(filepath).stem
    
    return {
        "content": content,
        "personal_color": personal_color,
        "occasion": occasion,
        "metadata": {
            "source": filepath,
            "category": path_parts[-2] if len(path_parts) > 1 else "general"
        }
    }


def chunk_content(content: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    """컨텐츠를 청크로 분리"""
    chunks = []
    
    # 섹션별로 분리 (## 기준)
    sections = content.split("\n## ")
    
    for i, section in enumerate(sections):
        if i > 0:
            section = "## " + section
        
        # 섹션이 너무 길면 추가 분리
        if len(section) > chunk_size:
            words = section.split()
            current_chunk = []
            current_length = 0
            
            for word in words:
                current_chunk.append(word)
                current_length += len(word) + 1
                
                if current_length >= chunk_size:
                    chunks.append(" ".join(current_chunk))
                    # overlap 적용
                    overlap_words = current_chunk[-overlap//10:] if overlap > 0 else []
                    current_chunk = overlap_words
                    current_length = sum(len(w) + 1 for w in current_chunk)
            
            if current_chunk:
                chunks.append(" ".join(current_chunk))
        else:
            chunks.append(section)
    
    return chunks


def embed_and_store(data: dict) -> bool:
    """FastAPI를 통해 임베딩 생성 및 저장"""
    try:
        response = httpx.post(
            f"{FASTAPI_URL}/embed",
            json={
                "content": data["content"],
                "personal_color": data.get("personal_color"),
                "occasion": data.get("occasion"),
                "metadata": data.get("metadata", {})
            },
            headers={"X-Internal-API-Key": INTERNAL_API_KEY},
            timeout=30.0
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"  ✓ Embedded with ID: {result['data']['id']}")
            return True
        else:
            print(f"  ✗ Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"  ✗ Exception: {e}")
        return False


def main():
    """메인 함수"""
    print("=" * 50)
    print("패션 지식 임베딩 시작")
    print("=" * 50)
    
    # knowledge_base 디렉토리의 모든 마크다운 파일 찾기
    base_path = Path(__file__).parent
    md_files = glob.glob(str(base_path / "**/*.md"), recursive=True)
    
    print(f"\n발견된 파일 수: {len(md_files)}\n")
    
    success_count = 0
    error_count = 0
    
    for filepath in md_files:
        print(f"\n처리 중: {filepath}")
        
        # 파일 읽기
        data = read_markdown_file(filepath)
        
        # 청킹
        chunks = chunk_content(data["content"])
        print(f"  청크 수: {len(chunks)}")
        
        # 각 청크 임베딩
        for i, chunk in enumerate(chunks):
            chunk_data = {
                "content": chunk,
                "personal_color": data["personal_color"],
                "occasion": data["occasion"],
                "metadata": {
                    **data["metadata"],
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
            }
            
            if embed_and_store(chunk_data):
                success_count += 1
            else:
                error_count += 1
    
    print("\n" + "=" * 50)
    print(f"임베딩 완료!")
    print(f"성공: {success_count}, 실패: {error_count}")
    print("=" * 50)


if __name__ == "__main__":
    main()
