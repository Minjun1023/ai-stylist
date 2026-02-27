
import { RecommendationProduct as DomainRecommendationProduct } from '../types';

export type RecommendationProduct = DomainRecommendationProduct & {
  id: string;
  title: string;
  imageUrl: string;
  purchaseUrl: string;
};

interface StoredRecommendationProduct extends RecommendationProduct {
  sourceType: RecommendationSource;
  sourceDate: string;
  createdAt: string;
}

interface RecommendationStore {
  [sourceType: string]: {
    [date: string]: StoredRecommendationProduct[];
  };
}

const STORAGE_KEY = 'aistylist-home-recommendations-v8';
const LEGACY_STORAGE_KEY = 'aistylist-home-recommendations';
export const GUEST_STYLE_RECOMMEND_READY_KEY = 'aistylist-guest-style-ready-v1';
const GUEST_STYLE_RECOMMEND_GENDER_KEY = 'aistylist-guest-style-gender-v1';
const STORAGE_KEY_PREFIX = `${STORAGE_KEY}:`;
const SESSION_GUEST_STYLE_RECOMMEND_KEY = 'aistylist-guest-style-recommend-session-v1';

const getReadyStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

export const markGuestStyleRecommendationReady = () => {
  const storage = getReadyStorage();
  if (!storage) {
    return;
  }

  storage.setItem(GUEST_STYLE_RECOMMEND_READY_KEY, new Date().toISOString());
};

export const hasGuestStyleRecommendationReady = () =>
  Boolean(getReadyStorage()?.getItem(GUEST_STYLE_RECOMMEND_READY_KEY));

const getSessionStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
};

export const hasActiveGuestStyleRecommendationSession = () => {
  const storage = getSessionStorage();
  if (!storage) {
    return false;
  }

  if (Boolean(storage.getItem(SESSION_GUEST_STYLE_RECOMMEND_KEY))) {
    return true;
  }

  try {
    return getRecommendationProducts('style', 1, 'guest').length > 0;
  } catch {
    return false;
  }
};

export const clearGuestStyleRecommendationSession = () => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(SESSION_GUEST_STYLE_RECOMMEND_KEY);
};

export const ensureGuestStyleRecommendationSession = () => {
  const storage = getSessionStorage();
  if (!storage) {
    return false;
  }

  if (storage.getItem(SESSION_GUEST_STYLE_RECOMMEND_KEY)) {
    return true;
  }

  storage.setItem(SESSION_GUEST_STYLE_RECOMMEND_KEY, new Date().toISOString());
  return false;
};

export const clearGuestStyleRecommendationReady = () => {
  const storage = getReadyStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(GUEST_STYLE_RECOMMEND_READY_KEY);
};

export const saveGuestStyleRecommendationGender = (gender: 'male' | 'female' | undefined) => {
  const storage = getReadyStorage();
  if (!storage) {
    return;
  }

  if (!gender) {
    storage.removeItem(GUEST_STYLE_RECOMMEND_GENDER_KEY);
    return;
  }

  storage.setItem(GUEST_STYLE_RECOMMEND_GENDER_KEY, gender);
};

export const getGuestStyleRecommendationGender = () => {
  return getReadyStorage()?.getItem(GUEST_STYLE_RECOMMEND_GENDER_KEY) as 'male' | 'female' | null;
};

export const clearGuestStyleRecommendationGender = () => {
  const storage = getReadyStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(GUEST_STYLE_RECOMMEND_GENDER_KEY);
};

const isRecommendationStoreKey = (key: string) => {
  return key === LEGACY_STORAGE_KEY || key === STORAGE_KEY || key.startsWith(STORAGE_KEY_PREFIX);
};

const clearStoreStyleSourceFromStoragePayload = (raw: string) => {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  if (!('style' in parsed) || Object.keys(parsed).length === 1) {
    return null;
  }

  const nextStore = { ...(parsed as Record<string, unknown>) };
  delete nextStore.style;
  return JSON.stringify(nextStore);
};

