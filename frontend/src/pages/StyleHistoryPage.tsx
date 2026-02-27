
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { styleApi } from '../api/style';
import {
  getGuestStyleRecommendationGender,
  getRecommendationProducts,
  hasActiveGuestStyleRecommendationSession,
  clearGuestStyleRecommendationCache,
} from '../lib/recommendations';
import { RecommendationProduct, StyleRecommendationHistory } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

type StyleSetCategory = 'outer' | 'top' | 'bottom' | 'shoes' | 'accessory' | 'other';

const ITEMS_PER_PAGE = 6;

type DisplayStyleItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  purchaseUrl: string;
  brandLabel: string;
  priceLabel: string;
};

type DisplayStyleSet = {
  id: string;
  title: string;
  summary: string;
  source: string;
  createdAt: string;
  items: DisplayStyleItem[];
};

const normalizeLabel = (value?: string) => (value || '').trim().replace(/\s+/g, ' ');
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8080`;

const normalizeHomeStyleGender = (value?: string) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'male' || normalized === 'female') {
    return normalized;
  }

  if (normalized === '남' || normalized === '남성' || normalized === '남자' || normalized === 'man' || normalized === 'men') {
    return 'male';
  }

  if (normalized === '여' || normalized === '여성' || normalized === '여자' || normalized === 'woman' || normalized === 'women') {
    return 'female';
  }

  return undefined;
};

const normalizeCategory = (value?: string): StyleSetCategory => {
  const normalized = normalizeLabel(value).toLowerCase();
  if (!normalized) {
    return 'other';
  }

  if (['outer', 'outerwear'].includes(normalized) || /아우터|자켓|재킷|코트|점퍼|패딩|블레이저|집업/.test(normalized)) {
    return 'outer';
  }
  if (['top', '상의'].includes(normalized) || /상의|티셔츠|셔츠|니트|스웨터|맨투맨|후드|가디건|블라우스|탑|tee|shirt/.test(normalized)) {
    return 'top';
  }
  if (
    ['bottom', '바지', '팬츠', '하의'].includes(normalized) ||
    /하의|바지|팬츠|슬랙스|데님|청바지|치노|진|치마|스커트|조거|레깅스|슬랙/.test(normalized)
  ) {
    return 'bottom';
  }
  if (['shoes', '신발', '신발류'].includes(normalized) || /신발|스니커즈|운동화|로퍼|부츠|구두|샌들|슈즈|shoes|shoe/.test(normalized)) {
    return 'shoes';
  }
  if (
    ['accessory', '액세서리', '가방', '시계'].includes(normalized) ||
    /악세서리|액세서리|가방|백|벨트|모자|목걸이|반지|목도리|스카프|시계/.test(normalized)
  ) {
    return 'accessory';
  }

  return 'other';
};

const isGenericImage = (url?: string) => {
  const normalized = normalizeLabel(url).toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes('via.placeholder.com') ||
    normalized.includes('placeholder.com') ||
    normalized.includes('dummyimage.com') ||
    normalized.includes('images.unsplash.com')
  );
};

const extractMusinsaProductId = (value?: string) => {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return '';
  }
  const direct = normalized.match(/^\d{5,}$/);
  if (direct?.[0]) {
    return direct[0];
  }
  const productMatch = normalized.match(/\/products\/(\d{5,})/i);
  if (productMatch?.[1]) {
    return productMatch[1];
  }
  const goodsImgMatch = normalized.match(/\/goods_img\/(\d{5,})\//i);
  if (goodsImgMatch?.[1]) {
    return goodsImgMatch[1];
  }
  return '';
};

const getQueryParamFromUrl = (value: string, key: string) => {
  const normalized = normalizeLabel(value);
  if (!normalized || !normalized.includes('?')) {
    return '';
  }

  const query = normalized.slice(normalized.indexOf('?') + 1);
  const params = new URLSearchParams(query);
  return normalizeLabel(params.get(key) || '');
};

const extractProductIdFromCatalogPath = (value?: string) => {
  const normalized = normalizeLabel(value);
  if (!normalized) {
    return '';
  }

  const itemSkuMatch = normalized.match(/\/catalog\/products\/item-(\d{5,})/i);
  if (itemSkuMatch?.[1]) {
    return itemSkuMatch[1];
  }

  const genericSkuMatch = normalized.match(/\/catalog\/products\/[^/?]*?(\d{5,})/i);
  if (genericSkuMatch?.[1]) {
    return genericSkuMatch[1];
  }

  return '';
};

const buildProxyImageUrl = (productId?: string, purchaseUrl?: string, imageUrl?: string) => {
  const params = new URLSearchParams();
  if (normalizeLabel(productId)) {
    params.set('productId', normalizeLabel(productId));
  }
  if (normalizeLabel(purchaseUrl)) {
    params.set('url', normalizeLabel(purchaseUrl));
  }
  if (normalizeLabel(imageUrl)) {
    params.set('imageUrl', normalizeLabel(imageUrl));
  }
  const query = params.toString();
  return query ? `${API_BASE_URL}/api/assets/image?${query}` : '';
};

const buildImageCandidates = (item: DisplayStyleItem) => {
  const rawImage = normalizeLabel(item.imageUrl);
  const purchaseUrl = normalizeLabel(item.purchaseUrl);
  const nestedImage =
    getQueryParamFromUrl(purchaseUrl, 'image_url') || getQueryParamFromUrl(purchaseUrl, 'imageUrl');
  const nestedPurchase =
    getQueryParamFromUrl(purchaseUrl, 'purchase_url') ||
    getQueryParamFromUrl(purchaseUrl, 'product_url') ||
    getQueryParamFromUrl(purchaseUrl, 'purchaseUrl') ||
    getQueryParamFromUrl(purchaseUrl, 'productUrl') ||
    '';
  const nestedProductId =
    getQueryParamFromUrl(purchaseUrl, 'product_id') ||
    getQueryParamFromUrl(purchaseUrl, 'legacy_product_id') ||
    '';

  const productId =
    extractMusinsaProductId(nestedProductId) ||
    extractMusinsaProductId(nestedPurchase) ||
    extractMusinsaProductId(purchaseUrl) ||
    extractProductIdFromCatalogPath(purchaseUrl) ||
    extractMusinsaProductId(rawImage) ||
    extractMusinsaProductId(nestedImage) ||
    extractMusinsaProductId(item.id);
  const musinsaImage = productId
    ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_500.jpg`
    : '';
  const musinsaImageAlt = productId
    ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_500.jpg?fit=inside|768:1000`
    : '';
  const musinsaImageSmall = productId
    ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_280.jpg`
    : '';
  const proxyImage = buildProxyImageUrl(
    productId,
    nestedPurchase || purchaseUrl,
    rawImage || nestedImage || musinsaImage,
  );
  return Array.from(
    new Set(
      [rawImage, nestedImage, musinsaImage, musinsaImageAlt, musinsaImageSmall, proxyImage]
        .map((value) => normalizeLabel(value))
        .filter((value) => Boolean(value) && !isGenericImage(value)),
    ),
  );
};

