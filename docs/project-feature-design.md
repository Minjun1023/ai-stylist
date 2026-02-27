# AI Stylist 프로젝트 설계 기능 목록 (현재 구현 기준)

작성 일시 기준: `backend`, `frontend`, `ai-service` 현재 코드 기준  

## 1. 프로젝트 개요

이 프로젝트는 다음 3개 컴포넌트로 구성됩니다.

- **frontend**: React + TypeScript
  - 사용자 인터페이스, 인증/세션 처리, 추천 페이지/채팅/캘린더 화면
- **backend**: Spring Boot (Java)
  - 인증/권한 처리, 사용자·프로필·퍼스널컬러·채팅·스타일 추천 요청 라우팅, 히스토리 관리, 프록시 API 제공
- **ai-service**: FastAPI (Python)
  - 스타일 추천, 채팅, 퍼스널컬러 진단(설문/이미지), 임베딩/검색(RAG) 처리

## 2. 인증/인가 흐름

- 로그인 방식
  - 이메일/비밀번호: `POST /api/auth/login`
  - OAuth2: `/oauth2/**`, `/login/oauth2/**` (스프링 시큐리티 핸들러 경유)
- JWT
  - 로그인 후 `Bearer` 토큰 사용
  - 프론트 인터셉터에서 `Authorization: Bearer <token>` 자동 첨부
- 공통 규칙
  - `localStorage.accessToken` 없으면 401 발생 시 `/login` 리다이렉트
  - `SecurityConfig`에서 공개 API는 허용, 그 외는 인증 필요
- 공개 API
  - `/api/auth/**`, `/api/style/recommend/guest`, `/api/style/home/guest`, `/api/assets/**`, `/api/health`, OAuth2 경로
- 인증 필요 API
  - 나머지 `/api/**` (회원, 채팅, 개인화 추천, 캘린더, 사용자 정보 등)

## 3. 사용자/프로필 도메인

### User 엔티티 확장 필드

- `gender`, `age_group`, `body_type`, `style_mood_preference`
- `personalColor` (문자열)
- 진행 상태 플래그
  - `personal_color_completed`
  - `chat_profile_completed`
  - `style_recommendation_completed`
  - `style_profile_completed`

### API

| 도메인 | 엔드포인트 | 설명 |
|---|---|---|
| 인증 | `GET /api/users/me` | 현재 사용자 정보 조회 |
| 사용자 | `PUT /api/users/me` | 프로필 업데이트 |
| 인증 | `POST /api/auth/signup` | 회원가입 |
| 인증 | `POST /api/auth/signup/verification` | 회원가입 인증 코드 발송 |
| 인증 | `POST /api/auth/signup/verification/confirm` | 코드 확인 |
| 인증 | `GET /api/auth/signup/check-nickname` | 닉네임 중복 확인 |
| 인증 | `POST /api/auth/login` | 로그인 |
| 인증 | `POST /api/auth/forgot-password` | 비밀번호 초기화 링크/코드 발송 |
| 인증 | `POST /api/auth/reset-password` | 비밀번호 재설정 |

## 4. 스타일 추천 도메인

- 공통 처리 흐름
  - 백엔드 `StyleService`가 사용자 맥락을 구성해 AI 서비스에 전달
  - AI 응답은 항목 정규화(`category`, `gender`, `purchase_url` 파싱 기반 `category` 보정 등)를 거쳐 반환
  - 회원 추천 성공 시 `style_recommendation_completed` true 처리
  - 추천 기록은 메모리 기반 `StyleRecommendationHistoryService`에 사용자 단위로 저장

### 백엔드 API

| 엔드포인트 | 인증 | 입력 | 비고 |
|---|---|---|---|
| `POST /api/style/recommend` | 필요 | `query`, `occasion?`, `gender?` | 회원용. `gender` 미입력 시 사용자 프로필의 `gender` 사용 |
| `POST /api/style/recommend/guest` | 불필요 | `query`, `occasion?`, `gender` | 비로그인용. `/api/style/recommend/guest`를 기본 사용 |
| `POST /api/style/home` | 필요 | `query`, `occasion?` | 홈 추천(회원용, `style` 카드 생성을 위한 세트 형태) |
| `POST /api/style/home/guest` | 불필요 | `query`, `occasion?` | 홈 추천(비로그인용) |
| `GET /api/style/recommendations?limit=` | 필요 | `limit`(기본 10) | 최근 추천 목록 조회 |

### AI 서비스 라우트(`/ai-service`)

- `POST /style/recommend`
- `POST /style/recommend/guest`
- `POST /style/home`
- `POST /style/home/guest`
- RAG + DB/샘플 상품 조회 + 성별 필터 보정 기반으로 추천 아이템 구성

