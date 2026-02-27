# Backend 추천 흐름 통합 검증 체크리스트

## 목적
- 로그인/퍼스널컬러/채팅 상태가 바뀔 때
  - 백엔드 응답 상태값(`/api/users/me`, `/api/style/home`)에 즉시 반영되는지
  - 홈 추천 카드 데이터가 같은 입력 기준에서 즉시 갱신되는지
  - 검증한다.

## 사용 전제
- backend: `http://localhost:8080`
- user token: 로그인 API(`/api/auth/login`)로 획득
- `jq` 사용 권장

```bash
export BACKEND_URL=http://localhost:8080
export TOKEN='YOUR_ACCESS_TOKEN'

auth_get()   { curl -sS "$1" -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json'; }
auth_post()  { curl -sS -X POST "$1" -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' -d "$2"; }
print_user() { auth_get "${BACKEND_URL}/api/users/me" | jq '.data.styleProfileCompleted, .data.personalColorCompleted, .data.chatProfileCompleted, .data.styleRecommendationCompleted, .data.personalColor'; }
```

### 상태 플래그 정의
- `styleProfileCompleted`: 회원 필수 항목(성별/연령대/체형/분위기) 완료 여부
- `personalColorCompleted`: 퍼스널컬러 진단 완료 여부
- `chatProfileCompleted`: AI 채팅 1회 이상 수행 완료 여부
- `styleRecommendationCompleted`: 스타일 추천 수신 완료 여부

## API 점검 시나리오

### 0. 기본 점검(인증/권한)
1. **비로그인 접근 제어**
   - `GET /api/users/me` → `401`
   - `POST /api/style/home` → `401`
   - `POST /api/style/recommend` → `401`
   - `POST /api/style/recommend/guest` → `200`
   - `POST /api/style/home/guest` → `200`

2. **로그인 상태 확인**
   - `GET /api/users/me`
   - 응답 `success=true` 및 4개 플래그가 기대값인지 확인

```bash
auth_get "${BACKEND_URL}/api/users/me" | jq '.success, .data'
```

---

### 1. 로그인 + 퍼스널컬러 미완료 상태
- 준비 상태: `personalColorCompleted=false`

1. `GET /api/users/me`
2. `POST /api/style/home`
3. 응답에서 추천 셋/메시지 존재 여부 확인
4. 다시 `GET /api/users/me`에서 `styleRecommendationCompleted=true` 확인

```bash
auth_post "${BACKEND_URL}/api/style/home" '{"query":"홈 추천"}' | jq '{success:.success, recommendationLen:(.data.recommendation|length), sets:(.data.sets|length), sources:(.data.sources|length)}'
auth_get "${BACKEND_URL}/api/users/me" | jq '.data.personalColorCompleted, .data.styleRecommendationCompleted'
```

예상:
- `personalColorCompleted`는 `false`
- `styleRecommendationCompleted`는 `true`
- 홈 추천은 기본 정보 위주로 동작

---

### 2. 로그인 + 퍼스널컬러 완료 상태
- 준비 상태: `personalColorCompleted=true` + `personalColor` 값 존재

1. 퍼스널컬러 진단 완료 처리 (`POST /api/personal-color/survey`)
2. `GET /api/users/me`에서 플래그 및 값 확인
3. `POST /api/style/home` 재호출
4. 이전 호출 대비 추천 메시지/셋트 변화 확인

```bash
# 설문 답변 키/값은 실제 프롬프트 구성에 맞춰 조정
auth_post "${BACKEND_URL}/api/personal-color/survey" '{"answers":{"q1":"A","q2":"A","q3":"A"}}' | jq '.success, .data.personalColor'

print_user

auth_post "${BACKEND_URL}/api/style/home" '{"query":"홈 추천"}' | jq '{recommendation:(.data.recommendation[0:160]), sets:(.data.sets|length), sources:(.data.sources|length)}'
```

예상:
- `personalColorCompleted=true`
- `personalColor` 값이 저장됨
- 홈 추천 결과가 미완료 상태 대비 차별화

---

### 3. 로그인 + 채팅 미완료 상태
- 준비 상태: `chatProfileCompleted=false`

