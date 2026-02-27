from app.models.personal_color import (
    PersonalColorType,
    PersonalColorAnalysisResponse,
    ColorPalette,
    SurveyAnalysisRequest
)
from app.services.openai_client import analyze_image_with_vision
import json
import re
from typing import Dict


COLOR_PALETTES = {
    PersonalColorType.SPRING_WARM: ColorPalette(
        primary_colors=["코랄", "피치", "아이보리", "밝은 오렌지"],
        secondary_colors=["카멜", "연두", "터콰이즈", "살몬핑크"],
        avoid_colors=["검정", "회색", "차가운 파랑", "버건디"]
    ),
    PersonalColorType.SUMMER_COOL: ColorPalette(
        primary_colors=["라벤더", "로즈핑크", "스카이블루", "민트"],
        secondary_colors=["그레이", "네이비", "소프트 화이트", "라일락"],
        avoid_colors=["오렌지", "머스타드", "카키", "강한 노랑"]
    ),
    PersonalColorType.AUTUMN_WARM: ColorPalette(
        primary_colors=["테라코타", "머스타드", "올리브", "버건디"],
        secondary_colors=["카키", "브라운", "골드", "다크 오렌지"],
        avoid_colors=["파스텔톤", "네온", "쿨핑크", "밝은 파랑"]
    ),
    PersonalColorType.WINTER_COOL: ColorPalette(
        primary_colors=["퓨어화이트", "블랙", "로얄블루", "와인"],
        secondary_colors=["실버", "에메랄드", "마젠타", "쿨레드"],
        avoid_colors=["베이지", "오렌지", "연한 파스텔", "브라운"]
    )
}


STYLING_TIPS = {
    PersonalColorType.SPRING_WARM: [
        "밝고 화사한 색상의 옷을 선택하세요",
        "골드 계열 액세서리가 잘 어울려요",
        "메이크업은 코랄, 피치톤 립을 추천해요",
        "청청 패션보다는 따뜻한 베이지/아이보리 조합을 추천해요"
    ],
    PersonalColorType.SUMMER_COOL: [
        "소프트하고 차분한 색상이 어울려요",
        "실버 계열 액세서리를 추천해요",
        "메이크업은 로즈, 핑크톤 립이 어울려요",
        "전체적으로 부드럽고 우아한 느낌의 스타일링을 추천해요"
    ],
    PersonalColorType.AUTUMN_WARM: [
        "깊고 따뜻한 어스톤 색상을 선택하세요",
        "골드, 브론즈 액세서리가 잘 어울려요",
        "메이크업은 브라운, 테라코타 립을 추천해요",
        "레이어드 스타일링으로 깊이감을 더하세요"
    ],
    PersonalColorType.WINTER_COOL: [
        "선명하고 강렬한 색상이 어울려요",
        "실버, 플래티넘 액세서리를 추천해요",
        "메이크업은 와인, 레드, 핫핑크 립이 어울려요",
        "모노톤 스타일링으로 시크함을 연출하세요"
    ]
}


SURVEY_CONFIDENCE_MIN = 0.5
SURVEY_CONFIDENCE_MAX = 0.95
FOLLOW_UP_THRESHOLD = 0.68
FOLLOW_UP_GAP_THRESHOLD = 0.26
FOLLOW_UP_GAP_BONUS = 0.6
FOLLOW_UP_PENALTY_RATIO = 0.4
BASE_QUESTION_GAP = 1e-9
BASE_SURVEY_WEIGHT_MIN = 9.0