const formatPriceText = (value?: string) => {
  const raw = normalizeLabel(value);
  if (!raw) {
    return '가격 확인';
  }
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) {
    return raw;
  }
  return `${Number(digits).toLocaleString('ko-KR')}원`;
};

const buildDisplayItem = (item: RecommendationProduct): DisplayStyleItem => {
  const title = normalizeLabel(item.title) || '추천 아이템';
  const brand = normalizeLabel(item.brand);
  const purchaseUrl = normalizeLabel(item.purchaseUrl || item.purchase_url || '');

  return {
    id: item.id || `${title}-${purchaseUrl}`,
    title,
    subtitle: brand ? `${brand} · ${title}` : title,
    imageUrl: normalizeLabel(item.imageUrl || item.image_url || ''),
    purchaseUrl,
    brandLabel: brand || '브랜드 확인',
    priceLabel: formatPriceText(item.price || item.priceRange),
  };
};

const filterItemsByGender = (
  items: DisplayStyleItem[] & Array<{ gender?: string }>,
  targetGender?: 'male' | 'female',
) => {
  if (!targetGender) {
    return items;
  }

  return items.filter((item) => {
    const genderValue = normalizeHomeStyleGender((item as { gender?: string }).gender);
    if (!genderValue) {
      return true;
    }
    return genderValue === targetGender;
  }) as DisplayStyleItem[];
};