## 5. 채팅 도메인

- 대화형 추천/컨텍스트 축적
- 채팅 세션 단위 조회/생성/삭제
- AI 응답에서 추론된 프로필(`inferred_profile`)을 사용자 데이터에 반영 가능
- 채팅 완료 시 사용자 `chat_profile_completed` 가 true로 반영

### API

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/chat/sessions` | 사용자 채팅 세션 목록 |
| `GET /api/chat/sessions/{sessionId}` | 채팅 세션 상세 조회 |
| `POST /api/chat` | 메시지 전송 |
| `DELETE /api/chat/sessions/{sessionId}` | 채팅 세션 삭제 |

### AI 서비스 라우트

- `POST /chat`
- 메시지 기반 응답 + 프로필 추정 규칙 + RAG 기반 컨텍스트 사용

## 6. 퍼스널컬러 도메인

- 설문/이미지 기반 퍼스널컬러 진단 지원
- 결과 저장 및 사용자 프로필 반영
- 완료 플래그(`personal_color_completed`)로 단계 반영

### API

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/personal-color/results` | 보유한 결과 목록 조회 |
| `POST /api/personal-color/survey` | 설문 기반 진단 |
| `POST /api/personal-color/image` | 이미지 기반 진단 |

### AI 서비스 라우트

- `POST /analyze/personal-color/survey`
- `POST /analyze/personal-color/image`
- `POST /analyze/personal-color/upload-and-analyze`

## 7. 캘린더 도메인

- 월별/일별 코디 관리(이미지 업로드/삭제 포함)
- 월별 일정 조회, 일별 일정 조회, 일정 생성/삭제
- 일정/코디는 사용자 단위로 분리 관리

### API

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/calendar/outfits` | 월별 코디 목록 |
| `GET /api/calendar/outfits/{date}` | 일별 코디 |
| `POST /api/calendar/outfits/{date}` | 코디 이미지 업로드 저장 |
| `DELETE /api/calendar/outfits/{date}` | 코디 삭제 |
| `GET /api/calendar/schedules` | 월별 일정 |
| `GET /api/calendar/schedules/{date}` | 일별 일정 |
| `GET /api/calendar/schedules/upcoming` | 다가오는 일정 |
| `POST /api/calendar/schedules/{date}` | 일정 생성 |
| `DELETE /api/calendar/schedules/{scheduleId}` | 일정 삭제 |

## 8. 자산/외부 리소스 처리

- `/api/assets/image`  
  - 이미지 프록시. 외부 상품 이미지 URL 후보를 순차 시도해 안정적으로 바이트 반환  
  - Musinsa 대상 referer/헤더 처리 포함
- `/api/assets/price`  
  - 상품 페이지에서 실시간 가격 추출
  - 실패 시 `success:false` 반환(프론트에서 fallback 동작)

## 9. 운영/기반 기능

- `GET /api/health` (스프링 테스트용 상태 조회)
- 이메일/비밀번호 초기화 토큰 저장: Redis(`StringRedisTemplate`)
- 공통 응답 포맷: `ApiResponse<T>`(성공/실패 메시지 구조)
- 전역 예외 처리: `GlobalExceptionHandler`
- CORS: `http://localhost:3000` 허용

## 10. 프론트 라우팅/기능 맵 (현재)

### 라우트

- 퍼블릭
  - `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/oauth2/callback`, `/social-signup`
- 인증 후
  - `/` (홈), `/calendar`, `/personal-color`, `/chat`, `/style/recommend`, `/style/recommendations`, `/profile`, `/catalog/products/:sku`
- 별칭
  - `/style` → `/style/recommend` 리다이렉트

### 프론트 API 연동(핵심)

- 스타일: `frontend/src/api/style.ts` (`recommend`, `recommendGuest`, `recommendHome`, `recommendGuestHome`, `getSavedRecommendations`)
- 채팅: `frontend/src/api/chat.ts`
- 퍼스널컬러: `frontend/src/api/personalColor.ts`
- 인증/프로필: `frontend/src/api/auth.ts`
- 캘린더: `frontend/src/api/calendar.ts`

## 11. 현재 설계/구현 주의사항

- 스타일 히스토리(`StyleRecommendationHistoryService`)는 DB가 아닌 메모리 큐로 보관됨(재시작 시 소실 가능).
- 추천 품질은 AI 프롬프트 + RAG 검색 + 상품 정규화 규칙(카테고리/성별 추정 + 중복 제거)에 의해 결정됨.
- AI 서비스는 벡터 임베딩 경로(`/embed`)와 상품 검색 경로를 함께 보유하고 있으며, 현재 동작 정책은 저장된 지식/상품 데이터 기반이다.