export const clearGuestStyleRecommendationCache = () => {
  const storage = getReadyStorage();
  if (!storage) {
    return;
  }

  const allKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => Boolean(key && isRecommendationStoreKey(key)),
  );

  allKeys.forEach((key) => {
    if (!isRecommendationStoreKey(key)) {
      return;
    }

    if (key === `${STORAGE_KEY}:guest` || key === LEGACY_STORAGE_KEY) {
      storage.removeItem(key);
      return;
    }

    if (key === `${STORAGE_KEY}:global`) {
      try {
        const current = storage.getItem(key);
        if (!current) {
          storage.removeItem(key);
          return;
        }

        const next = clearStoreStyleSourceFromStoragePayload(current);
        if (!next) {
          storage.removeItem(key);
          return;
        }
        storage.setItem(key, next);
      } catch {
        storage.removeItem(key);
      }
      return;
    }

    storage.removeItem(key);
  });

  storage.removeItem(GUEST_STYLE_RECOMMEND_READY_KEY);
  storage.removeItem(GUEST_STYLE_RECOMMEND_GENDER_KEY);
};

export type RecommendationSource = 'style' | 'chat' | 'calendar' | 'personal-color' | 'unknown';

const stripTrailingPunctuation = (value: string) =>
  value.replace(/[)\]]+$/g, '').trim();

const isImageUrl = (url: string) =>
  /(jpg|jpeg|png|webp|gif|avif|bmp)(\?.*)?$/i.test(url);

const normalizeImageUrl = (value?: string) => {
  const raw = (value || '').trim();
  if (!raw) {
    return '';
  }
  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }
  return raw;
};

const isPlaceholderUrl = (url: string) => {
  const normalized = url.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (normalized === 'https:') {
    return true;
  }

  if (normalized.includes('example.com') || normalized.includes('example.org')) {
    return true;
  }

  if (
    normalized.includes('images.unsplash.com') ||
    normalized.includes('unsplash.com') ||
    normalized.includes('via.placeholder.com') ||
    normalized.includes('placeholder.com') ||
    normalized.includes('dummyimage.com')
  ) {
    return true;
  }

  return false;
};

const isInternalCatalogUrl = (url: string) =>
  /^\/catalog\/products\/[a-z0-9\-_]+/i.test(url) ||
  /^https?:\/\/localhost:3000\/catalog\/products\/[a-z0-9\-_]+/i.test(url);

const isProductUrl = (url: string) =>
  isInternalCatalogUrl(url) ||
  /^https?:\/\/(www\.)?musinsa\.com\/(products|app\/goods)\//i.test(url);
const isMusinsaUrl = (url: string) => {
  if (isInternalCatalogUrl(url)) {
    return true;
  }
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'musinsa.com' || hostname.endsWith('.musinsa.com');
  } catch {
    return false;
  }
};

const PLACEHOLDER_BRAND_VALUES = new Set([
  '브랜드',
  '브랜드a',
  '브랜드b',
  '브랜드c',
  'brand',
  'branda',
  'brandb',
  'brandc',
]);

const BRAND_CANONICAL_MAP: Record<string, string> = {
  nike: '나이키',
  adidas: '아디다스',
  gucci: '구찌',
  prada: '프라다',
  zara: '자라',
  uniqlo: '유니클로',
  hm: 'H&M',
  'h&m': 'H&M',
  musinsa: '무신사',
  '무신사': '무신사',
};

const normalizeBrandToken = (value: string) =>
  value.replace(/[^\w가-힣]+/g, '').toLowerCase().trim();

const normalizeToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w가-힣]+/g, '')
    .trim();

const isInvalidBrand = (value?: string) => {
  if (!value) {
    return true;
  }

  const normalized = normalizeToken(value);
  if (!normalized) {
    return true;
  }

  if (PLACEHOLDER_BRAND_VALUES.has(normalized)) {
    return true;
  }

  if (normalized.startsWith('브랜드') && normalized.length <= 5) {
    return true;
  }

  if (normalized.startsWith('brand') && normalized.length <= 8) {
    return true;
  }

  return false;
};

const PRODUCT_HINT_RE =
  /(코트|니트|스웨터|팬츠|슬랙스|바지|부츠|슈즈|신발|자켓|재킷|원피스|스커트|셔츠|가디건|블라우스|맨투맨|후드|coat|sweater|pants|slacks|boots|shoes|jacket|dress|skirt|shirt|cardigan|blouse|hoodie)/i;

