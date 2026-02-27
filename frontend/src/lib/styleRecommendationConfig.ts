
export const RECOMMENDATION_SET_SIZE = 3;
export const MAX_HOME_SET_COUNT = 4;
export const MIN_HOME_SET_COUNT = 3;
export const MIN_HOME_GUEST_SET_COUNT = 3;
export const MIN_HOME_GUEST_ITEMS = MIN_HOME_GUEST_SET_COUNT * RECOMMENDATION_SET_SIZE;
export const MIN_HOME_RECOMMENDATION_ITEMS = MAX_HOME_SET_COUNT * RECOMMENDATION_SET_SIZE;
export const MIN_HOME_RECOMMENDATION_DISPLAY_ITEMS = RECOMMENDATION_SET_SIZE * 2;

export const STARTER_OCCASIONS = ['데일리', '출근', '주말', '데이트', '오피스', '여행'];

export type SeasonLabel = '봄' | '여름' | '가을' | '겨울';

export const DEFAULT_HOME_TAG = 'AI 추천';
export const DEFAULT_BRAND_LABEL = '브랜드 확인';
export const BRAND_LABEL_PREFIX = '브랜드';
export const DEFAULT_PRODUCT_TITLE_PREFIX = '추천 상품';
export const GENERIC_PRICE_LABEL = '가격 확인';
export const GUEST_PRICE_PREFIX = '가격';

export const PROFILE_LABELS = {
  gender: {
    male: '남성',
    female: '여성',
  } as Record<string, string>,
  ageGroup: {
    teens: '10대',
    twenties_early: '20대 초반',
    twenties_late: '20대 후반',
    thirties_early: '30대 초반',
    thirties_late: '30대 후반',
    forties_plus: '40대 이상',
  } as Record<string, string>,
  bodyType: {
    slim: '슬림형',
    standard: '보통형',
    curvy: '볼륨형',
    muscular: '근육형',
    plus: '플러스형',
  } as Record<string, string>,
  mood: {
    casual: '캐주얼',
    minimal: '미니멀',
    feminine: '페미닌',
    chic: '시크',
    street: '스트릿',
    classic: '클래식',
  } as Record<string, string>,
  defaultColorLabel: '퍼스널컬러 미진단',
  defaultProfileLabel: '기본 프로필',
  colorPrefix: '퍼스널컬러',
};

export const STYLE_CATEGORY_ORDER = ['top', 'bottom', 'shoes', 'outer', 'accessory', 'other'] as const;
export const REQUIRED_STYLE_SET_CATEGORIES = ['top', 'bottom', 'shoes'] as const;
export type RecommendationCategory = (typeof STYLE_CATEGORY_ORDER)[number];
export const GUEST_FALLBACK_SET_COUNT = 3;
export const RECOMMENDATION_TITLE_PREFIX = '코디 세트';
export const INITIAL_PICK_PRIORITIES: Array<Array<string>> = [['top', 'outer', 'other', 'bottom', 'shoes']];
export const SET_FILL_ORDER: RecommendationCategory[] = ['outer', 'other', 'top', 'bottom', 'shoes'];
export const FALLBACK_ORDER: RecommendationCategory[] = ['top', 'bottom', 'shoes'];

export const QUERY_DEFAULT_COUNT = 15;
export const QUERY_REQUIRED_CATEGORIES_NOTE = '반드시 상의/하의/신발이 포함된 코디 세트가 되게 구성해줘.';
export const QUERY_GENDER_RULES = {
  male: '남성 기준으로만 추천하고 여성 전용 아이템은 제외해줘.',
  female: '여성 기준으로만 추천해줘.',
  default: '사용자 프로필 기준으로 추천해줘.',
};

export const MIN_DESCRIPTION_LENGTH = 8;
export const DESCRIPTION_FILTER_KEYWORDS = ['코디', '가격 확인'];
export const REPEATABLE_COORDI_PATTERN = /코디\s*코디/i;
export const FALLBACK_DESCRIPTION_PREFIX = 'AI 추천 결과';

export const INVALID_SOURCE_LABELS = ['자료 출처', '참고자료', '참고 자료', 'source'];
export const MISSING_DESCRIPTION = '상품 정보가 준비 중입니다.';

export const BRAND_INVALID_VALUES = new Set([
  '브랜드',
  '브랜드a',
  '브랜드b',
  '브랜드c',
  'brand',
  'branda',
  'brandb',
  'brandc',
]);

export const PLACEHOLDER_IMAGE_MARKERS = [
  'via.placeholder.com',
  'placeholder.com',
  'dummyimage.com',
];

export const CATEGORY_ALIAS = {
  top: 'top',
  상의: 'top',
  bottom: 'bottom',
  하의: 'bottom',
  pants: 'bottom',
  팬츠: 'bottom',
  bottoms: 'bottom',
  바지: 'bottom',
  치마: 'bottom',
  스커트: 'bottom',
  '하의/치마': 'bottom',
  하의스커트: 'bottom',
  shoes: 'shoes',
  신발: 'shoes',
  sneakers: 'shoes',
  스니커즈: 'shoes',
  운동화: 'shoes',
  부츠: 'shoes',
  boots: 'shoes',
  sneaker: 'shoes',
  outer: 'outer',
  아우터: 'outer',
  상의아우터: 'outer',
  outerwear: 'outer',
  outerwears: 'outer',
  재킷: 'outer',
  자켓: 'outer',
  코트: 'outer',
  점퍼: 'outer',
  블레이저: 'outer',
  패딩: 'outer',
  집업: 'outer',
  jacket: 'outer',
  coat: 'outer',
  accessory: 'accessory',
  악세서리: 'accessory',
  액세서리: 'accessory',
  기타: 'other',
  other: 'other',
} as const;

export const PRODUCT_URL_PATTERN = /https?:\/\/(www\.)?musinsa\.com\/products\/\d+/i;
export const MESSAGES = {
  unknownDescriptionFallback: '상품 정보가 준비 중입니다.',
  unknownBrandLabel: '브랜드 확인',
  genericRecommendationPrefix: 'AI 추천 결과',
};