SURVEY_WEIGHTS = {
    "skin_tone": {
        "weight": 1.5,
        "question": "피부톤",
        "answers": {
            "밝은 편": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.8,
                PersonalColorType.AUTUMN_WARM: 0.6,
                PersonalColorType.WINTER_COOL: 0.7
            },
            "보통": {
                PersonalColorType.SPRING_WARM: 0.8,
                PersonalColorType.SUMMER_COOL: 0.8,
                PersonalColorType.AUTUMN_WARM: 0.8,
                PersonalColorType.WINTER_COOL: 0.7
            },
            "어두운 편": {
                PersonalColorType.SPRING_WARM: 0.3,
                PersonalColorType.SUMMER_COOL: 0.5,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "노란 기가 있음": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.3,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.3
            },
            "붉은 기가 있음": {
                PersonalColorType.SPRING_WARM: 0.6,
                PersonalColorType.SUMMER_COOL: 0.8,
                PersonalColorType.AUTUMN_WARM: 0.7,
                PersonalColorType.WINTER_COOL: 1.0
            }
        }
    },
    "vein_color": {
        "weight": 1.5,
        "question": "손목 혈관색",
        "answers": {
            "파란색/보라색": {
                PersonalColorType.SPRING_WARM: 0.1,
                PersonalColorType.SUMMER_COOL: 1.2,
                PersonalColorType.AUTUMN_WARM: 0.2,
                PersonalColorType.WINTER_COOL: 1.1
            },
            "초록색": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.2,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.2
            },
            "파랑과 초록 둘 다": {
                PersonalColorType.SPRING_WARM: 0.5,
                PersonalColorType.SUMMER_COOL: 0.5,
                PersonalColorType.AUTUMN_WARM: 0.5,
                PersonalColorType.WINTER_COOL: 0.5
            }
        }
    },
    "jewelry_preference": {
        "weight": 1.0,
        "question": "액세서리 선호",
        "answers": {
            "골드": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.2,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.2
            },
            "실버": {
                PersonalColorType.SPRING_WARM: 0.2,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.2,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "둘 다 비슷함": {
                PersonalColorType.SPRING_WARM: 0.5,
                PersonalColorType.SUMMER_COOL: 0.5,
                PersonalColorType.AUTUMN_WARM: 0.5,
                PersonalColorType.WINTER_COOL: 0.5
            }
        }
    },
    "best_color": {
        "weight": 1.0,
        "question": "좋아하는 색감",
        "answers": {
            "파스텔톤": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 0.8,
                PersonalColorType.AUTUMN_WARM: 0.5,
                PersonalColorType.WINTER_COOL: 0.7
            },
            "비비드한 원색": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 0.5,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "어스톤/뮤트톤": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 0.3,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.3
            },
            "딥한 색상": {
                PersonalColorType.SPRING_WARM: 0.2,
                PersonalColorType.SUMMER_COOL: 0.5,
                PersonalColorType.AUTUMN_WARM: 0.7,
                PersonalColorType.WINTER_COOL: 1.0
            }
        }
    },
    "tan_reaction": {
        "weight": 1.0,
        "question": "햇빛 반응",
        "answers": {
            "쉽게 타고 오래감": {
                PersonalColorType.SPRING_WARM: 0.4,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.5,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "쉽게 타지만 금방 돌아옴": {
                PersonalColorType.SPRING_WARM: 0.8,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 0.8,
                PersonalColorType.WINTER_COOL: 0.6
            },
            "잘 타지 않음": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.3,
                PersonalColorType.AUTUMN_WARM: 0.9,
                PersonalColorType.WINTER_COOL: 0.4
            },
            "붉어짐": {
                PersonalColorType.SPRING_WARM: 0.4,
                PersonalColorType.SUMMER_COOL: 0.8,
                PersonalColorType.AUTUMN_WARM: 0.4,
                PersonalColorType.WINTER_COOL: 0.9
            }
        }
    },
    "eye_color": {
        "weight": 1.0,
        "question": "눈동자 색상",
        "answers": {
            "짙은 갈색": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 0.3,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.3
            },
            "갈색": {
                PersonalColorType.SPRING_WARM: 0.5,
                PersonalColorType.SUMMER_COOL: 0.5,
                PersonalColorType.AUTUMN_WARM: 0.7,
                PersonalColorType.WINTER_COOL: 0.6
            },
            "헤이즐": {
                PersonalColorType.SPRING_WARM: 0.8,
                PersonalColorType.SUMMER_COOL: 0.7,
                PersonalColorType.AUTUMN_WARM: 0.7,
                PersonalColorType.WINTER_COOL: 0.5
            },
            "회색/푸른 눈": {
                PersonalColorType.SPRING_WARM: 0.2,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.2,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "검은색": {
                PersonalColorType.SPRING_WARM: 0.6,
                PersonalColorType.SUMMER_COOL: 0.5,
                PersonalColorType.AUTUMN_WARM: 0.8,
                PersonalColorType.WINTER_COOL: 0.6
            }
        }
    },
    "hair_color": {
        "weight": 1.5,
        "question": "모발 색상",
        "answers": {
            "매우 짙은 갈색/흑색": {
                PersonalColorType.SPRING_WARM: 0.1,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "진한 갈색": {
                PersonalColorType.SPRING_WARM: 0.6,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.8
            },
            "갈색": {
                PersonalColorType.SPRING_WARM: 0.8,
                PersonalColorType.SUMMER_COOL: 0.7,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.7
            },
            "밝은 갈색": {
                PersonalColorType.SPRING_WARM: 0.9,
                PersonalColorType.SUMMER_COOL: 0.9,
                PersonalColorType.AUTUMN_WARM: 0.6,
                PersonalColorType.WINTER_COOL: 0.8
            },
            "금발/붉은 계열": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.4,
                PersonalColorType.AUTUMN_WARM: 0.7,
                PersonalColorType.WINTER_COOL: 0.2
            },
            "염색색": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 0.7,
                PersonalColorType.AUTUMN_WARM: 0.7,
                PersonalColorType.WINTER_COOL: 0.7
            }
        }
    },
    "accessory_detail": {
        "weight": 1.0,
        "question": "스타일 포인트 선호",
        "answers": {
            "밝고 선명한 색감": {
                PersonalColorType.SPRING_WARM: 0.8,
                PersonalColorType.SUMMER_COOL: 0.8,
                PersonalColorType.AUTUMN_WARM: 0.5,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "차분하고 부드러운 톤": {
                PersonalColorType.SPRING_WARM: 0.5,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.6,
                PersonalColorType.WINTER_COOL: 0.7
            },
            "따뜻한 중간톤": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.2,
                PersonalColorType.AUTUMN_WARM: 0.9,
                PersonalColorType.WINTER_COOL: 0.2
            },
            "어두운 포인트 컬러": {
                PersonalColorType.SPRING_WARM: 0.4,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 0.8,
                PersonalColorType.WINTER_COOL: 0.8
            }
        }
    },
    "undertone_reaction": {
        "weight": 1.0,
        "question": "메이크업 반응",
        "answers": {
            "코랄, 피치, 오렌지": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.3,
                PersonalColorType.AUTUMN_WARM: 0.8,
                PersonalColorType.WINTER_COOL: 0.4
            },
            "핑크, 라일락, 베리": {
                PersonalColorType.SPRING_WARM: 0.3,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.2,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "올리브, 카키, 브라운": {
                PersonalColorType.SPRING_WARM: 0.5,
                PersonalColorType.SUMMER_COOL: 0.2,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.2
            },
            "푸른/보랏빛 계열": {
                PersonalColorType.SPRING_WARM: 0.1,
                PersonalColorType.SUMMER_COOL: 0.9,
                PersonalColorType.AUTUMN_WARM: 0.1,
                PersonalColorType.WINTER_COOL: 0.9
            }
        }
    },
    "fabric_preference": {
        "weight": 1.0,
        "question": "소재/컬러 선호",
        "answers": {
            "베이지·아이보리 톤": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.3,
                PersonalColorType.AUTUMN_WARM: 0.9,
                PersonalColorType.WINTER_COOL: 0.4
            },
            "민트·라벤더·파스텔톤": {
                PersonalColorType.SPRING_WARM: 0.5,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.2,
                PersonalColorType.WINTER_COOL: 0.7
            },
            "버건디·테라코타": {
                PersonalColorType.SPRING_WARM: 0.6,
                PersonalColorType.SUMMER_COOL: 0.2,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.6
            },
            "블랙·화이트·메탈릭 톤": {
                PersonalColorType.SPRING_WARM: 0.3,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 0.5,
                PersonalColorType.WINTER_COOL: 1.0
            }
        }
    },
    "followup_undertone": {
        "weight": 1.2,
        "question": "실내/실외 톤 반응",
        "answers": {
            "실내에서 더 고급스럽고 선명하게 보임": {
                PersonalColorType.SPRING_WARM: 0.8,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 0.8,
                PersonalColorType.WINTER_COOL: 0.6
            },
            "실외에서 더 잘 맞는다고 느낌": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 0.9,
                PersonalColorType.AUTUMN_WARM: 0.6,
                PersonalColorType.WINTER_COOL: 0.9
            },
            "환경에 따라 크게 안 바뀜": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 0.7,
                PersonalColorType.AUTUMN_WARM: 0.7,
                PersonalColorType.WINTER_COOL: 0.7
            }
        }
    },
    "followup_color_combo": {
        "weight": 1.2,
        "question": "현재 진단 색상",
        "answers": {
            "파스텔/소프트 계열이 가장 편안": {
                PersonalColorType.SPRING_WARM: 0.7,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.4,
                PersonalColorType.WINTER_COOL: 0.8
            },
            "비비드/선명한 계열이 가장 편안": {
                PersonalColorType.SPRING_WARM: 0.6,
                PersonalColorType.SUMMER_COOL: 0.5,
                PersonalColorType.AUTUMN_WARM: 0.6,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "딥/어스톤 계열이 가장 편안": {
                PersonalColorType.SPRING_WARM: 0.4,
                PersonalColorType.SUMMER_COOL: 0.2,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.4
            }
        }
    },
    "followup_accessory": {
        "weight": 1.2,
        "question": "메탈 악세사리 반응",
        "answers": {
            "골드 계열이 더 잘 어울려요": {
                PersonalColorType.SPRING_WARM: 1.0,
                PersonalColorType.SUMMER_COOL: 0.2,
                PersonalColorType.AUTUMN_WARM: 1.0,
                PersonalColorType.WINTER_COOL: 0.2
            },
            "실버 계열이 더 잘 어울려요": {
                PersonalColorType.SPRING_WARM: 0.2,
                PersonalColorType.SUMMER_COOL: 1.0,
                PersonalColorType.AUTUMN_WARM: 0.2,
                PersonalColorType.WINTER_COOL: 1.0
            },
            "둘 다 잘 맞는 편이에요": {
                PersonalColorType.SPRING_WARM: 0.6,
                PersonalColorType.SUMMER_COOL: 0.6,
                PersonalColorType.AUTUMN_WARM: 0.6,
                PersonalColorType.WINTER_COOL: 0.6
            }
        }
    }
}

