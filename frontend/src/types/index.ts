export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

export interface User {
  id: number;
  email: string;
  nickname: string;
  personalColor?: string;
  gender?: 'male' | 'female' | 'undisclosed';
  ageGroup?: 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus';
  bodyType?: 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus';
  styleMoodPreference?: 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic';
  styleProfileCompleted?: boolean;
  personalColorCompleted?: boolean;
  chatProfileCompleted?: boolean;
  styleRecommendationCompleted?: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
  gender: 'male' | 'female';
  ageGroup: 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus';
  bodyType: 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus';
  styleMoodPreference: 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic';
  emailVerificationCode: string;
}

export interface RecommendationProduct {
  id?: string;
  title: string;
  gender?: string;
  category?: string;
  tags?: string[];
  description?: string;
  imageUrl?: string;
  image_url?: string;
  purchaseUrl?: string;
  purchase_url?: string;
  link?: string;
  url?: string;
  source?: string;
  brand?: string;
  price?: string;
  price_range?: string;
  priceRange?: string;
  sourceType?: string;
}

export interface ColorPalette {
  primary_colors: string[];
  secondary_colors: string[];
  avoid_colors: string[];
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface PersonalColorResult {
  id?: number;
  colorType: string;
  confidence: number;
  method: 'SURVEY' | 'IMAGE' | 'HYBRID';
  imageUrl?: string;
  description?: string;
  palette?: ColorPalette;
  stylingTips?: string[];
  evidence?: string[];
  needsFollowUp?: boolean;
  followUpQuestions?: FollowUpQuestion[];
  createdAt: string;
}

export interface SurveyAnswers {
  [key: string]: string;
}

export interface ChatMessage {
  sessionId: number;
  messageId: number;
  role: 'user' | 'assistant';
  content: string;
  items?: RecommendationProduct[];
  sources?: string[];
  createdAt: string;
}

export interface ChatSession {
  id: number;
  title: string;
  createdAt: string;
  messages?: ChatMessage[];
}

export interface StyleRecommendation {
  recommendation: string;
  items: RecommendationProduct[];
  sources: string[];
  personalColor?: string;
}

export interface StyleRecommendationHistory {
  query: string;
  occasion?: string;
  gender?: string;
  recommendation: string;
  personalColor?: string;
  items: RecommendationProduct[];
  sources: string[];
  createdAt: string;
}

export interface HomeStyleSetItem {
  id: string;
  title: string;
  gender?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  image_url?: string;
  purchaseUrl?: string;
  purchase_url?: string;
  source?: string;
  brand?: string;
  price?: string;
  price_range?: string;
  priceRange?: string;
  tags?: string[];
  brandLabel?: string;
  subtitle?: string;
  priceLabel?: string;
  sourceLabel?: string;
  tag?: string;
}

export interface HomeRecommendationSet {
  id: string;
  title: string;
  summary: string;
  tag: string;
  items: HomeStyleSetItem[];
}

export interface HomeStyleRecommendationResponse {
  recommendation: string;
  sets: HomeRecommendationSet[];
  sources: string[];
}

export interface CalendarOutfitSummary {
  date: string;
  updatedAt: string;
}

export interface CalendarOutfitRecord {
  date: string;
  fileName?: string;
  mimeType?: string;
  imageDataUrl?: string;
  updatedAt?: string;
}

export interface CalendarScheduleRecord {
  id: number;
  date: string;
  time: string;
  title: string;
  scheduleAt: string;
  createdAt?: string;
  updatedAt?: string;
}
