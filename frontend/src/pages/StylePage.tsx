
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { styleApi } from '../api/style';
import { StyleRecommendation, User } from '../types';
import {
  parseRecommendationProducts,
  resolvePreferredPurchaseUrl,
  saveRecommendationProducts,
  resolveDisplayBrand,
  markGuestStyleRecommendationReady,
  saveGuestStyleRecommendationGender,
  getGuestStyleRecommendationGender,
  ensureGuestStyleRecommendationSession,
} from '../lib/recommendations';
import { useAuthStore } from '../stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { RecommendationProduct } from '../types';

const isInvalidBrand = (value?: string) => {
  if (!value) {
    return true;
  }
  const normalized = value.toLowerCase().replace(/[\s\-_.]/g, '');
  if (!normalized) {
    return true;
  }
  if (normalized === '브랜드' || normalized === 'brand') {
    return true;
  }
  return ['브랜드a', '브랜드b', '브랜드c', 'branda', 'brandb', 'brandc'].includes(normalized);
};

const resolveProductBrand = (item: RecommendationProduct) => {
  const normalizeRepeatedToken = (value: string) =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .reduce<string[]>((acc, token) => {
        const previous = acc[acc.length - 1];
        if (!previous || previous !== token) {
          acc.push(token);
        }
        return acc;
      }, [])
      .join(' ');

  const resolved = resolveDisplayBrand(item.brand);
  const deduped = resolved ? normalizeRepeatedToken(resolved) : resolved;
  return isInvalidBrand(deduped) ? undefined : deduped;
};

const normalizeBrandInTitle = (title: string, brand: string | undefined): string => {
  if (!title) {
    return title;
  }

  if (!brand) {
    return title;
  }

  const normalizedTitle = title.trim();
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const multiBrandPattern = new RegExp(`^(?:${escapedBrand}\\s+){2,}`, 'i');
  if (multiBrandPattern.test(normalizedTitle)) {
    const cleaned = normalizedTitle.replace(new RegExp(`^(?:${escapedBrand}\\s+){2,}`, 'i'), `${brand} `);
    return cleaned.trim();
  }

  const repeatedWithAliasPattern = new RegExp(
    `^${escapedBrand}\\s+${escapedBrand}(?:\\s*\\([^)]*\\))?\\s+`,
    'i',
  );
  if (repeatedWithAliasPattern.test(normalizedTitle)) {
    return normalizedTitle.replace(repeatedWithAliasPattern, `${brand} `).trim();
  }

  const leadingBrandPattern = new RegExp(`^${escapedBrand}\\s+${escapedBrand}(\\s|$)`, 'i');
  if (leadingBrandPattern.test(normalizedTitle)) {
    return normalizedTitle.replace(leadingBrandPattern, `${brand}$1`).trim();
  }

  const aliasLeadingPattern = new RegExp(`^${escapedBrand}\\s*\\([^)]*\\)\\s+`, 'i');
  if (aliasLeadingPattern.test(normalizedTitle)) {
    return normalizedTitle.replace(aliasLeadingPattern, `${brand} `).trim();
  }

  return normalizedTitle;
};

const resolvePurchaseUrl = (item: RecommendationProduct) =>
  resolvePreferredPurchaseUrl(item.purchaseUrl || item.purchase_url || item.link || item.url, item.title, item.brand) || '';

const resolveProductLabel = (item: RecommendationProduct) => {
  const brand = resolveProductBrand(item);
  if (!brand) {
    return item.title;
  }

  const normalizedTitle = normalizeBrandInTitle(item.title || '', brand);
  const normalizedBrand = brand.trim();
  if (normalizedTitle.startsWith(normalizedBrand)) {
    return normalizedTitle;
  }
  return `${normalizedBrand} ${normalizedTitle}`;
};

type StyleCategory = 'top' | 'bottom' | 'shoes' | 'outer' | 'accessory' | 'other';
const STYLE_CATEGORY_BASE_ORDER: StyleCategory[] = ['top', 'bottom', 'shoes'];

const normalizeStyleText = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[\s/_-]+/g, ' ')
    .replace(/\[|\]/g, '')
    .trim();

const normalizeText = (value?: string) => (value || '').trim().replace(/\s+/g, ' ');