1. `GET /api/users/me`
2. `POST /api/style/home`
3. `/api/users/me`에서 채팅 플래그 미변경 확인

```bash
print_user

auth_post "${BACKEND_URL}/api/style/home" '{"query":"홈 추천"}' | jq '{recommendation:(.data.recommendation[0:160]), sets:(.data.sets|length)}'
print_user
```

예상:
- 채팅 미완료 상태에서 채팅 이력 기반 반영 항목 미포함
- 기본/퍼스널컬러 기반 추천은 유지

---

### 4. 로그인 + 채팅 완료 상태
- 준비 상태: 채팅 1회 이상 수행 완료(`chatProfileCompleted=true`)

1. `POST /api/chat` 1회 수행
2. `GET /api/users/me`에서 채팅 플래그 확인
3. `POST /api/style/home` 재호출
4. 기존 대비 추천 변화 확인

```bash
auth_post "${BACKEND_URL}/api/chat" '{"message":"데이트룩 추천해줘"}' | jq '.success'

print_user

auth_post "${BACKEND_URL}/api/style/home" '{"query":"홈 추천"}' | jq '{recommendation:(.data.recommendation[0:160]), sets:(.data.sets|length), sources:(.data.sources|length)}'
```

예상:
- `chatProfileCompleted=true`
- 채팅 기반 맥락 반영이 추가된 추천 텍스트/셋트

---

### 5. 종합 상태 점검(전단계 완료)
- 전제: `personalColorCompleted=true`, `chatProfileCompleted=true`, `styleRecommendationCompleted=true`

1. `GET /api/users/me`에서 플래그 일괄 확인
2. 동일 쿼리로 `POST /api/style/home` 재호출
3. 홈 카드 전송 데이터(`recommendation`, `sets`, `sources`)가 비어 있지 않은지 검증

```bash
print_user

auth_post "${BACKEND_URL}/api/style/home" '{"query":"오늘은 캐주얼한 루프탑 모임이 있어"}' | jq '.data'
```

예상:
- 홈 카드가 “추천 스타일이 아직 준비되지 않았습니다” 같은 기본 메시지로만 고정되지 않음
- `sets`가 최소 1개 이상 존재

## 통합 판단 기준(합격/불합격)
- [ ] `/api/users/me`에서 `styleProfileCompleted / personalColorCompleted / chatProfileCompleted / styleRecommendationCompleted` 반영이 즉시 확인됨
- [ ] 스타일 요청 후 `styleRecommendationCompleted`가 즉시 true로 전환됨
- [ ] 비로그인 API/로그인 API 접근 제어가 정확함
- [ ] `/api/style/home` 호출 시 `data.recommendation`, `data.sets`, `data.sources`가 일관되게 조회됨
- [ ] 완료 플래그 변경(개인정보, 퍼스널컬러, 채팅)이 추천 구성에 반영됨
- [ ] 상태 미완료/완료 조합별로 추천 출력 차이가 관측됨

## 상태 조합 체크리스트(핵심)
- [ ] 미로그인 상태: `/api/style/home/guest`, `/api/style/recommend/guest`만 permitAll
- [ ] `styleProfileCompleted=false` 사용자: 성별/연령/체형/분위기 미반영 시도 없음
- [ ] 퍼스널컬러 미완료: `buildStageAwareQuery`에 `퍼스널컬러:미반영` 포함
- [ ] 퍼스널컬러 완료: `buildStageAwareQuery`에 `퍼스널컬러:<값>` 포함
- [ ] 채팅 미완료: 채팅 이력 반영 태그 미포함
- [ ] 채팅 완료: `채팅 이력 반영` 포함
- [ ] 홈 호출 직후 `/api/users/me`에서 해당 플래그 업데이트 확인

## 백엔드 확인 권장 로그 포인트
- `StyleService.buildStageAwareQuery`가 상태 태그를 붙이는지 로그 확인
- `PersonalColorService`, `ChatService`, `StyleService`에서 각 플래그 업데이트 시점 로그
- `StyleController` 호출 로그와 FastAPI 응답 상태 추적
