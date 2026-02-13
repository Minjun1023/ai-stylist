from app.models.personal_color import (
    PersonalColorType,
    PersonalColorAnalysisResponse,
    ColorPalette,
    SurveyAnalysisRequest
)
from app.services.openai_client import chat_completion, analyze_image_with_vision
import json

# 퍼스널 컬러별 팔레트 정보
COLOR_PALETTES = {
    # 봄 웜톤
    PersonalColorType.SPRING_WARM: ColorPalette(
        primary_colors=["코랄", "피치", "아이보리", "밝은 오렌지"],
        secondary_colors=["카멜", "연두", "터콰이즈", "살몬핑크"],
        avoid_colors=["검정", "회색", "차가운 파랑", "버건디"]
    ),
    # 여름 쿨톤
    PersonalColorType.SUMMER_COOL: ColorPalette(
        primary_colors=["라벤더", "로즈핑크", "스카이블루", "민트"],
        secondary_colors=["그레이", "네이비", "소프트 화이트", "라일락"],
        avoid_colors=["오렌지", "머스타드", "카키", "강한 노랑"]
    ),
    # 가을 웜톤
    PersonalColorType.AUTUMN_WARM: ColorPalette(
        primary_colors=["테라코타", "머스타드", "올리브", "버건디"],
        secondary_colors=["카키", "브라운", "골드", "다크 오렌지"],
        avoid_colors=["파스텔톤", "네온", "쿨핑크", "밝은 파랑"]
    ),
    # 겨울 쿨톤
    PersonalColorType.WINTER_COOL: ColorPalette(
        primary_colors=["퓨어화이트", "블랙", "로얄블루", "와인"],
        secondary_colors=["실버", "에메랄드", "마젠타", "쿨레드"],
        avoid_colors=["베이지", "오렌지", "연한 파스텔", "브라운"]
    )
}

# 스타일링 팁
STYLING_TIPS = {
    # 봄 웜톤
    PersonalColorType.SPRING_WARM: [
        "밝고 화사한 색상의 옷을 선택하세요",
        "골드 계열 액세서리가 잘 어울려요",
        "메이크업은 코랄, 피치톤 립을 추천해요",
        "청청 패션보다는 따뜻한 베이지/아이보리 조합을 추천해요"
    ],
    # 여름 쿨톤
    PersonalColorType.SUMMER_COOL: [
        "소프트하고 차분한 색상이 어울려요",
        "실버 계열 액세서리를 추천해요",
        "메이크업은 로즈, 핑크톤 립이 어울려요",
        "전체적으로 부드럽고 우아한 느낌의 스타일링을 추천해요"
    ],
    # 가을 웜톤
    PersonalColorType.AUTUMN_WARM: [
        "깊고 따뜻한 어스톤 색상을 선택하세요",
        "골드, 브론즈 액세서리가 잘 어울려요",
        "메이크업은 브라운, 테라코타 립을 추천해요",
        "레이어드 스타일링으로 깊이감을 더하세요"
    ],
    # 겨울 쿨톤
    PersonalColorType.WINTER_COOL: [
        "선명하고 강렬한 색상이 어울려요",
        "실버, 플래티넘 액세서리를 추천해요",
        "메이크업은 와인, 레드, 핫핑크 립이 어울려요",
        "모노톤 스타일링으로 시크함을 연출하세요"
    ]
}

# 설문 기반 퍼스널 컬러 분석
def analyze_survey(request: SurveyAnalysisRequest) -> PersonalColorAnalysisResponse:
    """설문 기반 퍼스널 컬러 분석"""
    
    prompt = f"""
    다음 설문 답변을 분석하여 퍼스널 컬러를 진단해주세요.
    
    설문 답변:
    {json.dumps(request.answers, ensure_ascii=False)}
    
    다음 형식으로만 답변해주세요 (JSON):
    {{
        "color_type": "spring_warm" | "summer_cool" | "autumn_warm" | "winter_cool",
        "confidence": 0.0~1.0 사이의 신뢰도,
        "reason": "진단 근거 설명"
    }}
    """
    # 채팅 응답 생성
    response = chat_completion([
        {"role": "system", "content": "당신은 전문 퍼스널 컬러 진단사입니다."},
        {"role": "user", "content": prompt}
    ])
    
    try:
        # JSON 파싱
        result = json.loads(response)   # JSON 파싱
        color_type = PersonalColorType(result["color_type"]) # 퍼스널 컬러 타입
        confidence = float(result["confidence"]) # 신뢰도
        reason = result["reason"] # 진단 근거
    except (json.JSONDecodeError, KeyError, ValueError): # JSON 파싱 실패 시
        # 파싱 실패 시 기본값
        color_type = PersonalColorType.SPRING_WARM # 봄 웜톤
        confidence = 0.5 # 신뢰도
        reason = "분석 결과를 처리하는 중 오류가 발생했습니다." # 진단 근거
    
    # 퍼스널 컬러 분석 응답 생성
    return PersonalColorAnalysisResponse(
        color_type=color_type, # 퍼스널 컬러 타입
        confidence=confidence, # 신뢰도
        description=reason, # 진단 근거
        palette=COLOR_PALETTES[color_type], # 컬러 팔레트
        styling_tips=STYLING_TIPS[color_type] # 스타일링 팁
    )


# 이미지 기반 퍼스널 컬러 분석
def analyze_image(image_url: str) -> PersonalColorAnalysisResponse:
    """이미지 기반 퍼스널 컬러 분석 (GPT-4 Vision)"""
    
    # 프롬프트
    prompt = """
    이 얼굴 사진을 분석하여 퍼스널 컬러를 진단해주세요.
    
    분석할 요소:
    1. 피부톤 (웜톤/쿨톤, 밝기)
    2. 머리카락 색상
    3. 눈동자 색상
    4. 전체적인 피부의 언더톤
    
    다음 형식으로만 답변해주세요 (JSON):
    {
        "color_type": "spring_warm" | "summer_cool" | "autumn_warm" | "winter_cool",
        "confidence": 0.0~1.0 사이의 신뢰도,
        "analysis": {
            "skin_tone": "피부톤 분석 결과",
            "hair_color": "머리카락 색상 분석",
            "eye_color": "눈동자 색상 분석",
            "undertone": "언더톤 분석"
        },
        "reason": "종합적인 진단 근거"
    }
    """
    
    # 이미지 분석
    response = analyze_image_with_vision(image_url, prompt)
    
    try:
        # JSON 파싱 (코드블록 제거)
        response = response.replace("```json", "").replace("```", "").strip() # JSON 파싱 (코드블록 제거)
        result = json.loads(response) # JSON 파싱
        color_type = PersonalColorType(result["color_type"]) # 퍼스널 컬러 타입
        confidence = float(result["confidence"]) # 신뢰도
        reason = result["reason"] # 진단 근거
    except (json.JSONDecodeError, KeyError, ValueError) as e: # JSON 파싱 실패 시
        print(f"Parse error: {e}, response: {response}") # 오류 출력
        color_type = PersonalColorType.SPRING_WARM # 봄 웜톤
        confidence = 0.5 # 신뢰도
        reason = "이미지 분석 결과를 처리하는 중 오류가 발생했습니다." # 진단 근거
    
    # 퍼스널 컬러 분석 응답 생성
    return PersonalColorAnalysisResponse(
        color_type=color_type, # 퍼스널 컬러 타입
        confidence=confidence, # 신뢰도
        description=reason, # 진단 근거
        palette=COLOR_PALETTES[color_type], # 컬러 팔레트
        styling_tips=STYLING_TIPS[color_type] # 스타일링 팁
    )