const inferBrandFromTitle = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .replace(/\*+/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const segments = cleaned
    .split(/[|\-_·/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const tokenQueue: string[] = [];
  segments.forEach((segment) => {
    const withoutSpecial = segment.replace(/[^\w가-힣\s]/g, ' ');
    const tokens = withoutSpecial
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (segment.trim()) {
      tokenQueue.push(segment.trim());
    }
    tokenQueue.push(...tokens);
  });

  for (const token of tokenQueue) {
    if (PRODUCT_HINT_RE.test(token)) {
      continue;
    }
    const resolved = resolveDisplayBrand(token);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

export const canonicalizeBrandName = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const normalized = normalizeBrandToken(value);
  if (!normalized) {
    return undefined;
  }
  if (BRAND_CANONICAL_MAP[normalized]) {
    return BRAND_CANONICAL_MAP[normalized];
  }

  const tokens = value
    .split(/[\s|/\-_.()]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const tokenNormalized = normalizeBrandToken(token);
    if (!tokenNormalized) {
      continue;
    }
    if (BRAND_CANONICAL_MAP[tokenNormalized]) {
      return BRAND_CANONICAL_MAP[tokenNormalized];
    }
  }

  return BRAND_CANONICAL_MAP[normalized] || value.trim();
};

export const resolveDisplayBrand = (value?: string) => {
  const normalizedBrand = canonicalizeBrandName(value);
  if (!normalizedBrand || isInvalidBrand(normalizedBrand)) {
    return undefined;
  }
  return normalizedBrand;
};

const isPlaceholderBrandToken = (token: string) => {
  const normalized = normalizeToken(token);
  if (!normalized) {
    return false;
  }
  if (PLACEHOLDER_BRAND_VALUES.has(normalized)) {
    return true;
  }
  if (normalized.startsWith('브랜드') && normalized.length <= 5) {
    return true;
  }
  if (normalized.startsWith('brand') && normalized.length <= 8) {
    return true;
  }
  return false;
};

const sanitizeShoppingKeyword = (query: string) => {
  const cleaned = query.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return '';
  }

  const tokens = cleaned.split(' ').filter(Boolean);
  const filtered = tokens.filter((token) => !isPlaceholderBrandToken(token));
  const source = filtered.length > 0 ? filtered : tokens;

  const seen = new Set<string>();
  const deduped = source.filter((token) => {
    const normalized = normalizeToken(token);
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });

  return deduped.slice(0, 6).join(' ').trim();
};

const SAMPLE_MUSINSA_PRODUCT_IDS = [
  '5206701',
  '1012143',
  '2778674',
  '4746813',
  '1841217',
  '1115974',
  '5114562',
  '2270183',
  '5973740',
  '1618207',
];

const toStableHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const toSampleProductUrl = (seedValue: string) => {
  const hash = toStableHash(seedValue || 'aistylist');
  const productId = SAMPLE_MUSINSA_PRODUCT_IDS[hash % SAMPLE_MUSINSA_PRODUCT_IDS.length];
  const itemSku = `item-${productId}`;
  const productUrl = `https://www.musinsa.com/products/${productId}`;
  const imageUrl = `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_500.jpg`;
  const params = new URLSearchParams({
    title: seedValue || '추천 아이템',
    brand: '',
    description: `${seedValue || '추천 아이템'} 추천 상품`,
    category: 'other',
    price: '',
    source: '상품 DB',
    legacy_product_id: productId,
    product_url: productUrl,
    image_url: imageUrl,
  });

  return `/catalog/products/${itemSku}?${params.toString()}`;
};

const toSampleImageUrl = (seedValue: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 960">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#E2E8F0"/>
          <stop offset="100%" stop-color="#CBD5E1"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <rect x="64" y="90" width="512" height="620" rx="24" fill="#ffffff" stroke="#94A3B8" stroke-opacity="0.35" stroke-width="3"/>
      <text x="320" y="240" text-anchor="middle" fill="#0F172A" font-size="36" font-family="Arial, sans-serif" font-weight="700">AI STYLIST</text>
      <text x="320" y="300" text-anchor="middle" fill="#334155" font-size="24" font-family="Arial, sans-serif">PRODUCT ITEM</text>
      <text x="320" y="360" text-anchor="middle" fill="#64748B" font-size="18" font-family="Arial, sans-serif">${(seedValue || 'item').slice(0, 24)}</text>
    </svg>`,
  )}`;

const toShoppingSearchUrl = (query: string) => {
  const keyword = sanitizeShoppingKeyword(query);
  if (!keyword) {
    return '';
  }
  return `https://search.musinsa.com/search/musinsa?query=${encodeURIComponent(keyword)}`;
};

export const resolvePreferredPurchaseUrl = (
  purchaseUrl?: string,
  title?: string,
  brand?: string,
) => {
  const normalized = (purchaseUrl || '').trim();
  if (isInternalCatalogUrl(normalized)) {
    return normalized;
  }
  if (normalized && isProductUrl(normalized) && !isImageUrl(normalized) && isMusinsaUrl(normalized)) {
    try {
      const parsed = new URL(normalized);
      const appGoodsMatch = parsed.pathname.match(/^\/app\/goods\/(\d+)/i);
      if (appGoodsMatch?.[1]) {
        return `https://www.musinsa.com/products/${appGoodsMatch[1]}`;
      }
      const productsMatch = parsed.pathname.match(/^\/products\/(\d+)/i);
      if (productsMatch?.[1]) {
        return `https://www.musinsa.com/products/${productsMatch[1]}`;
      }
      if (parsed.pathname.startsWith('/products/')) {
        return normalized;
      }
      const queryFromUrl = decodeURIComponent(parsed.searchParams.get('q') || parsed.searchParams.get('keyword') || '');
      const fromContext = `${brand || ''} ${title || ''}`.trim();
      return toSampleProductUrl(fromContext || queryFromUrl || normalized);
    } catch {
      return normalized;
    }
  }

  const keyword = `${brand || ''} ${title || ''}`.trim();
  return toSampleProductUrl(keyword || normalized || 'aistylist');
};

const cleanMarkdownToken = (value: string) =>
  value
    .replace(/\*/g, '')
    .replace(/[:：]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const resolveField = (
  item: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = (item as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const isEmptyDescription = (value?: string) => {
  if (!value) {
    return true;
  }

  const normalized = value.trim();
  if (!normalized) {
    return true;
  }

  return {
    '추천 아이템': true,
    상품: true,
    상품명: true,
    '상품 추천': true,
    '상품 정보': true,
    '상품 추천입니다.': true,
  }[normalized] || false;
};

const sanitizeRecommendationText = (value?: string) => {
  if (!value) {
    return undefined;
  }

  let cleaned = value
    .replace(/`/g, '')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return undefined;
  }

  cleaned = cleaned.replace(/가격대?\s*가격\s*확인/gi, '가격대');
  cleaned = cleaned.replace(/\b가격\s*확인\b/gi, '');

  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((token, index, all) => token !== all[index - 1]);
  const deduped = tokens.join(' ').trim();
  if (!deduped) {
    return undefined;
  }

  return deduped;
};

const sanitizeDescription = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const sanitized = sanitizeRecommendationText(value);
  if (!sanitized) {
    return undefined;
  }

  if (isEmptyDescription(sanitized)) {
    return undefined;
  }

  return sanitized;
};

const parseTagsFromValue = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0)
      .filter((entry, index, all) => index === all.findIndex((other) => other.toLowerCase() === entry.toLowerCase()));
  }

  if (typeof value !== 'string') {
    return [];
  }

  const raw = value.trim();
  if (!raw) {
    return [];
  }

  if ((raw.startsWith('[') && raw.endsWith(']')) || raw.includes(',')) {
    return raw
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((entry) => entry.trim().replace(/^["']|["']$/g, ''))
      .filter((entry) => entry.length > 0)
      .filter((entry, index, all) => index === all.findIndex((other) => other.toLowerCase() === entry.toLowerCase()));
  }

  return [raw];
};

const normalizeCategoryValue = (value?: string) => {
  if (!value) {
    return '';
  }
  return value
    .replace(/[\s\-_/.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const normalizeGenderValue = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'male' || normalized === 'female') {
    return normalized;
  }
  if (['남', '남성', 'man', 'men', 'male'].includes(normalized)) {
    return 'male';
  }
  if (['여', '여성', 'woman', 'women', 'female'].includes(normalized)) {
    return 'female';
  }
  return normalized;
};

const isLowQualityDescription = (value?: string, title = '', brand?: string) => {
  if (!value) {
    return true;
  }
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }
  const compact = normalized.replace(/\s+/g, '');
  if (compact.length < 10) {
    return true;
  }

  if (/가격대가격확인/.test(compact) || /가격\s*확인/.test(normalized)) {
    return true;
  }

  if (/(\S+)\s+\1/.test(normalized)) {
    return true;
  }

  if (isEmptyDescription(normalized)) {
    return true;
  }
  const normalizedTitle = stripTrailingPunctuation(normalizeToken(title));
  const normalizedBrand = stripTrailingPunctuation(normalizeToken(brand || ''));
  const normalizedValue = stripTrailingPunctuation(normalizeToken(normalized));
  if (!normalizedTitle) {
    return false;
  }
  if (!normalizedValue.includes(normalizedTitle)) {
    return true;
  }
  if (normalizedBrand && !normalizedValue.includes(normalizedBrand)) {
    return true;
  }
  return false;
};

const normalizeProduct = (item: Record<string, unknown>): RecommendationProduct | null => {
  const title = resolveField(item, [
    'title',
    'name',
    'productName',
    'product_name',
    'label',
    'itemName',
  ]);

  const normalizedTitle = sanitizeRecommendationText(title);
  if (!normalizedTitle) {
    return null;
  }

  const imageUrl =
    normalizeImageUrl(resolveField(item, ['imageUrl', 'image_url', 'image', 'thumbnail', 'picture', 'img'])) ||
    '';

  const purchaseUrl =
    resolveField(item, [
      'purchaseUrl',
      'purchase_url',
      'link',
      'url',
      'productUrl',
      'product_url',
    ]) ||
    '';

  const rawBrand = resolveField(item, [
    'brand',
    'brandName',
    'brand_name',
    'maker',
    'manufacturer',
    'vendor',
  ]);
  const parsedBrandFromTitle = (() => {
    const titleBased = resolveField(item, ['sourceBrand', 'seller']);
    if (!titleBased || isPlaceholderBrandToken(titleBased)) {
      return undefined;
    }
    return titleBased;
  })();
  const resolvedFromTitle = inferBrandFromTitle(
      rawBrand ||
      parsedBrandFromTitle ||
      (() => {
        const rawTitle = resolveField(item, ['title', 'name', 'label']);
        return rawTitle;
      })(),
  );
  const rawBrandCandidate = resolveDisplayBrand(rawBrand) || resolveDisplayBrand(parsedBrandFromTitle);
  const brand = rawBrandCandidate || resolvedFromTitle;
  const parsedCategory = normalizeCategoryValue(resolveField(item, ['category', 'itemCategory', 'item_category', 'type']));
  const tags = parseTagsFromValue((item as Record<string, unknown>).tags);
  const gender = normalizeGenderValue(resolveField(item, ['gender', 'sex', 'targetGender']));
  const price = resolveField(item, ['price', 'priceText', 'cost']);
  const priceRange = resolveField(item, ['priceRange', 'price_range', 'priceBand']);
  const rawDescription = resolveField(item, ['description', 'summary', 'reason']);
  const sanitizedDescription = sanitizeDescription(rawDescription);
  const description = isLowQualityDescription(
    sanitizedDescription,
    normalizedTitle,
    rawBrand || parsedBrandFromTitle || resolvedFromTitle,
  )
    ? undefined
    : sanitizedDescription;

  if (!title) {
    return null;
  }

  const sanitizedPurchaseUrl = purchaseUrl && !isPlaceholderUrl(purchaseUrl) ? purchaseUrl : '';
  const fallbackSeed = `${brand || ''} ${normalizedTitle}`.trim() || normalizedTitle;
  let effectivePurchaseUrl = resolvePreferredPurchaseUrl(
    sanitizedPurchaseUrl,
    title,
    brand,
  );
  if (!effectivePurchaseUrl || isImageUrl(effectivePurchaseUrl) || !isProductUrl(effectivePurchaseUrl)) {
    effectivePurchaseUrl = toSampleProductUrl(fallbackSeed);
  }

  const effectiveImageUrl = imageUrl && !isPlaceholderUrl(imageUrl)
    ? imageUrl
    : toSampleImageUrl(fallbackSeed);
  const fallbackDescription = `${brand ? `${brand}의 ` : ''}${normalizedTitle} 추천 아이템입니다.`;

  return {
    id: `${normalizedTitle}-${effectiveImageUrl}-${effectivePurchaseUrl}`,
    title: normalizedTitle,
    description: description || fallbackDescription,
    imageUrl: effectiveImageUrl,
    purchaseUrl: effectivePurchaseUrl,
    category: parsedCategory || undefined,
    tags,
    brand,
    price,
    priceRange,
    gender,
    source: resolveField(item, ['source', 'source_label']) || 'AI 추천',
  };
};

const parseItems = (items?: unknown[]): RecommendationProduct[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      return normalizeProduct(item as Record<string, unknown>);
    })
    .filter((item): item is RecommendationProduct => item !== null)
    .slice(0, 12);
};

const parseTextLines = (content: string): RecommendationProduct[] => {
  if (!content) {
    return [];
  }

  const lines = content.split('\n');
  const candidates: RecommendationProduct[] = [];
  const pushCandidate = (candidate: RecommendationProduct) => {
    if (!candidate.title || !candidate.purchaseUrl) {
      return;
    }
    candidates.push(candidate);
  };

  const fallbackToPlainLink = (line: string, purchaseUrl: string, title: string) => {
    const url = stripTrailingPunctuation(purchaseUrl);
    const maybeImage = line.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
    if (!title) {
      return;
    }

    pushCandidate({
      id: `${title}-${url}-${Date.now()}`,
      title,
      imageUrl: maybeImage?.[1] || '',
      purchaseUrl: url,
      source: '채팅/텍스트 추천',
    });
  };

  for (const line of lines) {
    const imageMatches = Array.from(line.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi));
    const linkMatches = Array.from(line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi));
    const rawUrlMatches = Array.from(line.matchAll(/https?:\/\/[^\s]+/gi));

    imageMatches.forEach((match, index) => {
      const imageUrl = stripTrailingPunctuation(match[1]);
      const title = imageUrl.includes('http') ? `추천 이미지 ${index + 1}` : `추천 아이템 ${index + 1}`;
      const purchaseUrl = rawUrlMatches.find((m) => m[0] !== imageUrl)?.[0];
      if (purchaseUrl && isProductUrl(purchaseUrl)) {
        pushCandidate({
          id: `${title}-${imageUrl}-${purchaseUrl}`,
          title,
          imageUrl: imageUrl || '',
          purchaseUrl: stripTrailingPunctuation(purchaseUrl),
          source: '채팅/텍스트 추천',
        });
      }
    });

    linkMatches.forEach((match) => {
      const title = stripTrailingPunctuation(match[1]);
      const purchaseUrl = stripTrailingPunctuation(match[2]);
      if (!isProductUrl(purchaseUrl) || isImageUrl(purchaseUrl)) {
        return;
      }

      const imageMatch = line.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
      const imageUrl = imageMatch ? stripTrailingPunctuation(imageMatch[1]) : '';
      pushCandidate({
        id: `${title}-${purchaseUrl}`,
        title,
        imageUrl: imageUrl || '',
        purchaseUrl,
        source: '채팅/텍스트 추천',
      });
    });

    const lineHasOnlyLinks = rawUrlMatches.length > 0 && linkMatches.length === 0;
    if (lineHasOnlyLinks) {
      rawUrlMatches.forEach((urlMatch) => {
        const purchaseUrl = stripTrailingPunctuation(urlMatch[0]);
        if (!isProductUrl(purchaseUrl) || isImageUrl(purchaseUrl)) {
          return;
        }
        const title = line.trim().replace(purchaseUrl, '').trim() || '추천 아이템';
        if (!title || title.length < 2) {
          return;
        }
        fallbackToPlainLink(line, purchaseUrl, title);
      });
    }

    const numberedLine = /^\s*(\d+\.|-)\s*/.test(line);
    if (!numberedLine) {
      continue;
    }

    const boldTokens = Array.from(line.matchAll(/\*\*(.+?)\*\*/g))
      .map((match) => cleanMarkdownToken(match[1]))
      .filter(Boolean);

    if (boldTokens.length === 0) {
      continue;
    }

    const productToken = boldTokens.find((token) => PRODUCT_HINT_RE.test(token));
    if (!productToken) {
      continue;
    }

    const brandToken = boldTokens.find(
      (token) =>
        token !== productToken &&
        !PRODUCT_HINT_RE.test(token) &&
        !isPlaceholderBrandToken(token) &&
        /[A-Za-z&()가-힣]/.test(token),
    );

    const brand = resolveDisplayBrand(
      brandToken ? cleanMarkdownToken(brandToken).replace(/의$/, '') : undefined,
    );
    const title = brand ? `${brand} ${productToken}` : productToken;
    const purchaseUrl = toShoppingSearchUrl(title);
    if (!purchaseUrl) {
      continue;
    }

    pushCandidate({
      id: `${title}-${purchaseUrl}`,
      title,
      imageUrl: '',
      purchaseUrl,
      source: '채팅/텍스트 추천',
      brand,
    });
  }

  return candidates.slice(0, 12);
};

const toStoreDate = (date = new Date()) => date.toISOString().split('T')[0];

const readStoreByKey = (storageKey: string): RecommendationStore | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(storageKey);
      return null;
    }

    return parsed as RecommendationStore;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
};

const resolveStorageKey = (scopeKey?: string | number) => {
  const normalizedScope = scopeKey === undefined || scopeKey === null || `${scopeKey}`.trim() === ''
    ? 'global'
    : `${scopeKey}`.trim();
  return `${STORAGE_KEY}:${normalizedScope}`;
};

export const findRecommendationProductBySku = (sku?: string): RecommendationProduct | null => {
  if (typeof window === 'undefined' || !sku) {
    return null;
  }

  const candidateKeys = Object.keys(localStorage).filter(
    (key) => key === STORAGE_KEY || key.startsWith(STORAGE_KEY_PREFIX),
  );

  const target = `/catalog/products/${sku}`;

  for (const storageKey of candidateKeys) {
    const store = readStoreByKey(storageKey);
    if (!store) {
      continue;
    }

    for (const buckets of Object.values(store)) {
      for (const items of Object.values(buckets)) {
        for (const item of items) {
          const normalized = normalizeProduct(item as unknown as Record<string, unknown>);
          if (normalized?.purchaseUrl?.includes(target)) {
            return normalized;
          }
        }
      }
    }
  }

  return null;
};

const readRawStore = (scopeKey?: string | number): RecommendationStore | null => {
  const scopedStorageKey = resolveStorageKey(scopeKey);
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);

  const raw = localStorage.getItem(scopedStorageKey);
  if (!raw) {
    if (scopeKey !== undefined && scopeKey !== null) {
      return null;
    }

    if (!legacyRaw) {
      return null;
    }

    try {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed)) {
        const legacyProducts = parseItems(legacyParsed as unknown[]).map((item) => ({
          ...item,
          sourceType: 'unknown' as RecommendationSource,
          sourceDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
        }));

        if (legacyProducts.length > 0) {
          const migrated: RecommendationStore = {
            unknown: {
              [legacyProducts[0].sourceDate]: dedupeAndSort(legacyProducts),
            },
          };
          writeRawStore(migrated, scopeKey);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return migrated;
        }
      }
    } catch {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed as RecommendationStore;
  } catch {
    localStorage.removeItem(scopedStorageKey);
    return null;
  }
};

const writeRawStore = (store: RecommendationStore, scopeKey?: string | number) => {
  const scopedStorageKey = resolveStorageKey(scopeKey);
  localStorage.setItem(scopedStorageKey, JSON.stringify(store));
};

const dedupeAndSort = (items: StoredRecommendationProduct[]) => {
  const seen = new Set<string>();
  const result = [] as StoredRecommendationProduct[];

  items
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((item) => {
      const key = `${item.title.toLowerCase()}|${item.purchaseUrl}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });

  return result;
};

export const parseRecommendationProducts = (
  payload: { items?: unknown[]; recommendation?: string; text?: string },
): RecommendationProduct[] => {
  const fromItems = parseItems(payload.items);
  const fromText = parseTextLines(payload.recommendation || payload.text || '').filter((p) => isProductUrl(p.purchaseUrl));

  const merged = [...fromItems, ...fromText];
  const seen = new Set<string>();
  const deduped: RecommendationProduct[] = [];

  merged.forEach((item) => {
    const key = `${item.title.toLowerCase()}|${item.imageUrl}|${item.purchaseUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  });

  return deduped.slice(0, MAX_RECOMMENDATION_PARSE_COUNT);
};

export const saveRecommendationProducts = (
  products: RecommendationProduct[],
  sourceType: RecommendationSource,
  sourceDate = toStoreDate(),
  scopeKey?: string | number,
) => {
  const parsed = parseItems(products as unknown as unknown[]);
  if (parsed.length === 0) {
    return;
  }

  const current = readRawStore(scopeKey) || {};
  if (!current[sourceType]) {
    current[sourceType] = {};
  }

  const now = new Date().toISOString();
  const nextItems: StoredRecommendationProduct[] = parsed
    .map((item) => ({
      ...item,
      sourceType,
      sourceDate,
      createdAt: now,
    }));

  current[sourceType][sourceDate] = dedupeAndSort([
    ...(current[sourceType][sourceDate] || []),
    ...nextItems,
  ]).slice(0, MAX_RECOMMENDATION_KEEP_PER_DATE);

  writeRawStore(current, scopeKey);
};

export const getRecommendationProducts = (
  sourceType?: RecommendationSource,
  limit = 12,
  scopeKey?: string | number,
): RecommendationProduct[] => {
  const store = readRawStore(scopeKey) || {};
  const types = sourceType ? [sourceType] : Object.keys(store);

  const all: StoredRecommendationProduct[] = [];
  types.forEach((type) => {
    const buckets = store[type] || {};
    Object.values(buckets).forEach((items) => {
      all.push(...items);
    });
  });

  const unique = dedupeAndSort(all);
  const normalizedItems = unique
    .slice(0, limit)
    .reduce<RecommendationProduct[]>((acc, item) => {
      const normalized = normalizeProduct(item as unknown as Record<string, unknown>);
      if (!normalized) {
        return acc;
      }
      acc.push({
        ...normalized,
        sourceType: item.sourceType,
      });
      return acc;
    }, []);

  return normalizedItems.map(({ price, priceRange, ...item }) => ({
    ...item,
    price,
    priceRange,
  }));
};

export const getLatestRecommendationProducts = (
  sourceType: RecommendationSource,
  limit = 12,
  scopeKey?: string | number,
): RecommendationProduct[] => {
  const store = readRawStore(scopeKey) || {};
  const buckets = store[sourceType] || {};
  const latestKey = Object.keys(buckets).sort((a, b) => b.localeCompare(a))[0];
  if (!latestKey) {
    return [];
  }

  const latestItems = (buckets[latestKey] || []) as StoredRecommendationProduct[];
  const normalizedItems = dedupeAndSort(latestItems)
    .slice(0, limit)
    .reduce<RecommendationProduct[]>((acc, item) => {
      const normalized = normalizeProduct(item as unknown as Record<string, unknown>);
      if (!normalized) {
        return acc;
      }
      acc.push({
        ...normalized,
        sourceType: item.sourceType,
      });
      return acc;
    }, []);

  return normalizedItems.map(({ price, priceRange, ...item }) => ({
    ...item,
    price,
    priceRange,
  }));
};

export const mergeRecommendationProducts = (
  products: RecommendationProduct[],
  sourceType: RecommendationSource,
  sourceDate = toStoreDate(),
  scopeKey?: string | number,
) => {
  if (!products.length) {
    return;
  }

  const parsed = parseItems(products as unknown as unknown[]);
  if (parsed.length === 0) {
    return;
  }

  const store = readRawStore(scopeKey) || {};
  const now = new Date().toISOString();
  if (!store[sourceType]) {
    store[sourceType] = {};
  }

  const merged = dedupeAndSort([
    ...(store[sourceType][sourceDate] || []),
    ...parsed.map((item) => ({
      ...item,
      sourceType,
      sourceDate,
      createdAt: now,
    })),
  ]).slice(0, MAX_RECOMMENDATION_KEEP_PER_DATE);

  store[sourceType][sourceDate] = merged;
  writeRawStore(store, scopeKey);
};

export const getRecommendationBySourceAndDate = (
  sourceType: RecommendationSource,
  date: string,
  scopeKey?: string | number,
) => {
  const store = readRawStore(scopeKey) || {};
  return (store[sourceType]?.[date] || []).map((item) => ({ ...item }));
};
const MAX_RECOMMENDATION_PARSE_COUNT = 12;
const MAX_RECOMMENDATION_KEEP_PER_DATE = 10;
