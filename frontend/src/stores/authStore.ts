
import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/auth';
import {
  clearGuestStyleRecommendationCache,
  clearGuestStyleRecommendationGender,
  clearGuestStyleRecommendationReady,
  ensureGuestStyleRecommendationSession,
  hasActiveGuestStyleRecommendationSession,
  clearGuestStyleRecommendationSession,
} from '../lib/recommendations';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    nickname: string,
    gender: 'male' | 'female',
    ageGroup: 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus',
    bodyType: 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus',
    styleMoodPreference: 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic',
    emailVerificationCode: string
  ) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    localStorage.setItem('accessToken', response.accessToken);
    set({ user: response.user, isAuthenticated: true });
  },

  signup: async (
    email: string,
    password: string,
    nickname: string,
    gender: 'male' | 'female',
    ageGroup: 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus',
    bodyType: 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus',
    styleMoodPreference: 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic',
    emailVerificationCode: string
  ) => {
    const response = await authApi.signup({
      email,
      password,
      nickname,
      gender,
      ageGroup,
      bodyType,
      styleMoodPreference,
      emailVerificationCode,
    });
    localStorage.setItem('accessToken', response.accessToken);
    set({ user: response.user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    clearGuestStyleRecommendationCache();
    clearGuestStyleRecommendationReady();
    clearGuestStyleRecommendationGender();
    clearGuestStyleRecommendationSession();
    set({ user: null, isAuthenticated: false });
  },

  refreshCurrentUser: async () => {
    const user = await authApi.getCurrentUser();
    set({ user, isAuthenticated: true });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      const hasActiveGuestSession = hasActiveGuestStyleRecommendationSession();
      if (!hasActiveGuestSession) {
        clearGuestStyleRecommendationCache();
        clearGuestStyleRecommendationReady();
        clearGuestStyleRecommendationGender();
      } else {
        ensureGuestStyleRecommendationSession();
      }
      set({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const user = await authApi.getCurrentUser();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      clearGuestStyleRecommendationCache();
      clearGuestStyleRecommendationSession();
      clearGuestStyleRecommendationReady();
      clearGuestStyleRecommendationGender();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser: (userData: Partial<User>) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...userData } : null,
    }));
  },
}));
