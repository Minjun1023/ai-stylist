#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=========================================="
echo "패션 지식 임베딩 시작"
echo "=========================================="

# 프로젝트 루트의 .env를 자동 로드 (있을 때만)
if [[ -f "${PROJECT_ROOT}/.env" ]]; then
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env"
fi

# 외부에서 지정하지 않았다면 로컬 기본값 사용
export FASTAPI_URL="${FASTAPI_URL:-http://localhost:8000}"

if [[ -z "${INTERNAL_API_KEY:-}" ]]; then
  echo "ERROR: INTERNAL_API_KEY가 설정되지 않았습니다."
  echo "힌트: .env에 INTERNAL_API_KEY를 넣거나 실행 시 환경변수로 전달하세요."
  exit 1
fi

export INTERNAL_API_KEY

echo "FASTAPI_URL=${FASTAPI_URL}"
echo "KNOWLEDGE_BASE_DIR=${SCRIPT_DIR}"

if python3 -c "import httpx" >/dev/null 2>&1; then
  echo "실행 모드: local python3"
  python3 "${SCRIPT_DIR}/embed_knowledge.py"
elif command -v docker >/dev/null 2>&1 && docker compose ps ai-service >/dev/null 2>&1; then
  echo "실행 모드: docker(ai-service) - 로컬 python 의존성이 없어 컨테이너에서 실행합니다."
  docker compose exec -T ai-service python /app/knowledge_base/embed_knowledge.py
else
  echo "ERROR: 로컬에 python 패키지(httpx)가 없고, ai-service 컨테이너도 사용할 수 없습니다."
  echo "해결 방법 1) 로컬 설치: pip3 install httpx"
  echo "해결 방법 2) docker compose up -d ai-service 후 다시 실행"
  exit 1
fi

echo
echo "=========================================="
echo "임베딩 완료!"
echo "=========================================="