FOLLOW_UP_QUESTIONS = [
    {
        "id": "followup_undertone",
        "question": "실내/실외에서의 톤 반응은?",
        "options": [
            "실내에서 더 고급스럽고 선명하게 보임",
            "실외에서 더 잘 맞는다고 느낌",
            "환경에 따라 크게 안 바뀜"
        ]
    },
    {
        "id": "followup_color_combo",
        "question": "옷 조합 중 가장 편안하게 느껴지는 조합은?",
        "options": [
            "파스텔/소프트 계열이 가장 편안",
            "비비드/선명한 계열이 가장 편안",
            "딥/어스톤 계열이 가장 편안"
        ]
    },
    {
        "id": "followup_accessory",
        "question": "메탈 액세서리 반응은?",
        "options": [
            "골드 계열이 더 잘 어울려요",
            "실버 계열이 더 잘 어울려요",
            "둘 다 잘 맞는 편이에요"
        ]
    },
]

def _normalize_color_type(value: str) -> PersonalColorType:
    """모델이 대소문자/공백/하이픈을 섞어 반환해도 enum으로 정규화"""
    if value is None:
        raise ValueError("color_type is missing")
    normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    return PersonalColorType(normalized)

def _normalize_confidence(value) -> float:
    """신뢰도 범위를 0.0~1.0으로 정규화"""
    score = float(value)
    if score > 1.0:
        score = score / 100.0
    return max(0.0, min(1.0, score))

