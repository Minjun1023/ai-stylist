
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { calendarApi } from '../api/calendar';
import { styleApi } from '../api/style';
import {
  getLatestRecommendationProducts,
  getGuestStyleRecommendationGender,
  hasActiveGuestStyleRecommendationSession,
  clearGuestStyleRecommendationCache,
} from '../lib/recommendations';
import { Button } from '../components/ui/button';
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  PlusIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline';
import {
  CalendarScheduleRecord,
  HomeRecommendationSet,
  HomeStyleSetItem,
  HomeStyleRecommendationResponse,
  RecommendationProduct,
  User,
} from '../types';

type SeasonLabel = '봄' | '여름' | '가을' | '겨울';

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

type HomeDisplayItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  purchaseUrl?: string;
  brandLabel: string;
  priceLabel: string;
  tag: string;
  category?: ProductCategory;
  gender?: string;
};

type HomeDisplaySet = Omit<HomeRecommendationSet, 'items'> & { items: HomeDisplayItem[] };
type ProductCategory = 'outer' | 'top' | 'bottom' | 'shoes' | 'accessory' | 'other';

const hasValidStyleGender = (user?: User | null): boolean => Boolean(normalizeHomeStyleGender(user?.gender));

const isGenericImageUrl = (url?: string) => {
  const normalized = (url || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes('via.placeholder.com') ||
    normalized.includes('placeholder.com') ||
    normalized.includes('dummyimage.com') ||
    normalized.includes('images.unsplash.com') ||
    normalized.includes('placeimg.com')
  );
};

const getCurrentSeasonLabel = (): SeasonLabel => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return '봄';
  }
  if (month >= 6 && month <= 8) {
    return '여름';
  }
  if (month >= 9 && month <= 11) {
    return '가을';
  }
  return '겨울';
};

const normalizeLabel = (value?: string) => (value || '').trim().replace(/\s+/g, ' ');

const getAgeLabel = (ageGroup?: string) => {
  const map: Record<string, string> = {
    teens: '10대',
    twenties_early: '20대 초반',
    twenties_late: '20대 후반',
    thirties_early: '30대 초반',
    thirties_late: '30대 후반',
    forties_plus: '40대 이상',
  };

  if (!ageGroup) {
    return '';
  }

  return map[ageGroup] || '';
};

const getBodyTypeLabel = (bodyType?: string) => {
  const map: Record<string, string> = {
    slim: '슬림형',
    standard: '보통형',
    curvy: '볼륨형',
    muscular: '근육형',
    plus: '플러스형',
  };

  if (!bodyType) {
    return '';
  }

  return map[bodyType] || '';
};

const getMoodLabel = (mood?: string) => {
  const map: Record<string, string> = {
    casual: '캐주얼',
    minimal: '미니멀',
    feminine: '페미닌',
    chic: '시크',
    street: '스트릿',
    classic: '클래식',
  };

  if (!mood) {
    return '';
  }

  return map[mood] || '';
};

const resolveHomePurchaseUrl = (item: HomeStyleSetItem): string => normalizeLabel(item.purchaseUrl || item.purchase_url || '');

const resolveHomeImageUrl = (item: HomeStyleSetItem): string =>
  normalizeLabel(item.imageUrl || item.image_url || '');

const resolveHomeBrand = (item: HomeStyleSetItem): string => normalizeLabel(item.brand);

const normalizeRepeatedWords = (value: string): string => {
  const tokens = normalizeLabel(value).split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return tokens.join(' ');
  }
  const merged: string[] = [];
  const seen: Set<string> = new Set();
  tokens.forEach((token) => {
    if (!seen.has(token)) {
      seen.add(token);
      merged.push(token);
    }
  });
  return merged.join(' ');
};

const resolveHomePriceLabel = (item: HomeStyleSetItem): string => {
  if (normalizeLabel(item.price)) {
    return `가격 ${normalizeLabel(item.price)}`;
  }
  return '가격 확인';
};

const resolveHomeTag = (item: HomeStyleSetItem): string => normalizeLabel(item.tag || item.source || 'AI 추천') || 'AI 추천';
const formatPriceText = (value?: string) => {
  const raw = normalizeLabel(value);
  if (!raw) {
    return '';
  }
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) {
    return raw;
  }
  return `${Number(digits).toLocaleString('ko-KR')}원`;
};

