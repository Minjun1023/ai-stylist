
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import Alert from '../components/ui/alert';

type SocialSignupStep = 1 | 3;
type Gender = 'male' | 'female' | '';
type AgeGroup = 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus' | '';
type BodyType = 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus' | '';
type Mood = 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic' | '';

const SocialSignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, refreshCurrentUser } = useAuthStore();

  const [step, setStep] = useState<SocialSignupStep>(1);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [gender, setGender] = useState<Gender>('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('');
  const [bodyType, setBodyType] = useState<BodyType>('');
  const [styleMoodPreference, setStyleMoodPreference] = useState<Mood>('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (user.styleProfileCompleted) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const moveToBasicInfo = () => {
    setError('');
    if (!agreeTerms || !agreePrivacy) {
      setError('필수 동의 항목에 모두 체크해주세요.');
      return;
    }
    setStep(3);
  };

  const validateBasicInfo = () => {
    if (!gender) {
      setError('성별을 선택해주세요.');
      return false;
    }
    if (!ageGroup) {
      setError('연령대를 선택해주세요.');
      return false;
    }
    if (!bodyType) {
      setError('체형을 선택해주세요.');
      return false;
    }
    if (!styleMoodPreference) {
      setError('분위기 선호를 선택해주세요.');
      return false;
    }
    return true;
  };

  const isGenderValue = (value: Gender): value is 'male' | 'female' => value === 'male' || value === 'female';
  const isAgeGroupValue = (value: AgeGroup): value is Exclude<AgeGroup, ''> => value !== '';
  const isBodyTypeValue = (value: BodyType): value is Exclude<BodyType, ''> => value !== '';
  const isMoodValue = (value: Mood): value is Exclude<Mood, ''> => value !== '';

  const handleComplete = async () => {
    setError('');
    if (!validateBasicInfo()) {
      return;
    }
    if (!isGenderValue(gender) || !isAgeGroupValue(ageGroup) || !isBodyTypeValue(bodyType) || !isMoodValue(styleMoodPreference)) {
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser = await authApi.updateProfile({
        gender,
        ageGroup,
        bodyType,
        styleMoodPreference,
      });
      updateUser(updatedUser);
      await refreshCurrentUser();
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || '소셜 회원가입 정보 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="animate-reveal border border-white/50 bg-[rgba(255,255,255,0.9)] shadow-[0_24px_50px_-30px_rgba(36,21,10,0.45)] backdrop-blur-md">
          <CardHeader className="mb-8 text-center animate-float">
            <div className="mb-4 flex justify-center">
              <SparklesIcon className="h-12 w-12 text-primary-600" />
            </div>
            <CardTitle className="font-display text-secondary-900">소셜 회원가입</CardTitle>
            <CardDescription className="font-sans text-secondary-700">
              {step === 1 && '약관 동의'}
              {step === 3 && '기본 정보 입력'}
            </CardDescription>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-2.5 w-14 rounded-full bg-primary-600" />
              <span className={`h-2.5 w-14 rounded-full ${step === 3 ? 'bg-primary-600' : 'bg-gray-200'}`} />
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && <Alert variant="destructive">{error}</Alert>}

            {step === 1 && (
              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={agreeTerms && agreePrivacy}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      setAgreePrivacy(e.target.checked);
                    }}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="w-full">
                    <p className="text-sm font-semibold text-gray-900">모두 동의</p>
                    <p className="text-xs text-gray-500">필수 약관 동의 항목 전체에 동의합니다.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="w-full">
                    <p className="text-sm font-medium text-gray-900">[필수] 서비스 이용약관 동의</p>
                    <p className="text-xs text-gray-500">
                      회원가입, 본인 인증, 계정 운영 및 혜택 제공을 위해 필요한 기본 이용 규칙입니다.
                    </p>
                  </div>
                </label>
                <details className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-700">약관 상세 내용 보기</summary>
                  <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-gray-600">
                    <li>회원은 본인의 개인정보를 정확히 입력해야 하며, 허위 정보 입력 시 이용이 제한될 수 있습니다.</li>
                    <li>AI 스타일 추천, 채팅, 퍼스널컬러 진단 기능은 안내 목적으로 제공됩니다.</li>
                    <li>부정 사용(불법 스크립트, 자동화 악용, 무단 광고 등) 시 이용이 제한될 수 있습니다.</li>
                    <li>서비스는 정책 변경 시 약관 및 운영 규정을 고지 후 적용할 수 있습니다.</li>
                  </ul>
                </details>
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="w-full">
                    <p className="text-sm font-medium text-gray-900">[필수] 개인정보 수집 및 이용 동의</p>
                    <p className="text-xs text-gray-500">
                      계정 식별, 로그인, 스타일 추천 정확도 향상 목적으로 개인정보를 처리합니다.
                    </p>
                  </div>
                </label>
                <details className="rounded-lg border border-gray-100 bg-white px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-gray-700">약관 상세 내용 보기</summary>
                  <ul className="mt-2 list-disc list-inside space-y-1 text-xs text-gray-600">
                    <li>수집 항목: 이메일, 닉네임, 성별, 연령대, 체형, 분위기 선호, 서비스 이용 로그</li>
                    <li>AI 상담 품질 향상을 위해 설문/채팅 이력, 퍼스널컬러 진단 결과를 분석 데이터로 사용합니다.</li>
                    <li>수집한 정보는 별도 보관 정책에 따라 제한적으로 보존되며, 목적 외 제공을 하지 않습니다.</li>
                    <li>회원 탈퇴 시 법적 보관 의무를 제외하고 보유 기간이 끝나면 파기합니다.</li>
                  </ul>
                </details>
                <p className="text-xs text-gray-500">소셜 계정 가입은 계정 정보 입력 단계가 생략됩니다.</p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="gender" className="font-display text-gray-700">성별</Label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="" disabled>
                      성별을 선택해주세요
                    </option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="ageGroup" className="font-display text-gray-700">연령대</Label>
                  <select
                    id="ageGroup"
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="" disabled>
                      연령대를 선택해주세요
                    </option>
                    <option value="teens">10대</option>
                    <option value="twenties_early">20대 초반</option>
                    <option value="twenties_late">20대 후반</option>
                    <option value="thirties_early">30대 초반</option>
                    <option value="thirties_late">30대 후반</option>
                    <option value="forties_plus">40대 이상</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="bodyType" className="font-display text-gray-700">체형</Label>
                  <select
                    id="bodyType"
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value as BodyType)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="" disabled>
                      체형을 선택해주세요
                    </option>
                    <option value="slim">슬림형</option>
                    <option value="standard">보통형</option>
                    <option value="curvy">볼륨형</option>
                    <option value="muscular">근육형</option>
                    <option value="plus">플러스형</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="styleMoodPreference" className="font-display text-gray-700">분위기 선호</Label>
                  <select
                    id="styleMoodPreference"
                    value={styleMoodPreference}
                    onChange={(e) => setStyleMoodPreference(e.target.value as Mood)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="" disabled>
                      분위기 선호를 선택해주세요
                    </option>
                    <option value="casual">캐주얼</option>
                    <option value="minimal">미니멀</option>
                    <option value="feminine">페미닌</option>
                    <option value="chic">시크</option>
                    <option value="street">스트릿</option>
                    <option value="classic">클래식</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {step === 3 && (
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setError('');
                    setStep(1);
                  }}
                >
                  이전
                </Button>
              )}
              {step === 1 && (
                <Button type="button" className="w-full bg-primary-600 text-white hover:bg-primary-700" onClick={moveToBasicInfo}>
                  다음
                </Button>
              )}
              {step === 3 && (
                <Button type="button" className="flex-1 bg-primary-600 text-white hover:bg-primary-700" onClick={handleComplete} disabled={isSaving}>
                  {isSaving ? '저장 중...' : '가입 완료'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SocialSignupPage;
