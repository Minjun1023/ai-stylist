
import apiClient from './client';
import { ApiResponse, FollowUpQuestion, PersonalColorResult, SurveyAnswers } from '../types';

type RawPersonalColorResult = Omit<
  PersonalColorResult,
  'colorType' | 'palette'
> & {
  colorType?: string;
  color_type?: string;
  needsFollowUp?: boolean;
  needs_follow_up?: boolean;
  followUpQuestions?: FollowUpQuestion[];
  follow_up_questions?: FollowUpQuestion[];
  evidence?: string[];
  palette?: {
    primary_colors?: string[];
    secondary_colors?: string[];
    avoid_colors?: string[];
    primaryColors?: string[];
    secondaryColors?: string[];
    avoidColors?: string[];
  };
};

const normalizeResult = (result: RawPersonalColorResult): PersonalColorResult => ({
  ...result,
  colorType: result.colorType ?? result.color_type ?? '',
  confidence: result.confidence ?? 0,
  method: result.method ?? 'SURVEY',
  needsFollowUp: result.needsFollowUp ?? result.needs_follow_up ?? false,
  followUpQuestions: result.followUpQuestions ?? result.follow_up_questions ?? [],
  evidence: result.evidence ?? [],
  palette: result.palette
    ? {
        primary_colors: result.palette.primary_colors ?? result.palette.primaryColors ?? [],
        secondary_colors: result.palette.secondary_colors ?? result.palette.secondaryColors ?? [],
        avoid_colors: result.palette.avoid_colors ?? result.palette.avoidColors ?? [],
      }
    : undefined,
  stylingTips: result.stylingTips ?? [],
});

export const personalColorApi = {
  getResults: async (): Promise<PersonalColorResult[]> => {
    const response = await apiClient.get<ApiResponse<PersonalColorResult[]>>('/api/personal-color/results');
    if (!response.data.success) {
      throw new Error(response.data.message || '퍼스널컬러 결과를 불러오지 못했습니다.');
    }
    return response.data.data;
  },

  diagnoseBySurvey: async (answers: SurveyAnswers): Promise<PersonalColorResult> => {
    const response = await apiClient.post<ApiResponse<RawPersonalColorResult>>(
      '/api/personal-color/survey',
      { answers }
    );
    if (!response.data.success) {
      throw new Error(response.data.message || '퍼스널컬러 진단에 실패했습니다.');
    }
    return normalizeResult(response.data.data);
  },

  diagnoseByImage: async (image: File): Promise<PersonalColorResult> => {
    const formData = new FormData();
    formData.append('image', image);

    const response = await apiClient.post<ApiResponse<RawPersonalColorResult>>(
      '/api/personal-color/image',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    if (!response.data.success) {
      throw new Error(response.data.message || '이미지 분석에 실패했습니다.');
    }
    return normalizeResult(response.data.data);
  },
};
