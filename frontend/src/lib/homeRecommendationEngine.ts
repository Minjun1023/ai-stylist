
import { User } from '../types';
import {
  RecommendationProduct,
  getRecommendationProducts,
  resolveDisplayBrand,
} from './recommendations';
import {
  DEFAULT_BRAND_LABEL,
  BRAND_LABEL_PREFIX,
  DEFAULT_HOME_TAG,
  DEFAULT_PRODUCT_TITLE_PREFIX,
  FALLBACK_DESCRIPTION_PREFIX,
  FALLBACK_ORDER,
  DESCRIPTION_FILTER_KEYWORDS,
  GENERIC_PRICE_LABEL,
  MESSAGES,
  MAX_HOME_SET_COUNT,
  MIN_DESCRIPTION_LENGTH,
  MIN_HOME_GUEST_SET_COUNT,
  MIN_HOME_GUEST_ITEMS,
  MIN_HOME_RECOMMENDATION_DISPLAY_ITEMS,
  MIN_HOME_RECOMMENDATION_ITEMS,
  MIN_HOME_SET_COUNT,
  QUERY_DEFAULT_COUNT,
  QUERY_GENDER_RULES,
  QUERY_REQUIRED_CATEGORIES_NOTE,
  RECOMMENDATION_TITLE_PREFIX,
  REPEATABLE_COORDI_PATTERN,
  REQUIRED_STYLE_SET_CATEGORIES,
  PROFILE_LABELS,
  RECOMMENDATION_SET_SIZE,
  STYLE_CATEGORY_ORDER,
  STARTER_OCCASIONS,
  PRODUCT_URL_PATTERN,
  SET_FILL_ORDER,
  GUEST_PRICE_PREFIX,
  PLACEHOLDER_IMAGE_MARKERS,
  INVALID_SOURCE_LABELS,
  BRAND_INVALID_VALUES,
} from './styleRecommendationConfig';

type SeasonLabel = '봄' | '여름' | '가을' | '겨울';
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

type DisplayProduct = RecommendationProduct & {
  subtitle: string;
  tag: string;
  brandLabel?: string;
  priceLabel?: string;
};

type DisplayRecommendationSet = {
  id: string;
  title: string;
  summary: string;
  tag: string;
  items: DisplayProduct[];
};

const getGenderLabel = (gender?: string) => {
  if (!gender) {
    return '';
  }
  return PROFILE_LABELS.gender[gender] || '';
};

const getAgeLabel = (ageGroup?: string) => {
  return ageGroup ? PROFILE_LABELS.ageGroup[ageGroup] || '' : '';
};

const getBodyTypeLabel = (bodyType?: string) => {
  return bodyType ? PROFILE_LABELS.bodyType[bodyType] || '' : '';
};

const getMoodLabel = (mood?: string) => {
  return mood ? PROFILE_LABELS.mood[mood] || '' : '';
};

const buildStarterRecommendationQuery = (user?: User | null) => {
  const profileTokens = [
    getGenderLabel(user?.gender),
    getAgeLabel(user?.ageGroup),
    getBodyTypeLabel(user?.bodyType),
    getMoodLabel(user?.styleMoodPreference),
  ].filter(Boolean);

  const profileText = profileTokens.length > 0 ? profileTokens.join(', ') : PROFILE_LABELS.defaultProfileLabel;
  const colorText = user?.personalColor
    ? `${PROFILE_LABELS.colorPrefix} ${user.personalColor}`
    : PROFILE_LABELS.defaultColorLabel;
  const genderRule = QUERY_GENDER_RULES[(user?.gender as 'male' | 'female') || 'default'] || QUERY_GENDER_RULES.default;
  return `${getCurrentSeasonLabel()} 기준, ${profileText}, ${colorText} 기준으로 데일리 코디 상품 ${QUERY_DEFAULT_COUNT}개를 추천해줘. ${QUERY_REQUIRED_CATEGORIES_NOTE} ${genderRule}`;
};

const normalizeTag = (source?: string) => {
  if (!source) {
    return DEFAULT_HOME_TAG;
  }
  const value = source.trim();
  if (!value) {
    return DEFAULT_HOME_TAG;
  }
  if (INVALID_SOURCE_LABELS.includes(value.toLowerCase())) {
    return DEFAULT_HOME_TAG;
  }
  return value;
};

