
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { personalColorApi } from '../api/personalColor';
import { FollowUpQuestion, PersonalColorResult, SurveyAnswers } from '../types';
import Loading from '../components/common/Loading';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import {
  SparklesIcon,
  CameraIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

type SurveyQuestion = {
  id: string;
  question: string;
  options: string[];
};

const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'skin_tone',
    question: '당신의 피부톤은 어떤 편인가요?',
    options: ['밝은 편', '보통', '어두운 편', '노란 기가 있음', '붉은 기가 있음'],
  },
  {
    id: 'vein_color',
    question: '손목 안쪽 혈관의 색은 어떤가요?',
    options: ['파란색/보라색', '초록색', '파랑과 초록 둘 다'],
  },
  {
    id: 'jewelry_preference',
    question: '어떤 색상의 액세서리가 더 잘 어울리나요?',
    options: ['골드', '실버', '둘 다 비슷함'],
  },
  {
    id: 'best_color',
    question: '평소에 가장 잘 어울린다고 느끼는 색상은?',
    options: ['파스텔톤', '비비드한 원색', '어스톤/뮤트톤', '딥한 색상'],
  },
  {
    id: 'tan_reaction',
    question: '햇빛에 노출되면 피부가 어떻게 되나요?',
    options: ['쉽게 타고 오래감', '쉽게 타지만 금방 돌아옴', '잘 타지 않음', '붉어짐'],
  },
  {
    id: 'eye_color',
    question: '눈동자 색상은 어떤 편인가요?',
    options: ['짙은 갈색', '갈색', '헤이즐', '회색/푸른 눈', '검은색'],
  },
  {
    id: 'hair_color',
    question: '자연 모발 색상은 어떤 편인가요?',
    options: ['매우 짙은 갈색/흑색', '진한 갈색', '갈색', '밝은 갈색', '금발/붉은 계열', '염색색'],
  },
  {
    id: 'accessory_detail',
    question: '옷차림을 고를 때 가장 중요하게 보는 포인트는 무엇인가요?',
    options: ['밝고 선명한 색감', '차분하고 부드러운 톤', '따뜻한 중간톤', '어두운 포인트 컬러'],
  },
  {
    id: 'undertone_reaction',
    question: '메이크업(립/블러셔/아이섀도우)에서 가장 잘 받는 톤은 무엇인가요?',
    options: ['코랄, 피치, 오렌지', '핑크, 라일락, 베리', '올리브, 카키, 브라운', '푸른/보랏빛 계열'],
  },
  {
    id: 'fabric_preference',
    question: '겨울철/봄철 코디에서 자주 잘 맞는 소재/컬러 조합은?',
    options: ['베이지·아이보리 톤', '민트·라벤더·파스텔톤', '버건디·테라코타', '블랙·화이트·메탈릭 톤'],
  },
];