const buildGuestHomeSets = (
  items: RecommendationProduct[],
  targetGender?: 'male' | 'female',
): DisplayStyleSet[] => {
  if (!items.length) {
    return [];
  }

  const normalized = items.map((item) => {
    const display = buildDisplayItem(item);
    return {
      ...display,
      rawCategory: normalizeCategory(item.category),
      rawCreatedAt: (item as { createdAt?: string }).createdAt,
      rawGender: normalizeLabel(item.gender),
    };
  });

  const withGender = normalized.filter((item) => {
    const itemGender = normalizeHomeStyleGender(item.rawGender);
    if (!itemGender || !targetGender) {
      return true;
    }
    return itemGender === targetGender;
  });

  const candidateItems = withGender.length > 0 ? withGender : normalized;

  if (candidateItems.length === 0) {
    return [];
  }

  const buildSetItems = (input: typeof candidateItems) => {
    const outer: typeof candidateItems = [];
    const top: typeof candidateItems = [];
    const bottom: typeof candidateItems = [];
    const shoes: typeof candidateItems = [];
    const accessory: typeof candidateItems = [];
    const others: typeof candidateItems = [];

    input.forEach((entry) => {
      switch (entry.rawCategory) {
        case 'outer':
          outer.push(entry);
          return;
        case 'top':
          top.push(entry);
          return;
        case 'bottom':
          bottom.push(entry);
          return;
        case 'shoes':
          shoes.push(entry);
          return;
        case 'accessory':
          accessory.push(entry);
          return;
        default:
          others.push(entry);
          return;
      }
    });

    const used = new Set<string>();
    const usedItem = (item: (typeof withGender)[number]) => `${item.purchaseUrl}|${item.title}`;

    const take = (bucket: typeof withGender) => {
      while (bucket.length > 0) {
        const candidate = bucket.shift()!;
        if (used.has(usedItem(candidate))) {
          continue;
        }
        used.add(usedItem(candidate));
        return candidate;
      }
      return null;
    };

    const ordered: typeof withGender = [];
    const optionalOuter = outer.length > 0 ? take(outer) : null;
    const optionalAccessory = accessory.length > 0 ? take(accessory) : null;
    const pickTop = take(top);
    const pickBottom = take(bottom);
    const pickShoes = take(shoes);

    if (optionalOuter) {
      ordered.push(optionalOuter);
    }
    if (pickTop) {
      ordered.push(pickTop);
    }
    if (pickBottom) {
      ordered.push(pickBottom);
    }
    if (pickShoes) {
      ordered.push(pickShoes);
    }
    if (optionalAccessory) {
      ordered.push(optionalAccessory);
    }

    if (ordered.length < 3) {
      const pools: typeof withGender[] = [outer, top, bottom, shoes, accessory, others];
      pools.forEach((bucket) => {
        if (ordered.length >= 3) {
          return;
        }
        const next = take(bucket);
        if (next) {
          ordered.push(next);
        }
      });
    }

    const hasImage = (item: DisplayStyleItem) => !isGenericImage(item.imageUrl);
    const cleaned = ordered.filter(Boolean) as typeof withGender;
    const finalItems = cleaned.length > 0 ? cleaned : input.slice(0, 3);

    return finalItems.length > 0
      ? finalItems.map((entry) => ({
          ...buildDisplayItem(entry as unknown as RecommendationProduct),
          hasImage: hasImage(buildDisplayItem(entry as unknown as RecommendationProduct)),
        }))
      : [];
  };

  const grouped: DisplayStyleSet[] = [];
  let sourceItems = [...candidateItems];
  let index = 1;
  while (sourceItems.length > 0 && index <= 30) {
    const setItems = buildSetItems(sourceItems);
    if (setItems.length === 0) {
      break;
    }

    const summary = setItems.map((item) => item.title).join(' · ');
    const firstCreatedAt = setItems[0].id
      ? (setItems.find((item, i) => i === 0) ? new Date().toISOString() : new Date().toISOString())
      : new Date().toISOString();

    grouped.push({
      id: `guest-set-${index}`,
      title: `추천 코디 ${index}`,
      summary,
      source: 'AI 추천',
      createdAt: (sourceItems[0]?.rawCreatedAt as string) || firstCreatedAt,
      items: setItems,
    });

    const usedKeys = new Set(setItems.map((item) => `${item.purchaseUrl}|${item.title}`));
    sourceItems = sourceItems.filter((item) => !usedKeys.has(`${item.purchaseUrl}|${item.title}`));
    index += 1;
  }

  return grouped;
};