const toMusinsaSearchUrl = (query: string) =>
  `https://search.musinsa.com/search/musinsa?query=${encodeURIComponent(query)}`;

const isMusinsaProductDetailUrl = (value?: string) => {
  const trimmed = (value || '').trim().toLowerCase();
  return PRODUCT_URL_PATTERN.test(trimmed);
};

const isInvalidBrand = (value?: string) => {
  if (!value) {
    return true;
  }
  const normalized = value
    .toLowerCase()
    .replace(/[\s\-_.]/g, '');
  if (!normalized) {
    return true;
  }
  return BRAND_INVALID_VALUES.has(normalized);
};

const resolveProductBrand = (item: RecommendationProduct) => {
  const resolved = resolveDisplayBrand(item.brand);
  return isInvalidBrand(resolved) ? undefined : resolved;
};

const resolveProductLabel = (item: RecommendationProduct) =>
  resolveProductBrand(item) ? `${resolveProductBrand(item)} ${item.title}` : item.title;

const isGenericImageUrl = (url?: string) => {
  const value = (url || '').trim().toLowerCase();
  if (!value) {
    return true;
  }
  return PLACEHOLDER_IMAGE_MARKERS.some((marker) => value.includes(marker));
};

const isValidImageUrl = (url?: string) => {
  return !isGenericImageUrl(url);
};

const sanitizeDisplayBrand = (value?: string) => {
  const resolved = resolveDisplayBrand(value);
  if (isInvalidBrand(resolved)) {
    return undefined;
  }
  return resolved;
};

const sanitizeHomeRecommendationText = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const cleaned = value
    .replace(/`/g, '')
    .replace(/["'`]/g, '')
    .replace(/[*_]+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/가격대?\s*가격\s*확인/gi, GENERIC_PRICE_LABEL)
    .trim();

  if (!cleaned) {
    return undefined;
  }

  const tokens = cleaned.split(/\s+/);
  const deduped = tokens.filter((token, index, arr) => token !== arr[index - 1]).join(' ').trim();

  return deduped || undefined;
};

const resolveHomeDescription = (title: string, description: string, brand?: string) => {
  if (isMeaningfulHomeDescription(description, title)) {
    return description;
  }

  if (brand && title) {
    return `${brand} ${title}`;
  }

  if (title) {
    return `${title} 아이템`;
  }

  return MESSAGES.unknownDescriptionFallback;
};

const isMeaningfulHomeDescription = (value?: string, title = '') => {
  if (!value) {
    return false;
  }

  const cleaned = sanitizeHomeRecommendationText(value) || '';
  if (!cleaned || cleaned.length < MIN_DESCRIPTION_LENGTH) {
    return false;
  }

  if (
    DESCRIPTION_FILTER_KEYWORDS.some((token) => cleaned.includes(token)) ||
    REPEATABLE_COORDI_PATTERN.test(cleaned) ||
    /^추천/i.test(cleaned)
  ) {
    return false;
  }

  const normalizedTitle = sanitizeHomeRecommendationText(title) || '';
  if (normalizedTitle && cleaned === normalizedTitle) {
    return false;
  }

  return true;
};

const resolveHomePriceLabel = (item: RecommendationProduct) => {
  if (item.price) {
    return `${GUEST_PRICE_PREFIX} ${item.price}`;
  }

  if (!item.priceRange) {
    return GENERIC_PRICE_LABEL;
  }

  const range = item.priceRange.trim();
  if (/가격\s*확인/.test(range)) {
    return GENERIC_PRICE_LABEL;
  }

  return `가격대 ${range}`;
};

