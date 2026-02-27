
import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { findRecommendationProductBySku, getRecommendationProducts } from '../lib/recommendations';

const buildSeedImage = (seed: string) =>
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
      <text x="320" y="300" text-anchor="middle" fill="#334155" font-size="24" font-family="Arial, sans-serif">PRODUCT DETAIL</text>
      <text x="320" y="360" text-anchor="middle" fill="#64748B" font-size="18" font-family="Arial, sans-serif">${(seed || 'item').slice(0, 24)}</text>
    </svg>`,
  )}`;

const categoryLabelMap: Record<string, string> = {
  top: '상의',
  bottom: '하의',
  shoes: '신발',
  accessory: '악세서리',
  outer: '아우터',
  other: '아이템',
};

const isHttpUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

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

const CATEGORY_PRODUCT_IDS: Record<string, string[]> = {
  top: ['5206701', '1115974', '5114562'],
  bottom: ['4746813', '2270183', '5973740'],
  shoes: ['1841217'],
  accessory: ['1012143', '1618207'],
  outer: ['2778674'],
  other: SAMPLE_MUSINSA_PRODUCT_IDS,
};

const toStableHash = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const inferCategoryForFallback = (category: string, title: string, description: string): keyof typeof CATEGORY_PRODUCT_IDS => {
  const direct = (category || '').toLowerCase();
  if (direct in CATEGORY_PRODUCT_IDS) {
    return direct as keyof typeof CATEGORY_PRODUCT_IDS;
  }
  const text = `${title} ${description}`.toLowerCase();
  if (/(워커|부츠|스니커즈|운동화|로퍼|슈즈|신발|shoe|sneaker|boots)/i.test(text)) {
    return 'shoes';
  }
  if (/(팬츠|슬랙스|데님|청바지|치노|바지|bottom|pants|jeans)/i.test(text)) {
    return 'bottom';
  }
  if (/(셔츠|티셔츠|니트|맨투맨|후드|블라우스|탑|top|shirt|tee|knit)/i.test(text)) {
    return 'top';
  }
  if (/(코트|자켓|재킷|점퍼|아우터|outer|coat|jacket)/i.test(text)) {
    return 'outer';
  }
  if (/(가방|백|모자|캡|벨트|파우치|시계|accessory|bag|cap|belt)/i.test(text)) {
    return 'accessory';
  }
  return 'other';
};

const resolveFallbackMusinsaProductId = (seed: string, category: string, title: string, description: string) => {
  const resolvedCategory = inferCategoryForFallback(category, title, description);
  const pool = CATEGORY_PRODUCT_IDS[resolvedCategory] || SAMPLE_MUSINSA_PRODUCT_IDS;
  const hash = toStableHash(seed || 'aistylist');
  return pool[hash % pool.length];
};

const extractMusinsaProductId = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  const direct = trimmed.match(/^\d{5,}$/);
  if (direct?.[0]) {
    return direct[0];
  }
  const fromPath = trimmed.match(/\/products\/(\d{5,})/i);
  if (fromPath?.[1]) {
    return fromPath[1];
  }
  return '';
};

const extractNestedParamFromCatalogUrl = (value?: string | null, key?: string) => {
  if (!value || !key) {
    return '';
  }
  const raw = value.trim();
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0) {
    return '';
  }
  const query = raw.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  return (params.get(key) || '').trim();
};

const toMusinsaProductUrl = (productId: string) =>
  productId ? `https://www.musinsa.com/products/${productId}` : '';
const toMusinsaImageUrl = (productId: string) =>
  productId ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_500.jpg` : '';
const toMusinsaImageAltUrl = (productId: string) =>
  productId ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_500.jpg?fit=inside|768:1000` : '';