def _extract_json_object(raw_text: str) -> dict:
    """모델 응답에서 JSON 객체만 안전하게 추출"""
    if not raw_text:
        raise ValueError("empty response")
    
    cleaned = str(raw_text).strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError("json object not found")

    return json.loads(match.group(0))


def _calculate_weighted_scores(answers: Dict[str, str]) -> tuple[dict, list, float, bool]:
    scores = {t: 0.0 for t in PersonalColorType}
    evidence: list[tuple[str, float]] = []
    total_possible = 0.0
    answered_weight_sum = 0.0

    for question_id, rule in SURVEY_WEIGHTS.items():
        if question_id not in answers:
            continue

        answer = answers.get(question_id)
        candidates = rule["answers"].get(answer)
        if candidates is None:
            continue

        weight = float(rule["weight"])
        total_possible += weight * 1.5
        answered_weight_sum += weight

        sorted_candidates = sorted(
            candidates.items(),
            key=lambda item: item[1],
            reverse=True
        )
        top = sorted_candidates[0]
        second = sorted_candidates[1]
        evidence.append(
            (
                f"{rule['question']}에서 '{answer}' 선택 → {top[0].value.replace('_', ' ')} 우세 "
                f"(+{top[1] * weight:.1f}) / 차선 '{second[0].value.replace('_', ' ')}' (+{second[1] * weight:.1f})",
                (top[1] - second[1]) * weight
            )
        )

        for color_type, score in candidates.items():
            scores[color_type] += score * weight

    if not answered_weight_sum:
        return scores, [], 0.0, False

    sorted_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    sorted_evidence = sorted(evidence, key=lambda item: item[1], reverse=True)
    top_type, top_score = sorted_scores[0]
    second_score = sorted_scores[1][1] if len(sorted_scores) > 1 else 0.0

    score_ratio = top_score / (total_possible + BASE_QUESTION_GAP)
    gap_ratio = (top_score - second_score) / (total_possible + BASE_QUESTION_GAP)
    confidence = max(
        SURVEY_CONFIDENCE_MIN,
        min(
            SURVEY_CONFIDENCE_MAX,
            FOLLOW_UP_GAP_BONUS * score_ratio + FOLLOW_UP_PENALTY_RATIO * gap_ratio
        )
    )

    has_followup_answers = any(
        key.startswith("followup_") for key in answers.keys()
    )
    has_sufficient_base_answers = answered_weight_sum >= BASE_SURVEY_WEIGHT_MIN
    needs_follow_up = (
        (not has_followup_answers)
        and has_sufficient_base_answers
        and (confidence < FOLLOW_UP_THRESHOLD or gap_ratio < FOLLOW_UP_GAP_THRESHOLD)
    )

    evidence_only = [item[0] for item in sorted_evidence]
    return scores, evidence_only, float(confidence), bool(needs_follow_up)