const normalizeDisplayProduct = (item: RecommendationProduct, index: number): DisplayProduct => {
  const title = sanitizeHomeRecommendationText(item.title) || `${DEFAULT_PRODUCT_TITLE_PREFIX} ${index + 1}`;
  const brand = resolveProductBrand(item);
  const imageUrl = isGenericImageUrl(item.imageUrl) ? '' : item.imageUrl;
  const purchaseUrl = isMusinsaProductDetailUrl(item.purchaseUrl)
    ? item.purchaseUrl
    : isMusinsaProductUrl(item.purchaseUrl)
      ? item.purchaseUrl
      : toMusinsaSearchUrl(item.title || title);

  return {
    ...item,
    title,
    brand,
    imageUrl,
    purchaseUrl,
    subtitle: sanitizeHomeRecommendationText(item.description) || `${FALLBACK_DESCRIPTION_PREFIX} ${index + 1}`,
    tag: normalizeTag(item.source),
    brandLabel: brand ? `${BRAND_LABEL_PREFIX} ${brand}` : DEFAULT_BRAND_LABEL,
    priceLabel: resolveHomePriceLabel({ ...item, title }),
  };
};

const toHomeDisplayItem = (item: RecommendationProduct, index: number): DisplayProduct => {
  const normalized = normalizeDisplayProduct(item, index);
  const resolvedBrand =
    sanitizeDisplayBrand(normalized.brand) ||
    sanitizeDisplayBrand(item.brand) ||
    sanitizeDisplayBrand(item.title) ||
    sanitizeDisplayBrand(item.description) ||
    sanitizeDisplayBrand(normalized.title) ||
    sanitizeDisplayBrand(normalized.subtitle);
  const title = sanitizeHomeRecommendationText(normalized.title) || `${DEFAULT_PRODUCT_TITLE_PREFIX} ${index + 1}`;
  const resolvedDescription = resolveHomeDescription(title, normalized.subtitle || item.description || '', resolvedBrand);

  return {
    ...normalized,
    title,
    brand: resolvedBrand,
    subtitle: resolvedDescription,
    brandLabel: resolvedBrand ? `${BRAND_LABEL_PREFIX} ${resolvedBrand}` : DEFAULT_BRAND_LABEL,
  };
};

const isGuestDisplayUsable = (item: DisplayProduct) => {
  if (!item.title || item.title.length < 2) {
    return false;
  }

  if (!isValidImageUrl(item.imageUrl)) {
    return false;
  }

  if (!isMusinsaProductUrl(item.purchaseUrl)) {
    return false;
  }

  if (!isMeaningfulHomeDescription(item.description, item.title) && !isMeaningfulHomeDescription(item.subtitle, item.title)) {
    return false;
  }

  return true;
};

const dedupeRecommendationItems = (items: RecommendationProduct[]): RecommendationProduct[] => {
  const seen = new Set<string>();
  const deduped: RecommendationProduct[] = [];

  items.forEach((item) => {
    const key = toRecommendationKey(item);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(item);
  });

  return deduped;
};

const isUsableRecommendationPayload = (items: RecommendationProduct[]): boolean => {
  const dedupedItems = dedupeRecommendationItems(items);
  if (dedupedItems.length < MIN_HOME_RECOMMENDATION_DISPLAY_ITEMS) {
    return false;
  }

  if (
    dedupedItems.filter((item) => isMusinsaProductDetailUrl(item.purchaseUrl)).length <
    MIN_HOME_RECOMMENDATION_DISPLAY_ITEMS
  ) {
    return false;
  }

  if (
    dedupedItems.filter((item) => !isGenericImageUrl(item.imageUrl || item.image_url)).length <
    MIN_HOME_RECOMMENDATION_DISPLAY_ITEMS
  ) {
    return false;
  }

  const hasRequiredCategory = (category: ProductCategory) =>
    dedupedItems.some((item) =>
      detectCategory({ ...item, subtitle: '', tag: '', brandLabel: '', priceLabel: '' } as DisplayProduct) === category,
    );

  if (!hasRequiredCategory('top') || !hasRequiredCategory('bottom') || !hasRequiredCategory('shoes')) {
    return false;
  }

  const descriptionQualified = dedupedItems.filter((item) =>
    isMeaningfulHomeDescription(item.description, item.title),
  ).length;
  if (descriptionQualified < MIN_HOME_RECOMMENDATION_DISPLAY_ITEMS) {
    return false;
  }

  return dedupedItems.every((item) => {
    const title = (item.title || '').trim();
    return title.length >= 2 && !/(코디\s*){2,}/i.test(title);
  });
};