const toMusinsaImageSmallUrl = (productId: string) =>
  productId ? `https://image.msscdn.net/images/goods_img/${productId}/${productId}_1_280.jpg` : '';

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8080`;
const toProxyImageUrl = (productId: string, productUrl: string, imageUrl: string) => {
  const params = new URLSearchParams();
  if (productId) {
    params.set('productId', productId);
  }
  if (productUrl) {
    params.set('url', productUrl);
  }
  if (imageUrl) {
    params.set('imageUrl', imageUrl);
  }
  return `${API_BASE_URL}/api/assets/image?${params.toString()}`;
};

type LivePriceResponse = {
  success?: boolean;
  price?: string;
  value?: number | null;
  sourceUrl?: string;
};

const ProductDetailPage: React.FC = () => {
  const { sku = '' } = useParams<{ sku: string }>();
  const { search } = useLocation();
  const navigate = useNavigate();
  const params = React.useMemo(() => new URLSearchParams(search), [search]);

  const fallbackFromStorage = React.useMemo(() => {
    const fromStorage = findRecommendationProductBySku(sku);
    if (fromStorage) {
      return fromStorage;
    }

    const all = getRecommendationProducts(undefined, 200);
    return all.find((item) => (item.purchaseUrl || '').includes(`/catalog/products/${sku}`));
  }, [sku]);

  const title = params.get('title') || fallbackFromStorage?.title || `${sku} 상품`;
  const brand = params.get('brand') || fallbackFromStorage?.brand || '브랜드 정보 없음';
  const description = params.get('description') || fallbackFromStorage?.description || `${title} 상품 상세 정보`;
  const category = params.get('category') || 'other';
  const queryImageUrl = params.get('image_url') || params.get('imageUrl') || '';
  const querySaleUrl =
    params.get('product_url') ||
    params.get('productUrl') ||
    params.get('purchase_url') ||
    params.get('purchaseUrl') ||
    '';
  const storageSaleUrl = fallbackFromStorage?.purchaseUrl || '';
  const storageImageUrl = fallbackFromStorage?.imageUrl || '';
  const nestedImageUrlFromStorage = extractNestedParamFromCatalogUrl(storageSaleUrl, 'image_url');
  const nestedSaleUrlFromStorage = extractNestedParamFromCatalogUrl(storageSaleUrl, 'purchase_url');
  const nestedProductIdFromStorage = extractNestedParamFromCatalogUrl(storageSaleUrl, 'product_id');
  const legacyProductId = params.get('legacy_product_id') || params.get('product_id') || '';
  const detectedMusinsaProductId =
    extractMusinsaProductId(querySaleUrl) ||
    extractMusinsaProductId(nestedSaleUrlFromStorage) ||
    extractMusinsaProductId(storageSaleUrl) ||
    extractMusinsaProductId(nestedProductIdFromStorage) ||
    extractMusinsaProductId(legacyProductId) ||
    extractMusinsaProductId(sku);
  const musinsaProductId =
    detectedMusinsaProductId ||
    resolveFallbackMusinsaProductId(`${sku}|${title}|${brand}`, category, title, description);
  const saleUrl = isHttpUrl(querySaleUrl)
    ? querySaleUrl
    : isHttpUrl(nestedSaleUrlFromStorage)
      ? nestedSaleUrlFromStorage
    : isHttpUrl(storageSaleUrl)
      ? storageSaleUrl
      : toMusinsaProductUrl(musinsaProductId);

  const preferredImageUrl = queryImageUrl && queryImageUrl.trim()
    ? queryImageUrl
    : (nestedImageUrlFromStorage && !nestedImageUrlFromStorage.startsWith('data:image/svg+xml')
        ? nestedImageUrlFromStorage
        : (storageImageUrl && !storageImageUrl.startsWith('data:image/svg+xml')
            ? storageImageUrl
            : ''));
  const imageCandidates = React.useMemo<string[]>(() => {
    const candidatePool = [
      preferredImageUrl,
      toMusinsaImageUrl(musinsaProductId),
      toMusinsaImageAltUrl(musinsaProductId),
      toMusinsaImageSmallUrl(musinsaProductId),
      toProxyImageUrl(musinsaProductId, saleUrl, preferredImageUrl),
    ].filter((url) => typeof url === 'string' && url.trim().length > 0);

    return Array.from(new Set<string>(candidatePool));
  }, [preferredImageUrl, musinsaProductId, saleUrl]);
  const [imageCandidateIndex, setImageCandidateIndex] = React.useState(0);
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);
  const [livePriceLabel, setLivePriceLabel] = React.useState('실시간 가격 조회 중...');
  const currentImageUrl = imageCandidates[imageCandidateIndex] || buildSeedImage(`${sku}-${title}`);
  const displayPrice = livePriceLabel;

  React.useEffect(() => {
    setImageCandidateIndex(0);
    setImageLoadFailed(false);
  }, [imageCandidates, sku, title]);

  React.useEffect(() => {
    const controller = new AbortController();
    const fetchLivePrice = async () => {
      try {
        setLivePriceLabel('실시간 가격 조회 중...');
        const params = new URLSearchParams();
        if (musinsaProductId) {
          params.set('productId', musinsaProductId);
        }
        if (saleUrl) {
          params.set('url', saleUrl);
        }
        const endpoint = `${API_BASE_URL}/api/assets/price?${params.toString()}`;
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          setLivePriceLabel('실시간 가격은 판매 페이지에서 확인');
          return;
        }
        const payload = (await response.json()) as LivePriceResponse;
        if (payload?.success && payload?.price) {
          setLivePriceLabel(payload.price);
          return;
        }
        setLivePriceLabel('실시간 가격은 판매 페이지에서 확인');
      } catch (error) {
        if ((error as { name?: string }).name !== 'AbortError') {
          setLivePriceLabel('실시간 가격은 판매 페이지에서 확인');
        }
      }
    };

    fetchLivePrice();
    return () => controller.abort();
  }, [musinsaProductId, saleUrl]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary-300 hover:text-primary-700"
      >
        이전으로
      </button>

      <article className="grid gap-5 rounded-3xl border border-primary-100 bg-white p-5 shadow-sm md:grid-cols-[1fr_1.1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {imageLoadFailed ? (
            <div className="flex h-full min-h-[24rem] w-full flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-sm font-semibold text-slate-500">이미지를 불러오지 못했습니다.</p>
              {saleUrl ? (
                <a
                  href={saleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  판매 페이지에서 확인
                </a>
              ) : (
                <p className="text-sm text-slate-500">판매 링크 정보가 없습니다.</p>
              )}
            </div>
          ) : (
            <img
              key={currentImageUrl}
              src={currentImageUrl}
              alt={title}
              className="h-full w-full object-cover"
              onError={() => {
                setImageCandidateIndex((prevIndex) => {
                  const nextIndex = prevIndex + 1;
                  if (nextIndex < imageCandidates.length) {
                    return nextIndex;
                  }
                  setImageLoadFailed(true);
                  return prevIndex;
                });
              }}
            />
          )}
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold tracking-[0.12em] text-slate-500">상품 상세</p>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-lg text-slate-600">{description}</p>

          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-900">브랜드</span>: {brand}</p>
            <p><span className="font-semibold text-slate-900">카테고리</span>: {categoryLabelMap[category] || '아이템'}</p>
            <p><span className="font-semibold text-slate-900">가격</span>: {displayPrice}</p>
            <p><span className="font-semibold text-slate-900">상품 코드</span>: {sku}</p>
            <p><span className="font-semibold text-slate-900">판매 링크</span>: {saleUrl || '링크 정보 없음'}</p>
          </div>

          {saleUrl && (
            <a
              href={saleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              상품 판매 페이지 이동
            </a>
          )}
        </div>
      </article>
    </div>
  );
};

export default ProductDetailPage;