const normalizeDbCategory = (value?: string): ProductCategory => {
  const normalized = normalizeLabel(value).toLowerCase();
  if (!normalized) {
    return 'other';
  }

  if (normalized === 'outer' || normalized === 'top' || normalized === 'bottom' || normalized === 'shoes' || normalized === 'accessory') {
    return normalized as ProductCategory;
  }

  if (/아우터|자켓|재킷|코트|점퍼|패딩|블레이저|집업/.test(normalized)) {
    return 'outer';
  }
  if (/상의|티셔츠|셔츠|니트|스웨터|맨투맨|후드|가디건|블라우스|탑/.test(normalized)) {
    return 'top';
  }
  if (/하의|팬츠|슬랙스|바지|데님|청바지|치노|진|치마|스커트/.test(normalized)) {
    return 'bottom';
  }
  if (/신발|스니커즈|운동화|부츠|로퍼|구두|샌들|슈즈/.test(normalized)) {
    return 'shoes';
  }
  if (/악세서리|액세서리|가방|백|벨트|목걸이|반지|시계|스카프/.test(normalized)) {
    return 'accessory';
  }

  return 'other';
};

const normalizeCategoryFromText = (text: string): ProductCategory => {
  const normalized = text.toLowerCase();
  if (/아우터|자켓|재킷|코트|점퍼|패딩|블레이저|집업|jacket|coat|outer/.test(normalized)) {
    return 'outer';
  }
  if (/상의|티셔츠|셔츠|니트|스웨터|맨투맨|후드|가디건|블라우스|탑|top|tee|shirt/.test(normalized)) {
    return 'top';
  }
  if (/하의|팬츠|슬랙스|바지|데님|청바지|치노|진|치마|스커트|bottom|pants|slacks|jeans|조거|레깅스/.test(normalized)) {
    return 'bottom';
  }
  if (/신발|스니커즈|운동화|부츠|로퍼|구두|샌들|슈즈|sneaker|boots|shoes|shoe/.test(normalized)) {
    return 'shoes';
  }
  if (/악세서리|액세서리|가방|백|벨트|목걸이|반지|시계|스카프|모자|캡|베레모/.test(normalized)) {
    return 'accessory';
  }

  return 'other';
};

const enrichCatalogPurchaseUrl = (
  purchaseUrl: string,
  fallbackTitle: string,
  fallbackBrand: string,
  itemId?: string,
  source?: string,
  category?: string,
  price?: string,
  externalPurchaseUrl?: string,
  imageUrl?: string,
  productId?: string,
): string => {
  const isItemsSource = source === 'items';
  const id = normalizeLabel(itemId);
  if (isItemsSource && id) {
    const safeTitle = fallbackTitle || '추천 아이템';
    const safeBrand = fallbackBrand || '';
    const safeDescription = `${fallbackTitle} 추천 아이템`;
    const safeCategory = category || 'other';
    const safePrice = price || '';
    const detailSaleUrl = normalizeLabel(externalPurchaseUrl || purchaseUrl);
    const safeImageUrl = normalizeLabel(imageUrl);
    const safeProductId = normalizeLabel(productId);

    const path = purchaseUrl.startsWith('/catalog/products/')
      ? purchaseUrl
      : `/catalog/products/${encodeURIComponent(id)}`;
    const [basePath, rawQuery] = path.split('?', 2);
    const params = new URLSearchParams(rawQuery || '');
    params.set('title', safeTitle);
    params.set('brand', safeBrand);
    params.set('description', safeDescription);
    params.set('category', safeCategory);
    params.set('price', safePrice);
    params.set('source', '상품 DB');
    if (detailSaleUrl) {
      params.set('purchase_url', detailSaleUrl);
    }
    if (safeImageUrl) {
      params.set('image_url', safeImageUrl);
    }
    if (safeProductId) {
      params.set('product_id', safeProductId);
    }
    return `${basePath}?${params.toString()}`;
  }

  if (!purchaseUrl.startsWith('/catalog/products/')) {
    return purchaseUrl;
  }
  if (purchaseUrl.includes('?')) {
    return purchaseUrl;
  }

  const title = encodeURIComponent(fallbackTitle || '추천 아이템');
  const brand = encodeURIComponent(fallbackBrand || '');
  const description = encodeURIComponent(`${title} 추천 아이템`);
  return `/catalog/products/${purchaseUrl.replace('/catalog/products/', '')}?title=${title}&brand=${brand}&description=${description}&category=other&price=&source=상품DB`;
};