const toRecommendationKey = (item: RecommendationProduct) => {
  const normalizeUrl = (value?: string) => {
    const trimmed = (value || '').trim().toLowerCase();
    if (!trimmed) {
      return '';
    }
    return trimmed.split('?')[0].replace(/\/$/, '');
  };

  const purchaseUrl = normalizeUrl(item.purchaseUrl || item.link || item.url);
  if (purchaseUrl) {
    return `url:${purchaseUrl}`;
  }

  const imageUrl = normalizeUrl(item.imageUrl || item.image_url || (item as { thumbnail?: string }).thumbnail);
  const title = (item.title || '').trim().toLowerCase();
  const brand = (item.brand || '').trim().toLowerCase();

  return [title, imageUrl, brand].filter(Boolean).join('|') || `item:${(item as { id?: string }).id || title}`;
};

const pickDisplayRecommendations = (isAuthenticated: boolean, user?: User | null): DisplayProduct[] => {
  const fallback: DisplayProduct[] = [];

  if (!isAuthenticated) {
    const guestPersisted = getRecommendationProducts(undefined, MIN_HOME_RECOMMENDATION_ITEMS);
    const guestItems = guestPersisted
      .map((item, index) => toHomeDisplayItem(item, index))
      .filter(isGuestDisplayUsable);
    if (guestItems.length >= MIN_HOME_GUEST_ITEMS) {
      return guestItems.slice(0, MIN_HOME_RECOMMENDATION_ITEMS);
    }

    return fallback;
  }

  const persisted = getRecommendationProducts(undefined, MIN_HOME_RECOMMENDATION_ITEMS, user?.id);
  if (!isUsableRecommendationPayload(persisted)) {
    return fallback;
  }

  const persistedDisplay = persisted.map((item, index) => toHomeDisplayItem(item, index));
  return persistedDisplay;
};

const isMusinsaProductUrl = (url?: string) => PRODUCT_URL_PATTERN.test(url || '');

type ProductCategory = (typeof STYLE_CATEGORY_ORDER)[number];
const REQUIRED_SET_CATEGORIES: ProductCategory[] = [...REQUIRED_STYLE_SET_CATEGORIES] as ProductCategory[];
const DISPLAY_CATEGORY_ORDER: ProductCategory[] = [...STYLE_CATEGORY_ORDER] as ProductCategory[];