const STYLE_CATEGORY_KEYWORDS: Record<StyleCategory, RegExp[]> = {
  outer: [/아우터|코트|자켓|재킷|점퍼|패딩|집업|블레이저|jacket|coat|outer/],
  top: [/상의|셔츠|니트|스웨터|맨투맨|후드|티셔츠|블라우스|탑|top|후드티|맨투맨/],
  bottom: [/하의|팬츠|슬랙스|데님|진|바지|치마|스커트|bottom|pants|slacks|jeans|조거|레깅스/],
  shoes: [/신발|스니커즈|운동화|로퍼|부츠|구두|샌들|shoes|shoe/],
  accessory: [/액세서리|악세서리|가방|백|벨트|모자|시계|목걸이|반지|스카프|캡|베레모|모자|헤어액세서리/],
  other: [],
};

const normalizeStyleCategoryFromDb = (value?: string): StyleCategory | 'other' => {
  const normalized = normalizeStyleText(value);
  if (!normalized) {
    return 'other';
  }

  if (normalized === 'outer' || normalized === 'top' || normalized === 'bottom' || normalized === 'shoes' || normalized === 'accessory') {
    return normalized as StyleCategory;
  }

  if (/아우터|코트|자켓|재킷|점퍼|패딩|집업|블레이저/.test(normalized)) {
    return 'outer';
  }
  if (/상의|셔츠|니트|스웨터|맨투맨|후드|티셔츠|블라우스|탑|top/.test(normalized)) {
    return 'top';
  }
  if (/하의|팬츠|슬랙스|데님|진|바지|치마|스커트|bottom|pants|slacks|jeans|조거|레깅스/.test(normalized)) {
    return 'bottom';
  }
  if (/신발|스니커즈|운동화|로퍼|부츠|구두|샌들|shoes|shoe/.test(normalized)) {
    return 'shoes';
  }
  if (/액세서리|악세서리|가방|백|벨트|모자|시계|목걸이|반지|스카프|캡/.test(normalized)) {
    return 'accessory';
  }
  return 'other';
};

const detectStyleCategory = (item: RecommendationProduct): StyleCategory => {
  const dbCategory = normalizeStyleCategoryFromDb(item.category);
  if (dbCategory !== 'other') {
    return dbCategory;
  }

  const normalized = normalizeStyleText(`${item.category || ''} ${item.title || ''} ${item.description || ''} ${item.brand || ''}`);
  if (STYLE_CATEGORY_KEYWORDS.outer.some((pattern) => pattern.test(normalized))) {
    return 'outer';
  }
  if (STYLE_CATEGORY_KEYWORDS.top.some((pattern) => pattern.test(normalized))) {
    return 'top';
  }
  if (STYLE_CATEGORY_KEYWORDS.bottom.some((pattern) => pattern.test(normalized))) {
    return 'bottom';
  }
  if (STYLE_CATEGORY_KEYWORDS.shoes.some((pattern) => pattern.test(normalized))) {
    return 'shoes';
  }
  if (STYLE_CATEGORY_KEYWORDS.accessory.some((pattern) => pattern.test(normalized))) {
    return 'accessory';
  }
  return 'other';
};

const normalizeStyleRecommendationOrder = (items: RecommendationProduct[]): RecommendationProduct[] => {
  const grouped: Record<StyleCategory, RecommendationProduct[]> = {
    outer: [],
    top: [],
    bottom: [],
    shoes: [],
    accessory: [],
    other: [],
  };

  const seen = new Set<string>();
  items.forEach((item) => {
    const key = `${item.title.toLowerCase()}|${item.purchaseUrl || item.purchase_url || ''}`.trim();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    grouped[detectStyleCategory(item)].push(item);
  });

  const used = new Set<string>();
  const toKey = (item: RecommendationProduct) =>
    `${(item.title || '').toLowerCase()}|${item.purchaseUrl || item.purchase_url || ''}`;
  const pickOne = (category: StyleCategory) => {
    for (const candidate of grouped[category]) {
      const key = toKey(candidate);
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      return candidate;
    }
    return null;
  };

  const ordered: RecommendationProduct[] = [];
  const outer = pickOne('outer');
  if (outer) {
    ordered.push(outer);
  }

  STYLE_CATEGORY_BASE_ORDER.forEach((category) => {
    const item = pickOne(category);
    if (item) {
      ordered.push(item);
    }
  });

  const accessory = pickOne('accessory');
  if (accessory) {
    ordered.push(accessory);
  }

  if (ordered.length < 3) {
    for (const candidate of grouped.other) {
      const key = toKey(candidate);
      if (used.has(key)) {
        continue;
      }
      used.add(key);
      ordered.push(candidate);
      if (ordered.length >= 3) {
        break;
      }
    }
  }

  return ordered;
};