const buildProductPreviewImage = (purchaseUrl?: string) => {
  const normalized = normalizeLabel(purchaseUrl);
  if (!normalized || !normalized.startsWith('http')) {
    return '';
  }
  if (normalized.startsWith('//')) {
    return `https:${normalized}`;
  }
  return normalized;
};
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8080`;

const extractQueryParamFromUrl = (value?: string, key?: string) => {
  const raw = normalizeLabel(value);
  if (!raw || !key || !raw.includes('?')) {
    return '';
  }
  const query = raw.slice(raw.indexOf('?') + 1);
  const params = new URLSearchParams(query);
  return normalizeLabel(params.get(key) || '');
};

const extractMusinsaProductId = (value?: string) => {
  const raw = normalizeLabel(value);
  if (!raw) {
    return '';
  }
  const direct = raw.match(/^\d{5,}$/);
  if (direct?.[0]) {
    return direct[0];
  }
  const productMatch = raw.match(/\/products\/(\d{5,})/i);
  if (productMatch?.[1]) {
    return productMatch[1];
  }
  const goodsImageMatch = raw.match(/\/goods_img\/(\d{5,})/i);
  if (goodsImageMatch?.[1]) {
    return goodsImageMatch[1];
  }
  const catalogItemMatch = raw.match(/\/catalog\/products\/item-(\d{5,})/i);
  if (catalogItemMatch?.[1]) {
    return catalogItemMatch[1];
  }
  return '';
};

const buildAssetProxyImageUrl = (productId?: string, purchaseUrl?: string, imageUrl?: string) => {
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

const buildHomeImageCandidates = (item: HomeDisplayItem) => {
  const purchaseUrl = normalizeLabel(item.purchaseUrl);
  const rawImage = normalizeLabel(item.imageUrl);
  const nestedImage =
    extractQueryParamFromUrl(purchaseUrl, 'image_url') ||
    extractQueryParamFromUrl(purchaseUrl, 'imageUrl');
  const nestedPurchase =
    extractQueryParamFromUrl(purchaseUrl, 'purchase_url') ||
    extractQueryParamFromUrl(purchaseUrl, 'product_url') ||
    extractQueryParamFromUrl(purchaseUrl, 'purchaseUrl') ||
    extractQueryParamFromUrl(purchaseUrl, 'productUrl');
  const nestedProductId =
    extractQueryParamFromUrl(purchaseUrl, 'product_id') ||
    extractQueryParamFromUrl(purchaseUrl, 'legacy_product_id');

  const productId =
    extractMusinsaProductId(nestedProductId) ||
    extractMusinsaProductId(nestedPurchase) ||
    extractMusinsaProductId(purchaseUrl) ||
    extractMusinsaProductId(rawImage) ||
    extractMusinsaProductId(nestedImage) ||
    extractMusinsaProductId(item.id);

  const musinsaImage = productId
    ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_500.jpg`
    : '';
  const musinsaAltImage = productId
    ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_280.jpg`
    : '';
  const proxyImage = buildAssetProxyImageUrl(
    productId,
    nestedPurchase || purchaseUrl,
    rawImage || nestedImage || musinsaImage,
  );
  const previewImage = buildProductPreviewImage(nestedPurchase || purchaseUrl);

  return Array.from(
    new Set(
      [rawImage, nestedImage, musinsaImage, musinsaAltImage, proxyImage, previewImage]
        .map((value) => normalizeLabel(value))
        .filter((value) => Boolean(value) && !value.startsWith('data:image/svg+xml')),
    ),
  );
};
const buildInlineFallbackSvg = (title: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 960">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#E2E8F0"/>
          <stop offset="100%" stop-color="#CBD5E1"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="46%" dominant-baseline="middle" text-anchor="middle" fill="#334155" font-size="16" font-family="Arial, sans-serif">추천 아이템</text>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#475569" font-size="12" font-family="Arial, sans-serif">${title.slice(0, 20)}</text>
    </svg>`,
  )}`;

const detectCategory = (item: HomeDisplayItem): ProductCategory => {
  if (item.category && item.category !== 'other') {
    const fromDb = normalizeDbCategory(item.category);
    if (fromDb !== 'other') {
      return fromDb;
    }
  }

  const categorySignal = normalizeLabel(`${item.brandLabel || ''} ${item.subtitle || ''} ${item.title || ''}`);
  if (!categorySignal) {
    return 'other';
  }

  return normalizeCategoryFromText(categorySignal);
};

const filterItemsByGender = (
  items: HomeDisplayItem[],
  targetGender?: 'male' | 'female',
): HomeDisplayItem[] => {
  if (!targetGender) {
    return items;
  }

  return items.filter((item) => {
    const normalized = normalizeHomeStyleGender(item.gender);
    if (!normalized) {
      return true;
    }

    return normalized === targetGender;
  });
};

const buildCategoryBuckets = (items: HomeDisplayItem[]): Record<ProductCategory, HomeDisplayItem[]> => {
  const grouped: Record<ProductCategory, HomeDisplayItem[]> = {
    outer: [],
    top: [],
    bottom: [],
    shoes: [],
    accessory: [],
    other: [],
  };

  items.forEach((item) => {
    grouped[detectCategory(item)].push(item);
  });

  return grouped;
};

const pickSetBySlots = (
  items: HomeDisplayItem[],
  used: Set<string>,
): HomeDisplayItem[] => {
  const grouped = buildCategoryBuckets(items);
  const selected: HomeDisplayItem[] = [];
  const remainingByCategory: Record<ProductCategory, HomeDisplayItem[]> = {
    outer: [...grouped.outer],
    top: [...grouped.top],
    bottom: [...grouped.bottom],
    shoes: [...grouped.shoes],
    accessory: [...grouped.accessory],
    other: [...grouped.other],
  };

  const takeFrom = (category: ProductCategory): HomeDisplayItem | null => {
    while (remainingByCategory[category].length > 0) {
      const candidate = remainingByCategory[category].shift() as HomeDisplayItem;
      const key = `${candidate.purchaseUrl || ''}|${candidate.title}`;
      if (used.has(key)) {
        continue;
      }

      selected.push(candidate);
      used.add(key);
      return candidate;
    }
    return null;
  };

  const top = takeFrom('top');
  const bottom = takeFrom('bottom');
  const shoes = takeFrom('shoes');

  if (!top || !bottom || !shoes) {
    const fallbackCategoryPriority: ProductCategory[] = ['outer', 'top', 'bottom', 'shoes', 'accessory', 'other'];

    const takeAny = (category: ProductCategory) => {
      while (remainingByCategory[category].length > 0) {
        const candidate = remainingByCategory[category].shift() as HomeDisplayItem;
        const key = `${candidate.purchaseUrl || ''}|${candidate.title}`;
        if (used.has(key)) {
          continue;
        }

        selected.push(candidate);
        used.add(key);
        break;
      }
    };

    if (top) {
      selected.push(top);
    }
    if (bottom) {
      selected.push(bottom);
    }
    if (shoes) {
      selected.push(shoes);
    }

    fallbackCategoryPriority.forEach((category) => {
      if (selected.length >= 3) {
        return;
      }
      takeAny(category);
    });

    if (selected.length < 3) {
      return [];
    }

    const orderedFallback = selected.filter((item, index, list) =>
      list.findIndex((current) => current === item) === index,
    );

    return orderedFallback;
  }

  const ordered: HomeDisplayItem[] = [];
  const optionalOuter = grouped.outer.length > 0 ? takeFrom('outer') : null;
  const optionalAccessory = grouped.accessory.length > 0 ? takeFrom('accessory') : null;

  if (optionalOuter) {
    ordered.push(optionalOuter);
  }
  ordered.push(top, bottom, shoes);
  if (optionalAccessory) {
    ordered.push(optionalAccessory);
  }

  return ordered;
};

const normalizeSetItemsWithSlots = (rawItems: HomeDisplayItem[], used?: Set<string>): HomeDisplayItem[] => {
  const setUsed = used ?? new Set<string>();
  return pickSetBySlots(rawItems, setUsed);
};

const normalizeHomeSet = (
  set: HomeRecommendationSet,
  index: number,
  targetGender?: 'male' | 'female',
): HomeDisplaySet => ({
  id: set.id || `home-set-${index + 1}`,
  title: set.title || `코디 세트 ${index + 1}`,
  summary: set.summary || '스타일 추천',
  tag: set.tag || 'AI 추천',
  items: (() => {
    const mapped = set.items.map((item: HomeStyleSetItem, itemIndex: number) => {
      const resolvedTitle = normalizeLabel(item.title);
      const resolvedImage = resolveHomeImageUrl(item);
      const resolvedPurchase = resolveHomePurchaseUrl(item);
      const resolvedBrand = normalizeRepeatedWords(resolveHomeBrand(item));
      const isCatalogItem = item.source === 'items' && Boolean(item.id);
      const fallbackPurchase = enrichCatalogPurchaseUrl(
        resolvedPurchase,
        resolvedTitle,
        resolvedBrand,
        item.id,
        item.source,
        undefined,
        normalizeLabel(item.price),
        resolvedPurchase,
        resolvedImage,
        normalizeLabel(item.id),
      );
      const effectivePurchase = isCatalogItem ? fallbackPurchase : (resolvedPurchase || fallbackPurchase);
      const hasImageSource = Boolean(resolvedImage && !isGenericImageUrl(resolvedImage));
      const factualSubtitle = resolvedBrand
        ? `${resolvedBrand} ${resolvedTitle || '상품'}`
        : (resolvedTitle || '상품 상세 보기');

      return {
        id: item.id || `${set.id}-${itemIndex + 1}`,
        title: resolvedTitle || `추천 아이템 ${itemIndex + 1}`,
        subtitle: factualSubtitle,
        imageUrl: hasImageSource
          ? resolvedImage
          : '',
        purchaseUrl: effectivePurchase,
        brandLabel: resolvedBrand ? `브랜드 ${resolvedBrand}` : '브랜드 확인',
        priceLabel: formatPriceText(item.price) || resolveHomePriceLabel(item),
        tag: resolveHomeTag(item),
        category: normalizeDbCategory(item.category),
        gender: item.gender,
      };
    });

    return normalizeSetItemsWithSlots(filterItemsByGender(mapped, targetGender));
  })(),
});

const buildGuestHomeSets = (
  items: RecommendationProduct[],
  targetGender?: 'male' | 'female',
): HomeDisplaySet[] => {
  if (!items.length) {
    return [];
  }

  const converted: HomeDisplayItem[] = items.map((item, index) => {
    const title = normalizeLabel(item.title);
    const subtitle = normalizeLabel(item.description) || title || `추천 아이템 ${index + 1}`;
    const brand = normalizeRepeatedWords(normalizeLabel(item.brand));
    const imageUrl = normalizeLabel(item.imageUrl || item.image_url || '');
    const resolvedPurchase = normalizeLabel(item.purchaseUrl || item.purchase_url || item.link || item.url || '');
    const fallbackPurchase = enrichCatalogPurchaseUrl(
      resolvedPurchase,
      title,
      brand,
      item.id,
      item.source,
      undefined,
      item.price || '',
      resolvedPurchase,
      imageUrl,
      normalizeLabel(item.id),
    );
    const isCatalogItem = item.source === 'items' && Boolean(item.id);
    const purchaseUrl = isCatalogItem ? fallbackPurchase : (resolvedPurchase || fallbackPurchase);

    return {
      id: item.id || `guest-item-${index + 1}`,
      title: title || `추천 아이템 ${index + 1}`,
      subtitle,
      imageUrl,
      purchaseUrl,
      brandLabel: brand ? `브랜드 ${brand}` : '브랜드 확인',
      priceLabel: formatPriceText(item.price) || '가격 확인',
      tag: normalizeLabel(item.source || 'AI 추천') || 'AI 추천',
      category: normalizeDbCategory(item.category),
      gender: item.gender,
    };
  });

  const sets: HomeDisplaySet[] = [];
  const used = new Set<string>();
  const filteredItems = filterItemsByGender(converted, targetGender);
  const sourceItems = filteredItems.length > 0 ? filteredItems : converted;

  if (sourceItems.length === 0) {
    return [];
  }

  for (let i = 0; i < 30; i += 1) {
    const ordered = normalizeSetItemsWithSlots(sourceItems, used);
    if (ordered.length < 3) {
      break;
    }
    const summary = ordered.map((item) => item.title).join(' · ');

    sets.push({
      id: `guest-set-${sets.length + 1}`,
      title: `추천 코디 ${sets.length + 1}`,
      summary,
      tag: 'AI 추천',
      items: ordered,
    });
  }

  return sets;
};

const mergeHomeSets = (primary: HomeDisplaySet[], secondary: HomeDisplaySet[]) => {
  const result: HomeDisplaySet[] = [];
  const seen = new Set<string>();

  [...primary, ...secondary].forEach((entry) => {
    const signature = `${entry.title || 'set'}|${entry.summary || ''}|${entry.items.map((item) => item.title).join('::')}`;
    if (seen.has(signature)) {
      return;
    }

    seen.add(signature);
    result.push(entry);
  });

  return result;
};

const resolveStyleCacheScope = (isAuthenticated: boolean, userId?: string | number) =>
  isAuthenticated && userId ? userId : 'guest';

const resolveProductLabel = (item: HomeDisplayItem) =>
  item.brandLabel && item.brandLabel !== '브랜드 확인' ? `${item.brandLabel.replace(/^브랜드\s*/, '')} ${item.title}` : item.title;

const recommendationSetList = (sets: HomeDisplaySet[]) => sets.map((set) => (
  <article
    key={set.id}
    className="w-[16.25rem] shrink-0 rounded-3xl bg-white p-3 transition-shadow hover:shadow-md sm:w-[17.5rem]"
  >
    <div className="relative h-[17rem] overflow-hidden rounded-2xl bg-slate-100 p-2">
      <div className="grid h-full grid-cols-2 gap-2 overflow-y-auto pr-1">
        {set.items.map((item) => {
          const imageCandidates = buildHomeImageCandidates(item);
          const hasImage = imageCandidates.length > 0 && !isGenericImageUrl(imageCandidates[0]);
          const externalLink = item.purchaseUrl?.startsWith('http') || false;
          return (
            <a
              key={`${set.id}-image-${item.id}`}
              href={item.purchaseUrl}
              target={externalLink ? '_blank' : undefined}
              rel={externalLink ? 'noreferrer' : undefined}
              className="group relative block h-[7.8rem] overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              {hasImage ? (
                <img
                  src={imageCandidates[0]}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  onError={(event) => {
                    const currentIndex = Number(event.currentTarget.dataset.fallbackIndex || '0');
                    const nextIndex = currentIndex + 1;
                    if (nextIndex < imageCandidates.length) {
                      event.currentTarget.dataset.fallbackIndex = String(nextIndex);
                      event.currentTarget.setAttribute('src', imageCandidates[nextIndex]);
                    } else {
                      event.currentTarget.setAttribute('src', buildInlineFallbackSvg(item.title));
                    }
                  }}
                  data-fallback-index="0"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs font-semibold text-slate-500">
                  상품 이미지 준비중
                </div>
              )}
            </a>
          );
        })}
      </div>
      <span className="absolute bottom-3 left-3 rounded-lg bg-black/45 px-3 py-1 text-lg font-semibold text-white backdrop-blur-sm">
        {set.tag}
      </span>
      <button
        type="button"
        className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-900"
        aria-label={`like style ${set.title}`}
      >
        <HeartIcon className="h-6 w-6" />
      </button>
    </div>
    <div className="pt-3">
      <h3 className="text-[1.8rem] font-semibold leading-tight text-gray-900">{set.title}</h3>
      <p className="line-clamp-2 text-base text-slate-600">{set.summary}</p>
      <div className="mt-3 space-y-2">
        {set.items.map((item) => {
          const externalLink = item.purchaseUrl?.startsWith('http') || false;
          return (
            <a
              key={`${set.id}-${item.id}-link`}
              href={item.purchaseUrl}
              target={externalLink ? '_blank' : undefined}
              rel={externalLink ? 'noreferrer' : undefined}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-primary-300 hover:text-primary-700"
            >
              <span className="min-w-0 flex-1 pr-2">
                <span className="block truncate text-sm">{resolveProductLabel(item)}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">
                  {item.subtitle}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  </article>
));

const formatSchedule = (schedule: CalendarScheduleRecord | null) => {
  if (!schedule) {
    return '다가오는 일정이 없습니다.';
  }

  try {
    const dt = new Date(`${schedule.date}T${schedule.time}`);
    return `${dt.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })} ${dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - ${schedule.title}`;
  } catch {
    return `${schedule.date} ${schedule.time} - ${schedule.title}`;
  }
};

const buildHomeStarterQuery = (user?: User | null): string => {
  const profileBits: string[] = [];

  if (user?.personalColor) {
    profileBits.push(`퍼스널컬러 ${user.personalColor}`);
  }

  if (normalizeHomeStyleGender(user?.gender) === 'male') {
    profileBits.push('남성 기준');
  } else if (normalizeHomeStyleGender(user?.gender) === 'female') {
    profileBits.push('여성 기준');
  }

  const ageLabel = getAgeLabel(user?.ageGroup);
  if (ageLabel) {
    profileBits.push(ageLabel);
  }

  const bodyTypeLabel = getBodyTypeLabel(user?.bodyType);
  if (bodyTypeLabel) {
    profileBits.push(bodyTypeLabel);
  }

  const moodLabel = getMoodLabel(user?.styleMoodPreference);
  if (moodLabel) {
    profileBits.push(moodLabel);
  }

  const profileText = profileBits.length > 0 ? `${profileBits.join(', ')} 기준으로 ` : '';
  const season = getCurrentSeasonLabel();
  return `${season} 시즌, ${profileText}상하의/신발이 포함된 코디를 추천해줘.`;
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('HOME_RECOMMEND_TIMEOUT'));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });

const HomePage: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [upcomingSchedule, setUpcomingSchedule] = React.useState<CalendarScheduleRecord | null>(null);
  const [isBootstrappingRecommendations, setIsBootstrappingRecommendations] = React.useState(false);
  const [displayRecommendationSets, setDisplayRecommendationSets] = React.useState<HomeDisplaySet[]>([]);
  const starterRequestRef = React.useRef('');

  const displayName = isAuthenticated ? user?.nickname || '회원' : '게스트';
  const hasValidGender = hasValidStyleGender(user);
  const personalColor = isAuthenticated
    ? user?.personalColor
      ? user.personalColor.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
      : '진단 전'
    : '로그인 후 확인 가능';
  const wardrobeLink = isAuthenticated ? '/style/recommend' : '/login';
  const styleRecommendationLink = isAuthenticated ? '/style/recommend' : '/style/recommend/guest';
  const styleRecommendationsHistoryLink = '/style/recommendations';
  const personalColorLink = isAuthenticated ? '/personal-color' : '/login';
  const calendarLink = isAuthenticated ? '/calendar' : '/login';
  const chatLink = isAuthenticated ? '/chat' : '/login';
  const styleRecommendationButtonLabel = '스타일 추천 받기';

  React.useEffect(() => {
    const bootstrapRecommendations = async () => {
      const starterQuery = buildHomeStarterQuery(isAuthenticated ? user : null);
      const requestKey = `${isAuthenticated ? 'AUTH' : 'GUEST'}:${user?.id || 'ANON'}:${starterQuery}`;
      const hasGuestSession = hasActiveGuestStyleRecommendationSession();
      if (!isAuthenticated && !hasGuestSession) {
        clearGuestStyleRecommendationCache();
      }
      const savedScope = resolveStyleCacheScope(isAuthenticated, user?.id);
      const savedProducts = getLatestRecommendationProducts('style', 30, savedScope);
      const savedGender = isAuthenticated ? normalizeHomeStyleGender(user?.gender) : getGuestStyleRecommendationGender();
      const savedSets = buildGuestHomeSets(savedProducts, savedGender || undefined);
      const cachedPrioritySets = mergeHomeSets(savedSets, []);

      if (starterRequestRef.current === requestKey) {
        return;
      }

      starterRequestRef.current = requestKey;
      setIsBootstrappingRecommendations(true);

      if (cachedPrioritySets.length > 0) {
        setDisplayRecommendationSets(cachedPrioritySets);
      }

      try {
        if (!isAuthenticated) {
          setDisplayRecommendationSets(cachedPrioritySets);
          return;
        }

        const timeoutMs = 12000;
        const request = styleApi.recommendHome(starterQuery, '홈');
        const response = await withTimeout<HomeStyleRecommendationResponse>(request, timeoutMs);

        const incoming = (response.sets || [])
          .map((set, index) => normalizeHomeSet(set, index, hasValidGender ? normalizeHomeStyleGender(user?.gender) : undefined))
          .filter((set) => set.items.length >= 3);
        const mergedIncoming = mergeHomeSets(incoming, cachedPrioritySets);

        if (mergedIncoming.length > 0) {
          setDisplayRecommendationSets(mergedIncoming);
        } else if (cachedPrioritySets.length > 0) {
          setDisplayRecommendationSets(cachedPrioritySets);
        } else {
          setDisplayRecommendationSets([]);
        }
      } catch {
        if (cachedPrioritySets.length > 0) {
          setDisplayRecommendationSets(cachedPrioritySets);
        } else {
          setDisplayRecommendationSets([]);
        }
      } finally {
        setIsBootstrappingRecommendations(false);
      }
    };

    bootstrapRecommendations();
  }, [isAuthenticated, user, hasValidGender]);

  React.useEffect(() => {
    const loadUpcoming = async () => {
      if (!isAuthenticated) {
        setUpcomingSchedule(null);
        return;
      }

      try {
        const schedule = await calendarApi.getUpcomingSchedule();
        setUpcomingSchedule(schedule);
      } catch {
        setUpcomingSchedule(null);
      }
    };

    loadUpcoming();
  }, [isAuthenticated]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-2 animate-reveal">
      <section className="px-1 pt-3 text-center">
        <h1 className="text-[3rem] font-bold leading-[1.02] text-gray-900 sm:text-[3.3rem]">
          안녕하세요, <span className="text-primary-500">{displayName}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl leading-relaxed text-slate-600 sm:text-2xl">
          오늘도 AI 스타일리스트가 가장 잘 어울리는 스타일을 도와드릴게요.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-3xl border border-primary-100 bg-white p-5 shadow-sm">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-500">
            <SwatchIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold tracking-[0.12em] text-slate-500">내 퍼스널 컬러</p>
          <p className="mt-1 text-3xl font-semibold leading-tight text-gray-900">{personalColor}</p>
          {!isAuthenticated && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              퍼스널컬러 진단은 로그인 후 이용 가능합니다.
            </p>
          )}
          <Link
            to={personalColorLink}
            className="mt-5 inline-flex items-center gap-1 text-lg font-semibold text-primary-600 hover:text-primary-700"
          >
            진단 받기
            <span aria-hidden>›</span>
          </Link>
        </article>

        <article className="rounded-3xl border border-primary-100 bg-white p-5 shadow-sm">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CalendarDaysIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold tracking-[0.12em] text-slate-500">다가오는 일정</p>
          <p className="mt-1 text-lg font-semibold leading-tight text-gray-900">
            {formatSchedule(upcomingSchedule)}
          </p>
          <p className="mt-5 text-slate-500">
            {upcomingSchedule ? `${upcomingSchedule.time} 시작` : ''}
          </p>
          <Link
            to={calendarLink}
            className="mt-5 inline-flex items-center gap-1 text-lg font-semibold text-primary-600 hover:text-primary-700"
          >
            달력 보기
            <span aria-hidden>›</span>
          </Link>
        </article>
      </section>

      <section>
        <article className="rounded-3xl border border-primary-100 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-slate-500">스타일 추천</p>
            <p className="mt-2 text-2xl font-semibold leading-tight text-gray-900">
              AI에게 오늘의 코디를 추천받아보세요.
            </p>
            <p className="mt-2 text-lg text-slate-600">
              {isAuthenticated
                ? '저장된 퍼스널컬러와 기본 프로필을 기반으로 맞춤 스타일을 제안해드려요.'
                : '현재는 기본 기준으로 추천하며, 퍼스널컬러 기반 개인화는 로그인 후 제공됩니다.'}
            </p>
          </div>
          <Link
            to={styleRecommendationLink}
            className="mt-5 inline-flex items-center gap-1 text-lg font-semibold text-primary-600 hover:text-primary-700"
          >
            {styleRecommendationButtonLabel}
            <span aria-hidden>›</span>
          </Link>
        </article>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[2rem] font-bold text-gray-900 sm:text-[2.2rem]">내 옷장</h2>
          <Link to={wardrobeLink} className="text-[1.55rem] font-semibold text-primary-600 hover:text-primary-700">
            전체보기
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="aspect-square rounded-2xl border border-slate-300 bg-slate-200" />
          <div className="aspect-square rounded-2xl border border-slate-300 bg-slate-200" />
          <div className="aspect-square rounded-2xl border border-slate-300 bg-slate-200" />
          <Link
            to={wardrobeLink}
            className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-primary-300 bg-primary-50 text-primary-600 transition-colors hover:bg-primary-100"
          >
            <PlusIcon className="h-9 w-9" />
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[2rem] font-bold text-gray-900 sm:text-[2.2rem]">추천 스타일</h2>
          <Link to={styleRecommendationsHistoryLink} className="text-[1.55rem] font-semibold text-primary-600 hover:text-primary-700">
            전체보기
          </Link>
        </div>
        {displayRecommendationSets.length > 0 ? (
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
            {recommendationSetList(displayRecommendationSets)}
          </div>
        ) : (
          <article className="rounded-3xl border border-primary-100 bg-white px-5 py-6 text-slate-700 shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              {isAuthenticated
                ? '추천 스타일이 아직 준비되지 않았습니다.'
                : '스타일 추천을 받아야 추천 코디를 확인할 수 있습니다.'}
            </p>
            <p className="mt-2 text-base text-slate-600">
              {isAuthenticated
                ? hasValidGender
                  ? '현재 홈 추천은 AI 모델 계산 결과를 기반으로 표시됩니다.'
                : `성별을 선택하면 ${styleRecommendationLink}에서 AI 스타일 추천을 진행할 수 있습니다.`
                : '원하신다면 지금 스타일 추천을 받아보세요.'}
            </p>
            {!isBootstrappingRecommendations ? (
              <Link
                to={styleRecommendationLink}
                className="mt-4 inline-flex items-center gap-1 text-base font-semibold text-primary-600 hover:text-primary-700"
              >
                {styleRecommendationButtonLabel}
                <span aria-hidden>›</span>
              </Link>
            ) : null}
          </article>
        )}
      </section>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 p-6 text-white shadow-lg">
        <div className="max-w-[80%]">
          <h3 className="text-[2.25rem] font-bold leading-tight">AI 스타일 상담</h3>
          <p className="mt-3 text-xl leading-relaxed text-primary-100">
            상황에 맞는 코디를 개인 맞춤형으로 추천해드려요.
          </p>
          <Link to={chatLink} className="mt-6 inline-flex">
            <Button
              variant="outline"
              className="h-12 rounded-xl border-white/40 bg-white/95 px-6 text-xl font-semibold text-primary-700 hover:bg-white"
            >
              <ChatBubbleLeftRightIcon className="mr-2 h-5 w-5" />
              상담 시작하기
            </Button>
          </Link>
        </div>
        <div className="pointer-events-none absolute -bottom-4 -right-4 h-36 w-36 rounded-full bg-primary-400/40" />
        <div className="pointer-events-none absolute bottom-8 right-7 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-300/35">
          <ChatBubbleLeftRightIcon className="h-7 w-7 text-white/90" />
        </div>
      </section>
    </div>
  );
};

export default HomePage;
