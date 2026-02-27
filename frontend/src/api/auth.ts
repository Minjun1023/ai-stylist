
import apiClient from './client';
import { ApiResponse, AuthResponse, LoginRequest, SignupRequest, User } from '../types';

export interface UpdateProfileRequest {
  nickname?: string;
  gender?: 'male' | 'female' | 'undisclosed';
  ageGroup?: 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus';
  bodyType?: 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus';
  styleMoodPreference?: 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic';
}

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/api/auth/login', data);
    return response.data.data;
  },

  signup: async (data: SignupRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/api/auth/signup', data);
    return response.data.data;
  },

  sendSignupVerification: async (email: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>('/api/auth/signup/verification', { email });
  },

  verifySignupCode: async (email: string, code: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>('/api/auth/signup/verification/confirm', {
      email,
      code,
    });
  },

  isNicknameAvailable: async (nickname: string): Promise<boolean> => {
    const response = await apiClient.get<ApiResponse<boolean>>('/api/auth/signup/check-nickname', {
      params: {
        nickname,
      },
    });
    return response.data.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>('/api/users/me');
    return response.data.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await apiClient.put<ApiResponse<User>>('/api/users/me', data);
    return response.data.data;
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>('/api/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post<ApiResponse<null>>('/api/auth/reset-password', { token, newPassword });
  },
};