const inferCategoryLabel = (item: RecommendationProduct) => {
  const category = detectStyleCategory(item);
  if (category === 'outer') return '아우터';
  if (category === 'top') return '상의';
  if (category === 'bottom') return '하의';
  if (category === 'shoes') return '신발';
  if (category === 'accessory') return '액세서리';
  return '아이템';
};

const inferFitHint = (title: string) => {
  const normalized = title.toLowerCase();
  if (/와이드|wide/.test(normalized)) {
    return '여유 있는 실루엣이라 체형 커버와 활동성이 좋고';
  }
  if (/슬림|slim/.test(normalized)) {
    return '라인이 깔끔하게 정리돼 단정한 인상을 만들기 좋고';
  }
  if (/오버핏|oversized/.test(normalized)) {
    return '편안한 착용감과 트렌디한 분위기를 동시에 살릴 수 있고';
  }
  if (/테이퍼드|tapered/.test(normalized)) {
    return '하체 비율이 안정적으로 보이도록 실루엣을 잡아주고';
  }
  return '활용도가 높아 여러 코디에 매치하기 쉽고';
};

const inferOccasionHint = (query: string, occasion?: string) => {
  const merged = `${occasion || ''} ${query}`.toLowerCase();
  if (/데이트|date|여자친구|남자친구|미팅/.test(merged)) {
    return '데이트 상황에서';
  }
  if (/출근|회사|오피스|면접|회의|office/.test(merged)) {
    return '출근/오피스 상황에서';
  }
  if (/여행|출장|trip|travel|휴가/.test(merged)) {
    return '여행/외출 상황에서';
  }
  if (/결혼식|하객|모임|파티|event/.test(merged)) {
    return '행사/모임 상황에서';
  }
  return '일상 코디에서';
};

const isGenericReason = (reason: string) => {
  const normalized = reason.trim().toLowerCase();
  return (
    /추천 아이템/.test(normalized) ||
    /추천상품/.test(normalized) ||
    /아이템입니다/.test(normalized) ||
    normalized.length < 20
  );
};

const resolveRecommendationReason = (item: RecommendationProduct, query: string, occasion?: string) => {
  const itemReason = (item.description || '').trim();
  if (itemReason && !isGenericReason(itemReason)) {
    return itemReason;
  }
  const itemLabel = resolveProductLabel(item);
  const categoryLabel = inferCategoryLabel(item);
  const fitHint = inferFitHint(item.title || '');
  const occasionHint = inferOccasionHint(query, occasion);
  return `${itemLabel}은 ${occasionHint} 활용하기 좋은 ${categoryLabel}로, ${fitHint} 전체 코디 밸런스를 맞추기 좋아 추천했습니다.`;
};

const isStyleGenderValid = (gender?: User['gender']): gender is 'male' | 'female' => gender === 'male' || gender === 'female';

const normalizeStyleGender = (value?: string) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'male' || normalized === 'female') {
    return normalized;
  }

  if (normalized === '남성' || normalized === '남' || normalized === '남자' || normalized === 'male' || normalized === 'man') {
    return 'male';
  }

  if (normalized === '여성' || normalized === '여' || normalized === '여자' || normalized === 'female' || normalized === 'woman') {
    return 'female';
  }

  return undefined;
};

