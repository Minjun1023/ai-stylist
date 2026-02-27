
import apiClient from './client';
import { ApiResponse, ChatMessage, ChatSession } from '../types';

export const chatApi = {
  getSessions: async (): Promise<ChatSession[]> => {
    const response = await apiClient.get<ApiResponse<ChatSession[]>>('/api/chat/sessions');
    return response.data.data;
  },

  getSession: async (sessionId: number): Promise<ChatSession> => {
    const response = await apiClient.get<ApiResponse<ChatSession>>(`/api/chat/sessions/${sessionId}`);
    return response.data.data;
  },

  sendMessage: async (message: string, season?: string, sessionId?: number): Promise<ChatMessage> => {
    const response = await apiClient.post<ApiResponse<ChatMessage>>('/api/chat', {
      message,
      season,
      sessionId,
    });
    return response.data.data;
  },

  deleteSession: async (sessionId: number): Promise<void> => {
    await apiClient.delete(`/api/chat/sessions/${sessionId}`);
  },
};
