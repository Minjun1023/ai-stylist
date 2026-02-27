
import apiClient from './client';
import {
  ApiResponse,
  CalendarOutfitRecord,
  CalendarOutfitSummary,
  CalendarScheduleRecord,
} from '../types';

export const calendarApi = {
  getMonthlyOutfits: async (year: number, month: number): Promise<CalendarOutfitSummary[]> => {
    const response = await apiClient.get<ApiResponse<CalendarOutfitSummary[]>>(
      '/api/calendar/outfits',
      { params: { year, month } }
    );
    return response.data.data || [];
  },

  getOutfitByDate: async (date: string): Promise<CalendarOutfitRecord | null> => {
    const response = await apiClient.get<ApiResponse<CalendarOutfitRecord | null>>(
      `/api/calendar/outfits/${date}`
    );
    return response.data.data || null;
  },

  saveOutfit: async (date: string, image: File): Promise<CalendarOutfitRecord> => {
    const formData = new FormData();
    formData.append('image', image);

    const response = await apiClient.post<ApiResponse<CalendarOutfitRecord>>(
      `/api/calendar/outfits/${date}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.data;
  },

  deleteOutfit: async (date: string): Promise<void> => {
    await apiClient.delete(`/api/calendar/outfits/${date}`);
  },

  getMonthlySchedules: async (year: number, month: number): Promise<CalendarScheduleRecord[]> => {
    const response = await apiClient.get<ApiResponse<CalendarScheduleRecord[]>>(
      '/api/calendar/schedules',
      { params: { year, month } }
    );
    return response.data.data || [];
  },

  getSchedulesByDate: async (date: string): Promise<CalendarScheduleRecord[]> => {
    const response = await apiClient.get<ApiResponse<CalendarScheduleRecord[]>>(
      `/api/calendar/schedules/${date}`
    );
    return response.data.data || [];
  },

  createSchedule: async (date: string, title: string, time: string): Promise<CalendarScheduleRecord> => {
    const response = await apiClient.post<ApiResponse<CalendarScheduleRecord>>(`/api/calendar/schedules/${date}`, {
      title,
      time,
    });
    return response.data.data;
  },

  deleteSchedule: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/calendar/schedules/${id}`);
  },

  getUpcomingSchedule: async (): Promise<CalendarScheduleRecord | null> => {
    const response = await apiClient.get<ApiResponse<CalendarScheduleRecord | null>>('/api/calendar/schedules/upcoming');
    return response.data.data || null;
  },
};