const normalizeCategory = (value?: string) => {
  if (!value) {
    return '';
  }

  return value
    .toLowerCase()
    .replace(/[\s\-_/.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeCategoryFromDb = (value?: string): ProductCategory | undefined => {
  const normalized = normalizeCategory(value);
  if (!normalized) {
    return undefined;
  }

  if (['top', '상의'].includes(normalized)) {
    return 'top';
  }
  if (
    ['bottom', '하의', 'pants', '팬츠', 'bottoms', '바지', '치마', '스커트', '하의/치마', '하의 스커트'].includes(normalized)
  ) {
    return 'bottom';
  }
  if (['shoes', '신발', 'sneakers', '부츠', '운동화', 'boots', 'sneaker'].includes(normalized)) {
    return 'shoes';
  }
  if (
    ['outer', '아우터', '상의아우터', 'outerwear', 'outerwears', '재킷', '자켓', '코트', '점퍼', '블레이저', '패딩', '집업', 'jacket', 'coat']
      .includes(normalized)
  ) {
    return 'outer';
  }
  if (['accessory', '악세서리', '액세서리'].includes(normalized)) {
    return 'accessory';
  }

  return undefined;
};

const orderSetItems = (items: DisplayProduct[]) => {
  const grouped: Record<ProductCategory, DisplayProduct[]> = {
    top: [],
    bottom: [],
    shoes: [],
    outer: [],
    accessory: [],
    other: [],
  };

  items.forEach((item) => {
    grouped[detectCategory(item)].push(item);
  });

  const used = new Set<string>();
  const ordered: DisplayProduct[] = [];

  DISPLAY_CATEGORY_ORDER.forEach((category) => {
    grouped[category].forEach((item) => {
      const key = toRecommendationKey(item);
      if (!used.has(key)) {
        used.add(key);
        ordered.push(item);
      }
    });
  });

  const missing = items.filter((item) => !used.has(toRecommendationKey(item)));
  return [...ordered, ...missing];
};

const detectCategory = (item: DisplayProduct): ProductCategory => {
  const fromDbCategory = normalizeCategoryFromDb(item.category);
  if (fromDbCategory) {
    return fromDbCategory;
  }
  return 'other';
};

const buildRecommendationSets = (items: DisplayProduct[]): DisplayRecommendationSet[] => {
  const chunkSize = RECOMMENDATION_SET_SIZE;
  const sets: DisplayRecommendationSet[] = [];
  const seen = new Set<string>();
  const uniqueItems: DisplayProduct[] = [];

  items.forEach((item) => {
    const key = toRecommendationKey(item);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    uniqueItems.push(item);
  });

  if (uniqueItems.length === 0) {
    return [];
  }

  const categoryBuckets: Record<ProductCategory, DisplayProduct[]> = {
    top: [],
    bottom: [],
    shoes: [],
    outer: [],
    accessory: [],
    other: [],
  };

  uniqueItems.forEach((item) => {
    categoryBuckets[detectCategory(item)].push(item);
  });

  const used = new Set<string>();
  const usedSetSignatures = new Set<string>();
  const pickCandidate = (
    categories: ProductCategory[],
    exclude: Set<string>,
    allowUsed: boolean,
    rotationOffset = 0,
  ) => {
    const normalizeOffset = (length: number) => ((rotationOffset % length) + length) % length;
    for (const category of categories) {
      const candidates = categoryBuckets[category];
      const start = normalizeOffset(candidates.length);
      for (let index = 0; index < candidates.length; index += 1) {
        const item = candidates[(start + index) % candidates.length];
        const key = toRecommendationKey(item);
        if (exclude.has(key)) {
          continue;
        }
        if (allowUsed || !used.has(key)) {
          return item;
        }
      }
    }
    return null;
  };

  const pickAnyCandidate = (exclude: Set<string>, allowUsed: boolean, rotationOffset = 0) => {
    const start = uniqueItems.length ? ((rotationOffset % uniqueItems.length) + uniqueItems.length) % uniqueItems.length : 0;
    for (let index = 0; index < uniqueItems.length; index += 1) {
      const item = uniqueItems[(start + index) % uniqueItems.length];
      const key = toRecommendationKey(item);
      if (exclude.has(key)) {
        continue;
      }
      if (!allowUsed && used.has(key)) {
        continue;
      }
      return item;
    }
    return null;
  };

  const ensureCategoryInSet = (
    setItems: DisplayProduct[],
    setItemKeys: Set<string>,
    requiredCategory: ProductCategory,
    allowReuse = false,
  ) => {
    if (setItems.some((item) => detectCategory(item) === requiredCategory)) {
      return;
    }

    const requiredCandidate = pickCandidate([requiredCategory], setItemKeys, allowReuse);
    if (!requiredCandidate) {
      return;
    }

    if (setItems.length < chunkSize) {
      setItems.push(requiredCandidate);
      setItemKeys.add(toRecommendationKey(requiredCandidate));
      used.add(toRecommendationKey(requiredCandidate));
      return;
    }

    const replaceIndex = setItemKeys.has(toRecommendationKey(requiredCandidate))
      ? -1
      : setItems.findIndex((item) => !REQUIRED_SET_CATEGORIES.includes(detectCategory(item)));

    if (replaceIndex >= 0) {
      const replacedItem = setItems[replaceIndex];
      const replacedKey = toRecommendationKey(replacedItem);
      setItemKeys.delete(replacedKey);
      setItems.splice(replaceIndex, 1);

      setItemKeys.add(toRecommendationKey(requiredCandidate));
      setItems.push(requiredCandidate);
    }
  };

  const makeCategorySignature = (setItems: DisplayProduct[]) => {
    const pickByCategory = (category: ProductCategory) => {
      const item = setItems.find((candidate) => detectCategory(candidate) === category);
      return item ? toRecommendationKey(item) : `missing:${category}`;
    };

    return REQUIRED_SET_CATEGORIES.map((category) => pickByCategory(category)).join('|');
  };

  const hasCategory = (list: DisplayProduct[], category: ProductCategory) =>
    list.some((item) => detectCategory(item) === category);

  const possibleSetCount = Math.floor(uniqueItems.length / chunkSize);
  const targetSetCount = Math.min(MAX_HOME_SET_COUNT, Math.max(MIN_HOME_SET_COUNT, possibleSetCount));

  const buildFallbackSet = (setNo: number, usedSignatures: Set<string>) => {
    const attemptSet = (rotationSeed: number) => {
      const fallbackSetItems: DisplayProduct[] = [];
      const fallbackSetKeys = new Set<string>();
      const appendUnique = (candidate: DisplayProduct | null) => {
        if (!candidate) {
          return;
        }
        const key = toRecommendationKey(candidate);
        if (fallbackSetKeys.has(key)) {
          return;
        }
        fallbackSetKeys.add(key);
        fallbackSetItems.push(candidate);
      };

      const pickFromCategory = (category: ProductCategory, innerSeed: number) => {
        return pickCandidate([category], fallbackSetKeys, true, innerSeed);
      };

      FALLBACK_ORDER.forEach((category, idx) => {
        const requiredCategory = category as ProductCategory;
        appendUnique(pickFromCategory(requiredCategory, rotationSeed + idx));
      });

      const orderedSeedCategories: ProductCategory[] = SET_FILL_ORDER as ProductCategory[];
      orderedSeedCategories.forEach((category, idx) => {
        if (fallbackSetItems.length >= chunkSize) {
          return;
        }
        appendUnique(pickCandidate([category], fallbackSetKeys, true, rotationSeed + idx + 3));
      });

      while (fallbackSetItems.length < chunkSize) {
        const candidate = pickAnyCandidate(fallbackSetKeys, true, rotationSeed);
        if (!candidate) {
          break;
        }
        appendUnique(candidate);
      }

      const orderedItems = orderSetItems(fallbackSetItems).slice(0, chunkSize);
      if (orderedItems.length < chunkSize) {
        return null;
      }

      const signature = makeCategorySignature(orderedItems);
      if (usedSignatures.has(signature)) {
        return null;
      }

      return {
        id: `set-fallback-${setNo}-${orderedItems.map((item) => toRecommendationKey(item)).join('-')}`,
        title: `${RECOMMENDATION_TITLE_PREFIX} ${setNo}`,
        summary: orderedItems.map((item) => resolveProductLabel(item)).join(' · '),
        tag: orderedItems[0]?.tag || DEFAULT_HOME_TAG,
        items: orderedItems,
        signature,
      };
    };

    const maxAttempts = Math.max(1, uniqueItems.length);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const rotationSeed = setNo + attempt * 2;
      const built = attemptSet(rotationSeed);
      if (built) {
        return built;
      }
    }

    return null;
  };

  for (let index = 0; index < targetSetCount; index += 1) {
    const setItems: DisplayProduct[] = [];
    const setItemKeys = new Set<string>();
    const allowReuseAcrossSets = index > 0;

    const pushIfUnique = (candidate: DisplayProduct | null, allowUsed = false) => {
      if (!candidate) {
        return;
      }
      const candidateKey = toRecommendationKey(candidate);
      if (setItemKeys.has(candidateKey)) {
        return;
      }
      if (!allowUsed && used.has(candidateKey)) {
        return;
      }
      used.add(candidateKey);
      setItemKeys.add(candidateKey);
      setItems.push(candidate);
    };

    pushIfUnique(pickCandidate(DISPLAY_CATEGORY_ORDER, setItemKeys, !allowReuseAcrossSets, index), allowReuseAcrossSets);
    pushIfUnique(pickCandidate(DISPLAY_CATEGORY_ORDER.slice(1), setItemKeys, !allowReuseAcrossSets, index + 1), allowReuseAcrossSets);
    pushIfUnique(pickCandidate(DISPLAY_CATEGORY_ORDER.slice(2), setItemKeys, !allowReuseAcrossSets, index + 2), allowReuseAcrossSets);

    while (setItems.length < chunkSize) {
      const extra = pickCandidate(SET_FILL_ORDER as ProductCategory[], setItemKeys, !allowReuseAcrossSets, index + 3);
      if (!extra) {
        break;
      }
      pushIfUnique(extra, allowReuseAcrossSets);
    }

    for (const requiredCategory of REQUIRED_SET_CATEGORIES) {
      ensureCategoryInSet(setItems, setItemKeys, requiredCategory, false);
      if (!hasCategory(setItems, requiredCategory)) {
        ensureCategoryInSet(setItems, setItemKeys, requiredCategory, true);
      }
    }

    while (setItems.length < chunkSize) {
      const fillCandidate = pickAnyCandidate(setItemKeys, allowReuseAcrossSets, index + 5);
      if (!fillCandidate) {
        break;
      }
      pushIfUnique(fillCandidate, true);
    }

    for (const requiredCategory of REQUIRED_SET_CATEGORIES) {
      if (hasCategory(setItems, requiredCategory)) {
        continue;
      }

      const requiredCandidate = pickCandidate([requiredCategory], setItemKeys, true);
      if (!requiredCandidate) {
        continue;
      }

      const replaceIndex = setItems.findIndex((item) => !REQUIRED_SET_CATEGORIES.includes(detectCategory(item)));
      if (replaceIndex >= 0) {
        const oldKey = toRecommendationKey(setItems[replaceIndex]);
        setItemKeys.delete(oldKey);
        setItems[replaceIndex] = requiredCandidate;
        setItemKeys.add(toRecommendationKey(requiredCandidate));
      }
    }

    const missingCategory = REQUIRED_SET_CATEGORIES.find((requiredCategory) => !hasCategory(setItems, requiredCategory));
    if (missingCategory) {
      continue;
    }

    if (setItems.length < chunkSize) {
      const fallbackSet = buildFallbackSet(index + 1, usedSetSignatures);
      if (fallbackSet) {
        sets.push(fallbackSet);
        usedSetSignatures.add(fallbackSet.signature);
      }
      continue;
    }

    const signature = makeCategorySignature(setItems);
    if (usedSetSignatures.has(signature)) {
      const fallbackSet = buildFallbackSet(index + 1, usedSetSignatures);
      if (fallbackSet && !usedSetSignatures.has(fallbackSet.signature)) {
        usedSetSignatures.add(fallbackSet.signature);
        sets.push(fallbackSet);
      }
      continue;
    }

    const setNo = index + 1;
    usedSetSignatures.add(signature);
    const orderedItems = orderSetItems(setItems).slice(0, chunkSize);
    sets.push({
      id: `set-${setNo}-${setItems.map((item) => toRecommendationKey(item)).join('-')}`,
      title: `${RECOMMENDATION_TITLE_PREFIX} ${setNo}`,
      summary: orderedItems.map((item) => resolveProductLabel(item)).join(' · '),
      tag: orderedItems[0].tag,
      items: orderedItems,
    });
  }

  if (sets.length === 0) {
    const fallbackSet = buildFallbackSet(1, usedSetSignatures);
    if (fallbackSet) {
      usedSetSignatures.add(fallbackSet.signature);
      sets.push(fallbackSet);
    }
  }

  while (sets.length < targetSetCount) {
    const fallbackSet = buildFallbackSet(sets.length + 1, usedSetSignatures);
    if (!fallbackSet) {
      break;
    }
    if (usedSetSignatures.has(fallbackSet.signature)) {
      break;
    }
    usedSetSignatures.add(fallbackSet.signature);
    sets.push(fallbackSet);
  }

  return sets;
};

export {
  RECOMMENDATION_SET_SIZE,
  MAX_HOME_SET_COUNT,
  MIN_HOME_SET_COUNT,
  MIN_HOME_GUEST_SET_COUNT,
  MIN_HOME_GUEST_ITEMS,
  MIN_HOME_RECOMMENDATION_ITEMS,
  MIN_HOME_RECOMMENDATION_DISPLAY_ITEMS,
  STARTER_OCCASIONS,
  buildStarterRecommendationQuery,
  isUsableRecommendationPayload,
  pickDisplayRecommendations,
  buildRecommendationSets,
  normalizeDisplayProduct,
  toHomeDisplayItem,
  toRecommendationKey,
  isGenericImageUrl,
  resolveProductLabel,
};

export type { DisplayProduct, DisplayRecommendationSet, ProductCategory, SeasonLabel };