const resolveHistorySetTitle = (entry: StyleRecommendationHistory, index: number) =>
  normalizeLabel(entry.query) || `스타일 추천 ${index}`;

const buildHistorySets = (entries: StyleRecommendationHistory[]): DisplayStyleSet[] =>
  entries
    .map((entry, index) => {
      const items = (entry.items || []).map(buildDisplayItem);
      const filtered = filterItemsByGender(
        items as (DisplayStyleItem & { gender?: string })[],
        normalizeHomeStyleGender(entry.gender),
      );

      if (!filtered.length) {
        return null;
      }

      const summary = filtered.map((item) => item.title).join(' · ');
      return {
        id: `history-${index}-${entry.createdAt || 'no-date'}`,
        title: resolveHistorySetTitle(entry, index + 1),
        summary,
        source: 'AI 스타일 추천 기록',
        createdAt: entry.createdAt || new Date().toISOString(),
        items: filtered,
      } as DisplayStyleSet;
    })
    .filter(Boolean) as DisplayStyleSet[];

const StyleHistoryPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [itemsPerPage] = React.useState(ITEMS_PER_PAGE);
  const [displaySets, setDisplaySets] = React.useState<DisplayStyleSet[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const hasValidGender =
    normalizeHomeStyleGender(user?.gender) === 'male' || normalizeHomeStyleGender(user?.gender) === 'female';
  const targetGender = hasValidGender
    ? normalizeHomeStyleGender(user?.gender)
    : getGuestStyleRecommendationGender() || undefined;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [displaySets.length]);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');

      try {
        if (!isAuthenticated && !hasActiveGuestStyleRecommendationSession()) {
          clearGuestStyleRecommendationCache();
        }
        const cachedScope = isAuthenticated && user?.id ? user.id : 'guest';
        const cachedProducts = getRecommendationProducts('style', 60, cachedScope);
        const cachedSets = buildGuestHomeSets(cachedProducts, targetGender);

        let historySets: DisplayStyleSet[] = [];
        if (isAuthenticated) {
          try {
            const history = await styleApi.getSavedRecommendations(30);
            historySets = buildHistorySets(history);
          } catch (historyError) {
            console.warn('스타일 추천 기록을 불러오지 못했습니다. 로컬 추천으로 페이지를 구성합니다.', historyError);
          }
        }

        const merged = [...cachedSets, ...historySets];
        const unique: DisplayStyleSet[] = [];
        const signatures = new Set<string>();

        merged
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .forEach((entry) => {
            const signature = `${entry.title}|${entry.createdAt}|${entry.summary}`;
            if (signatures.has(signature)) {
              return;
            }
            signatures.add(signature);
            unique.push(entry);
          });

        setDisplaySets(unique);
      } catch (e) {
        console.error('Style recommendation history load failed', e);
        setError('추천 코디 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isAuthenticated, user?.id, targetGender]);

  const totalPages = Math.max(1, Math.ceil(displaySets.length / itemsPerPage));
  const clampedPage = Math.min(currentPage, totalPages);
  const start = (clampedPage - 1) * itemsPerPage;
  const visibleSets = displaySets.slice(start, start + itemsPerPage);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(totalPages, Math.max(1, page)));
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">추천 코디 전체보기</h1>
        <Link
          to="/style/recommend"
          className="rounded-md border border-primary-300 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          새 추천 받기
        </Link>
      </div>

      <p className="text-sm text-gray-600">
        {isAuthenticated
          ? `${user?.nickname || '회원'}님이 최근에 받은 스타일 코디를 정리한 페이지입니다.`
          : '최근 비로그인 추천 코디 목록입니다.'}
      </p>

      {loading && <p className="text-sm text-gray-600">목록을 불러오는 중...</p>}
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {!loading && !error && displaySets.length === 0 && (
        <Card>
          <CardContent className="py-8 text-sm text-gray-700">표시할 추천 코디가 없습니다.</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {visibleSets.map((set) => {
          const summary = set.summary || '코디를 구성해보세요.';
              return (
            <Card key={set.id}>
              <CardHeader>
                <CardTitle className="text-lg">{set.title}</CardTitle>
                <p className="text-xs text-gray-500">
                  {set.source} · {set.createdAt ? new Date(set.createdAt).toLocaleString('ko-KR') : '시간 미확인'}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600">{summary}</p>
                <div className="space-y-3">
                  {set.items.map((item, itemIndex) => {
                    const itemLink = item.purchaseUrl || '#';
                    const isExternal = itemLink.startsWith('http');
                    const imageCandidates = buildImageCandidates(item);
                    const imageSource = imageCandidates[0] || '';
                    return (
                      <a
                        key={`${set.id}-${item.id}-${itemIndex}`}
                        href={itemLink}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noreferrer' : undefined}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 hover:border-primary-300 hover:bg-primary-50"
                      >
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                          {imageSource ? (
                            <>
                              <img
                                src={imageSource}
                                alt={item.title}
                                className="h-full w-full object-cover"
                                data-fallback-index="0"
                                onError={(event) => {
                                  const currentIndex = Number(event.currentTarget.dataset.fallbackIndex || '0');
                                  const nextIndex = currentIndex + 1;
                                  if (nextIndex < imageCandidates.length) {
                                    event.currentTarget.dataset.fallbackIndex = String(nextIndex);
                                    event.currentTarget.src = imageCandidates[nextIndex];
                                    return;
                                  }

                                  event.currentTarget.style.display = 'none';
                                  const fallbackNode = event.currentTarget.parentElement?.querySelector(
                                    '[data-image-fallback="true"]',
                                  ) as HTMLDivElement | null;
                                  if (fallbackNode) {
                                    fallbackNode.style.display = 'flex';
                                  }
                                }}
                              />
                              <div
                                data-image-fallback="true"
                                className="hidden h-full w-full items-center justify-center px-2 text-center text-[11px] text-slate-500"
                              >
                                이미지 없음
                              </div>
                            </>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-slate-500">
                              이미지 없음
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{item.subtitle}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {item.brandLabel ? `${item.brandLabel} · ` : ''}
                            {item.priceLabel}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && displaySets.length > 0 ? (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => goToPage(clampedPage - 1)}
            disabled={clampedPage <= 1}
            className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="px-2 text-sm text-gray-700">
            {clampedPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(clampedPage + 1)}
            disabled={clampedPage >= totalPages}
            className="rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default StyleHistoryPage;