def _build_description(top_type: PersonalColorType, evidence: list[str], needs_follow_up: bool) -> str:
    if needs_follow_up:
        return "현재 설문점수 분포가 유사해 톤군을 보수적으로 판정하기 어려워 추가 질문으로 보완합니다."
    key_evidence = " / ".join(evidence[:2]) if evidence else "표준 설문 근거 기반 판단"
    return f"가중치 기반 주요 근거: {key_evidence}"


def _top_evidence(evidence: list[str], limit: int = 2) -> list[str]:
    return evidence[:limit]

def analyze_survey(request: SurveyAnalysisRequest) -> PersonalColorAnalysisResponse:
    """설문 기반 퍼스널 컬러 분석"""
    answers = request.answers
    scores, evidence, confidence, needs_follow_up = _calculate_weighted_scores(answers)
    sorted_scores = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    color_type = sorted_scores[0][0] if sorted_scores else PersonalColorType.SPRING_WARM
    return PersonalColorAnalysisResponse(
        color_type=color_type,
        confidence=confidence,
        description=_build_description(color_type, evidence, needs_follow_up),
        evidence=_top_evidence(evidence),
        needs_follow_up=needs_follow_up,
        follow_up_questions=FOLLOW_UP_QUESTIONS if needs_follow_up else None,
        palette=COLOR_PALETTES[color_type],
        styling_tips=STYLING_TIPS[color_type]
    )


def analyze_image(image_url: str) -> PersonalColorAnalysisResponse:
    """이미지 기반 퍼스널 컬러 분석 (GPT-4 Vision)"""

    prompt = """
    이 얼굴 사진을 분석하여 퍼스널 컬러를 진단해주세요.

    분석할 요소:
    1. 피부톤 (웜톤/쿨톤, 밝기)
    2. 머리카락 색상
    3. 눈동자 색상
    4. 전체적인 피부의 언더톤

    반드시 아래 JSON 객체만 반환하세요. 설명 문장, 코드블록, 사과문은 절대 포함하지 마세요.
    얼굴이 불명확해도 가능한 범위에서 가장 가능성 높은 퍼스널 컬러를 추정해 JSON으로 반환하세요.
    다음 형식(JSON):
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

    response = analyze_image_with_vision(image_url, prompt, json_mode=True)
    try:
        result = _extract_json_object(response)
        color_type = _normalize_color_type(result.get("color_type"))
        confidence = _normalize_confidence(result.get("confidence", 0.5))
        reason = str(result.get("reason", "")).strip()
        if not reason:
            analysis = result.get("analysis", {})
            if isinstance(analysis, dict):
                fragments = []
                for field in ("skin_tone", "hair_color", "eye_color", "undertone"):
                    value = str(analysis.get(field, "")).strip()
                    if value:
                        fragments.append(value)
                reason = " ".join(fragments).strip()

        if not reason:
            reason = "이미지 분석 근거를 생성하지 못했습니다."
    except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
        print(f"Parse error: {e}, response: {response}")
        color_type = PersonalColorType.SPRING_WARM
        confidence = 0.5
        fallback_reason = str(response).replace("```json", "").replace("```", "").strip()
        reason = fallback_reason if fallback_reason else "이미지 분석 결과를 처리하는 중 오류가 발생했습니다."
    return PersonalColorAnalysisResponse(
        color_type=color_type,
        confidence=confidence,
        description=reason,
        palette=COLOR_PALETTES[color_type],
        styling_tips=STYLING_TIPS[color_type]
    )