const StylePage: React.FC = () => {
  const { user, isAuthenticated, refreshCurrentUser } = useAuthStore();
  const normalizedStoredGender = normalizeStyleGender(user?.gender);
  const shouldSelectGender = !isAuthenticated || !user || !isStyleGenderValid(normalizedStoredGender);
  const [query, setQuery] = useState('');
  const [occasion, setOccasion] = useState('');
  const [season, setSeason] = useState('');
  const initialGuestGender = shouldSelectGender ? getGuestStyleRecommendationGender() || 'undisclosed' : 'undisclosed';
  const [styleGender, setStyleGender] = useState<'male' | 'female' | 'undisclosed'>(
    user?.gender === 'male' || user?.gender === 'female' || user?.gender === 'undisclosed'
      ? user.gender
      : initialGuestGender
  );
  const [result, setResult] = useState<StyleRecommendation | null>(null);
  const [displayItems, setDisplayItems] = useState<RecommendationProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const hasValidGender = shouldSelectGender ? isStyleGenderValid(styleGender) : true;

  const buildFallbackParsedProducts = (items: RecommendationProduct[] = []) =>
    items
      .map((item, index) => {
        const title =
          normalizeText(resolveProductLabel(item)) ||
          normalizeText(item.title) ||
          `추천 아이템 ${index + 1}`;
        if (!title) {
          return null;
        }

        const imageUrl = normalizeText(item.imageUrl || item.image_url || '');
        const purchaseUrl = normalizeText(resolvePurchaseUrl(item));
        if (!purchaseUrl) {
          return null;
        }

        return {
          id: item.id || `${title}-${purchaseUrl}`,
          title,
          description: item.description || `${title} 추천 아이템입니다.`,
          imageUrl,
          purchaseUrl,
          category: item.category || undefined,
          tags: item.tags || [],
          brand: resolveProductBrand(item) || item.brand,
          price: item.price || '',
          gender: item.gender,
          source: item.source || 'AI 추천',
        } as RecommendationProduct;
      })
      .filter((item): item is RecommendationProduct => item !== null);

  const resolveRequestedGender = () => {
    const userGender = isStyleGenderValid(normalizedStoredGender) ? normalizedStoredGender : undefined;
    if (userGender) {
      return userGender;
    }

    const guestGender = normalizeStyleGender(styleGender);
    return guestGender;
  };

  React.useEffect(() => {
    if (!shouldSelectGender) {
      const normalizedGender = normalizeStyleGender(user?.gender);
      if (normalizedGender) {
        setStyleGender(normalizedGender);
      } else {
        setStyleGender('undisclosed');
      }
    } else {
      const savedGuestGender = getGuestStyleRecommendationGender() || 'undisclosed';
      setStyleGender(savedGuestGender);
    }
  }, [shouldSelectGender, normalizedStoredGender, user?.gender]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (shouldSelectGender && !hasValidGender) {
      setError('비로그인 상태에서는 성별(남성/여성)을 먼저 선택해주세요.');
      return;
    }

    if (!query.trim()) {
      setError('요청 내용을 입력해주세요');
      return;
    }

    if (!season.trim()) {
      setError('계절을 선택해주세요');
      return;
    }

    setIsLoading(true);
    try {
      const requestQuery = query.trim();
      const requestOccasion = occasion.trim() || undefined;
      const requestSeason = season.trim();
      const requestedGender = resolveRequestedGender();
      const requestedGenderLower = requestedGender || undefined;
      const response = shouldSelectGender
        ? await styleApi.recommendGuest(
            requestQuery,
            requestOccasion,
            isStyleGenderValid(requestedGender) ? requestedGender : undefined,
            requestSeason
          )
        : await styleApi.recommend(
            requestQuery,
            requestOccasion,
            isStyleGenderValid(requestedGender) ? requestedGender : undefined,
            requestSeason
          );
      if (!shouldSelectGender) {
        await refreshCurrentUser();
      } else {
        saveGuestStyleRecommendationGender(requestedGenderLower as 'male' | 'female' | undefined);
      }
      const rawParsedProducts = parseRecommendationProducts({
        items: response.items,
        recommendation: response.recommendation,
      });
      const fallbackParsedProducts = buildFallbackParsedProducts(response.items);
      const sourceProducts =
        rawParsedProducts.length > 0 ? rawParsedProducts : fallbackParsedProducts;
      const sourceProductsWithFallback = sourceProducts.length > 0 ? sourceProducts : parseRecommendationProducts({
        recommendation: response.recommendation,
      });
      const requestedGenderFilteredProducts = sourceProductsWithFallback.filter((item) => {
        if (!requestedGenderLower) {
          return true;
        }
        const itemGender = normalizeStyleGender(item.gender);
        if (!itemGender) {
          return true;
        }
        return itemGender === requestedGenderLower;
      });
      const fallbackProducts = requestedGenderFilteredProducts.length > 0
        ? requestedGenderFilteredProducts
        : sourceProductsWithFallback;

      const parsedByOrder =
        fallbackProducts.length > 0
          ? normalizeStyleRecommendationOrder(fallbackProducts)
          : normalizeStyleRecommendationOrder(sourceProductsWithFallback);
      const itemsToDisplay = parsedByOrder;
      if (itemsToDisplay.length > 0) {
        if (shouldSelectGender) {
          ensureGuestStyleRecommendationSession();
          markGuestStyleRecommendationReady();
          saveGuestStyleRecommendationGender(requestedGenderLower as 'male' | 'female' | undefined);
        }

        const persistedItems = itemsToDisplay.map((item, index) => ({
          ...item,
          id: item.id || `${item.title}-${index + 1}`,
          imageUrl: item.imageUrl || item.image_url || '',
          purchaseUrl: item.purchaseUrl || item.purchase_url || '',
        }));
        const savedAt = new Date().toISOString();
        if (user?.id) {
          saveRecommendationProducts(persistedItems, 'style', savedAt, user.id);
        } else {
          saveRecommendationProducts(persistedItems, 'style', savedAt, 'guest');
        }
      }
      setDisplayItems(itemsToDisplay);
      setResult({
        ...response,
        items: itemsToDisplay,
      });
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const apiMessage = apiError?.detail || err?.response?.data?.message;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        setError(apiMessage);
      } else if (apiMessage !== undefined) {
        setError(JSON.stringify(apiMessage));
      } else {
        setError('스타일 추천에 실패했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <Card className="animate-reveal">
        <CardHeader>
          <CardTitle className="text-2xl">스타일 추천</CardTitle>
          <p className="mt-2 text-sm text-gray-600">
            {shouldSelectGender
              ? '비로그인 상태에서는 기본 기준으로 추천해드리며, 퍼스널컬러 기반 개인화는 로그인 후 이용 가능합니다.'
              : '저장된 퍼스널컬러와 기본 프로필을 기반으로 추천해드립니다.'}
          </p>
            {shouldSelectGender ? (
              <p className="mt-2 text-xs text-slate-500">
                스타일 추천은 사용 가능하지만, 퍼스널컬러 진단을 받으려면{' '}
                <Link to="/login" className="font-medium text-primary-700 underline underline-offset-2">
                  로그인
                </Link>{' '}
                해주세요.
              </p>
            ) : null}
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {shouldSelectGender && (
              <div>
                <label htmlFor="styleGender" className="mb-1 block text-sm font-medium text-gray-700">
                  성별
                </label>
                <select
                  id="styleGender"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  value={styleGender}
                  onChange={(e) => setStyleGender(e.target.value as 'male' | 'female' | 'undisclosed')}
                >
                  <option value="undisclosed">선택</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                </select>
                {!hasValidGender && <p className="mt-1 text-xs text-red-600">성별을 선택해야 스타일 추천을 진행할 수 있습니다.</p>}
              </div>
            )}

            <div>
              <label htmlFor="season" className="mb-1 block text-sm font-medium text-gray-700">
                계절
              </label>
              <select
                id="season"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                <option value="">선택</option>
                <option value="봄">봄</option>
                <option value="여름">여름</option>
                <option value="가을">가을</option>
                <option value="겨울">겨울</option>
              </select>
            </div>

            <div>
              <label htmlFor="query" className="mb-1 block text-sm font-medium text-gray-700">
                어떤 스타일이 필요하신가요?
              </label>
              <Textarea
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-[110px] bg-white/90"
                placeholder="예) 여자친구랑 데이트 하는데 룩좀 추천해줘."
                required
              />
            </div>

            <div>
              <label htmlFor="occasion" className="mb-1 block text-sm font-medium text-gray-700">
                상황/TPO (선택)
              </label>
              <Input
                id="occasion"
                type="text"
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                placeholder="예) 출근, 데이트, 면접"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={isLoading || (shouldSelectGender && !hasValidGender)} className="w-full">
              {isLoading ? '추천 생성 중...' : '스타일 추천 받기'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="space-y-4">
          <CardContent>
            <h2 className="text-xl font-semibold text-gray-900">추천 결과</h2>

            {result.personalColor && (
              <p className="inline-block rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-700">
                기준 퍼스널컬러: {result.personalColor}
              </p>
            )}

            <div className="whitespace-pre-wrap leading-relaxed text-gray-800">{result.recommendation}</div>

            {displayItems.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">추천 상품과 추천 이유</h3>
                <div className="space-y-2">
                  {displayItems.map((item, index) => {
                    const purchaseUrl = resolvePurchaseUrl(item);
                    const reason = resolveRecommendationReason(item, query.trim(), occasion.trim() || undefined);

                    return (
                      <article key={`${item.title}-${purchaseUrl}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                        {purchaseUrl ? (
                          <a
                            href={purchaseUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-primary-700 hover:text-primary-800"
                          >
                            {resolveProductLabel(item)}
                          </a>
                        ) : (
                          <p className="text-sm font-semibold text-gray-900">{resolveProductLabel(item)}</p>
                        )}
                        <p className="mt-1 text-sm leading-relaxed text-gray-700">{reason}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StylePage;
