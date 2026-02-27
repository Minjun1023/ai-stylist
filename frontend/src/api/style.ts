
import apiClient from './client';
import {
  ApiResponse,
  HomeStyleRecommendationResponse,
  StyleRecommendation,
  StyleRecommendationHistory,
} from '../types';

export const styleApi = {
  recommend: async (
    query: string,
    occasion?: string,
    gender?: 'male' | 'female',
    season?: string
  ): Promise<StyleRecommendation> => {
    const response = await apiClient.post<ApiResponse<StyleRecommendation>>('/api/style/recommend', {
      query,
      occasion,
      gender,
      season,
    });
    return response.data.data;
  },

  recommendGuest: async (
    query: string,
    occasion?: string,
    gender?: 'male' | 'female',
    season?: string
  ): Promise<StyleRecommendation> => {
    const response = await apiClient.post<ApiResponse<StyleRecommendation>>('/api/style/recommend/guest', {
      query,
      occasion,
      gender,
      season,
    });
    return response.data.data;
  },

  recommendHome: async (query: string, occasion?: string): Promise<HomeStyleRecommendationResponse> => {
    const response = await apiClient.post<ApiResponse<HomeStyleRecommendationResponse>>('/api/style/home', {
      query,
      occasion,
    });
    return response.data.data;
  },

  recommendGuestHome: async (
    query: string,
    occasion?: string,
    gender?: 'male' | 'female'
  ): Promise<HomeStyleRecommendationResponse> => {
    const response = await apiClient.post<ApiResponse<HomeStyleRecommendationResponse>>('/api/style/home/guest', {
      query,
      occasion,
      gender,
    });
    return response.data.data;
  },

  getSavedRecommendations: async (limit = 10): Promise<StyleRecommendationHistory[]> => {
    const response = await apiClient.get<ApiResponse<StyleRecommendationHistory[]>>(
      `/api/style/recommendations?limit=${Math.max(1, Math.min(limit, 30))}`
    );
    return response.data.data || [];
  },
};