const PersonalColorPage: React.FC = () => {
  const { refreshCurrentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'survey' | 'image'>('survey');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [result, setResult] = useState<PersonalColorResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);

  const activeQuestions: (SurveyQuestion | FollowUpQuestion)[] = isFollowUpMode
    ? followUpQuestions
    : SURVEY_QUESTIONS;
  const currentQuestionData = activeQuestions[currentQuestion];

  useEffect(() => {
    if (activeQuestions.length === 0 && currentQuestion !== 0) {
      setCurrentQuestion(0);
      return;
    }
    if (activeQuestions.length > 0 && currentQuestion >= activeQuestions.length) {
      setCurrentQuestion(activeQuestions.length - 1);
    }
  }, [activeQuestions.length, currentQuestion]);

  const isCurrentStageComplete = (questions: (SurveyQuestion | FollowUpQuestion)[]) =>
    questions.every((q) => !!answers[q.id]);

  const followUpBannerMessage = isFollowUpMode
    ? '현재 입력 정보로 톤군이 다소 모호해 추가 3문항으로 보완합니다.'
    : null;

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (currentQuestion < activeQuestions.length - 1) {
      setTimeout(() => setCurrentQuestion((prev) => prev + 1), 300);
    }
  };

  const submitSurvey = async () => {
    if (!isCurrentStageComplete(activeQuestions)) {
      alert('모든 질문에 답해주세요');
      return;
    }

    setIsLoading(true);
    try {
      const response = await personalColorApi.diagnoseBySurvey(answers);

      if (response.needsFollowUp && response.followUpQuestions?.length) {
        if (!isFollowUpMode) {
          setFollowUpQuestions(response.followUpQuestions);
          setIsFollowUpMode(true);
          setCurrentQuestion(0);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        setFollowUpQuestions(response.followUpQuestions);
        setCurrentQuestion(0);
        return;
      }

      setResult(response);
      setIsFollowUpMode(false);
      setFollowUpQuestions([]);
      await refreshCurrentUser();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '분석에 실패했습니다. 다시 시도해주세요.';
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleImageSubmit = async () => {
    if (!selectedImage) {
      alert('이미지를 선택해주세요');
      return;
    }

    setIsLoading(true);
    try {
      const response = await personalColorApi.diagnoseByImage(selectedImage);
      setResult(response);
      await refreshCurrentUser();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '이미지 분석에 실패했습니다. 다시 시도해주세요.';
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetDiagnosis = () => {
    setResult(null);
    setAnswers({});
    setCurrentQuestion(0);
    setSelectedImage(null);
    setPreviewUrl(null);
    setIsFollowUpMode(false);
    setFollowUpQuestions([]);
  };

  const setTab = (tab: 'survey' | 'image') => {
    setActiveTab(tab);
    setCurrentQuestion(0);
    setIsFollowUpMode(false);
    setFollowUpQuestions([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading message="AI가 분석 중입니다... 잠시만 기다려주세요" />
      </div>
    );
  }

  if (result) {
    const primaryColors = result.palette?.primary_colors ?? [];
    const secondaryColors = result.palette?.secondary_colors ?? [];
    const avoidColors = result.palette?.avoid_colors ?? [];

    return (
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
        <Card className="text-center animate-reveal">
          <CardContent>
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">진단 완료!</h1>
            <p className="text-gray-600 mb-6">당신의 퍼스널 컬러가 분석되었습니다</p>

            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl p-6 mb-6">
              <div className="text-lg opacity-90 mb-2">당신의 퍼스널 컬러는</div>
              <div className="text-3xl font-bold">
                {result.colorType ? result.colorType.replace('_', ' ').toUpperCase() : 'N/A'}
              </div>
              <div className="mt-2 text-sm opacity-80">
                신뢰도: {Math.round((result.confidence || 0) * 100)}%
              </div>
            </div>

            {result.evidence && result.evidence.length > 0 && (
              <div className="text-left mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">신뢰도 근거 (상위 2개)</h3>
                <ul className="space-y-2">
                  {result.evidence.slice(0, 2).map((item, idx) => (
                    <li key={idx} className="text-sm text-gray-700 bg-gray-50 rounded-md p-3">
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.description && (
              <div className="text-left mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">분석 결과</h3>
                <p className="text-gray-600">{result.description}</p>
              </div>
            )}

            {result.palette && (
              <div className="text-left mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">추천 컬러 팔레트</h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">메인 컬러</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {primaryColors.map((color, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-gray-500">서브 컬러</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {secondaryColors.map((color, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-sm text-gray-500">피해야 할 컬러</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {avoidColors.map((color, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                        >
                          {color}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result.stylingTips && (
              <div className="text-left mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">스타일링 팁</h3>
                <ul className="space-y-2 text-left">
                  {result.stylingTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start">
                      <SparklesIcon className="h-5 w-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="secondary" onClick={resetDiagnosis} className="w-full">
              다시 진단받기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
      <div className="text-center mb-8">
        <SparklesIcon className="h-12 w-12 text-primary-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">퍼스널 컬러 진단</h1>
        <p className="text-gray-600 mt-2">AI가 당신에게 어울리는 컬러를 분석해드립니다</p>
      </div>

      <Card className="p-1">
        <div className="flex rounded-lg bg-gray-100 p-1">
          <Button
            variant={activeTab === 'survey' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setTab('survey')}
          >
            <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
            설문 진단
          </Button>
          <Button
            variant={activeTab === 'image' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setTab('image')}
          >
            <CameraIcon className="h-5 w-5 mr-2" />
            이미지 진단
          </Button>
        </div>
      </Card>

      {activeTab === 'survey' && (
        <Card>
          <CardContent>
            <div className="mb-6">
              {followUpBannerMessage && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3">
                  {followUpBannerMessage}
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{isFollowUpMode ? '추가 보완 설문' : '진단 설문'}</span>
                <span>
                  {currentQuestion + 1} / {activeQuestions.length}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-primary-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentQuestion + 1) / activeQuestions.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {currentQuestionData?.question}
            </h3>

            {currentQuestionData ? (
              <div className="space-y-3">
                {currentQuestionData.options.map((option) => (
                  <Button
                    key={option}
                    variant={
                      answers[currentQuestionData.id] === option ? 'default' : 'outline'
                    }
                    className="w-full justify-start text-left"
                    onClick={() => handleAnswerSelect(currentQuestionData.id, option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                설문 문항을 불러오는 중입니다. 잠시 후 다시 시도해주세요.
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                variant="secondary"
                onClick={() => setCurrentQuestion((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                className="disabled:opacity-50"
              >
                이전
              </Button>

              {currentQuestion === activeQuestions.length - 1 ? (
                <Button
                  onClick={submitSurvey}
                  disabled={!isCurrentStageComplete(activeQuestions)}
                  className="disabled:opacity-50"
                >
                  {isFollowUpMode ? '결과 보기' : '결과 보기'}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentQuestion((prev) => prev + 1)}
                  disabled={!currentQuestionData || !answers[currentQuestionData.id]}
                  className="disabled:opacity-50"
                >
                  다음
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'image' && (
        <Card>
          <CardContent className="text-center">
            {previewUrl ? (
              <div className="mb-6">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded-lg shadow-md"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 mb-6">
                <CameraIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">얼굴이 잘 보이는 사진을 업로드해주세요</p>
                <p className="text-sm text-gray-500">
                  자연광에서 촬영한 사진이 가장 정확합니다
                </p>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              id="image-upload"
            />
            <div className="space-y-3">
              <Label htmlFor="image-upload" className="w-full">
                <Button variant="secondary" className="w-full">
                  {previewUrl ? '다른 사진 선택' : '사진 선택'}
                </Button>
              </Label>
              {selectedImage && (
                <Button onClick={handleImageSubmit} className="w-full">
                  분석하기
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PersonalColorPage;
