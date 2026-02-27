
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';
import { EyeIcon, EyeSlashIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import Alert from '../components/ui/alert';

type SignupStep = 1 | 2 | 3;

type Gender = 'male' | 'female' | '';
type AgeGroup = 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus' | '';
type BodyType = 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus' | '';
type Mood = 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic' | '';
type AgreementKey = 'terms' | 'privacy';

type AgreementItem = {
  key: AgreementKey;
  label: string;
  description: string;
  details: string[];
  notice: string;
};

const agreementItems: AgreementItem[] = [
  {
    key: 'terms',
    label: '서비스 이용약관 동의',
    description: '회원가입, 본인 인증, 계정 운영 및 혜택 제공을 위해 필요한 기본 이용 규칙입니다.',
    details: [
      '회원은 본인의 개인정보를 정확히 입력해야 하며, 허위 정보 입력 시 이용이 제한될 수 있습니다.',
      'AI 스타일 추천, 채팅, 퍼스널컬러 진단 기능은 안내 목적으로 제공되며, 최종 판단은 사용자 본인에게 있습니다.',
      '부정 사용(불법 스크립트, 자동화 악용, 무단 광고 등) 시 이용이 제한될 수 있습니다.',
      '서비스는 정책 변경 시 약관 및 운영 규정을 고지 후 적용할 수 있습니다.',
    ],
    notice: '서비스 이용 중단 사유: 약관 위반, 오남용, 반복적인 시스템 악용',
  },
  {
    key: 'privacy',
    label: '개인정보 수집 및 이용 동의',
    description: '계정 식별, 로그인, 스타일 추천 정확도 향상 목적으로 개인정보를 처리합니다.',
    details: [
      '수집 항목: 이메일, 닉네임, 성별, 연령대, 체형, 분위기 선호, 서비스 이용 로그',
      'AI 상담 품질 향상을 위해 설문/채팅 이력, 퍼스널컬러 진단 결과를 분석 데이터로 사용합니다.',
      '수집한 정보는 별도 보관 정책에 따라 제한적으로 보존되며, 목적 외 제공을 하지 않습니다.',
      '회원 탈퇴 시 법적 보관 의무를 제외하고 보유 기간이 끝나면 파기합니다.',
    ],
    notice: '제3자 제공: 쇼핑/이미지 링크 추천 목적이 있는 경우에만, 기능별 연동 동작 범위에서 처리됩니다.',
  },
];

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuthStore();

  const [step, setStep] = useState<SignupStep>(1);

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nickname, setNickname] = useState('');

  const [gender, setGender] = useState<Gender>('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('');
  const [bodyType, setBodyType] = useState<BodyType>('');
  const [styleMoodPreference, setStyleMoodPreference] = useState<Mood>('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const allAgree = agreeTerms && agreePrivacy;

  const isAgreementChecked = (key: AgreementKey) => {
    return key === 'terms' ? agreeTerms : agreePrivacy;
  };

  const updateAgreement = (key: AgreementKey, checked: boolean) => {
    if (key === 'terms') {
      setAgreeTerms(checked);
      return;
    }
    setAgreePrivacy(checked);
  };

  const validateStepTwo = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedNickname = nickname.trim();
    const normalizedPassword = password.trim();
    const normalizedConfirmPassword = confirmPassword.trim();
    const normalizedCode = emailVerificationCode.trim();
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

    if (!normalizedEmail) {
      setError('이메일을 입력해주세요.');
      return false;
    }

    if (!normalizedCode) {
      setError('이메일 인증코드를 입력해주세요.');
      return false;
    }

    if (!normalizedNickname) {
      setError('닉네임을 입력해주세요.');
      return false;
    }

    if (normalizedPassword !== normalizedConfirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return false;
    }

    if (normalizedPassword.length < 8 || normalizedPassword.length > 64) {
      setError('비밀번호는 8자 이상 64자 이하여야 합니다');
      return false;
    }

    if (!passwordRegex.test(normalizedPassword)) {
      setError('비밀번호는 영문 대/소문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다');
      return false;
    }

    return true;
  };

  const isGenderValue = (value: Gender): value is 'male' | 'female' => {
    return value === 'male' || value === 'female';
  };

  const isAgeGroupValue = (value: AgeGroup): value is Exclude<AgeGroup, ''> => {
    return (
      value === 'teens' ||
      value === 'twenties_early' ||
      value === 'twenties_late' ||
      value === 'thirties_early' ||
      value === 'thirties_late' ||
      value === 'forties_plus'
    );
  };

  const isBodyTypeValue = (value: BodyType): value is Exclude<BodyType, ''> => {
    return value === 'slim' || value === 'standard' || value === 'curvy' || value === 'muscular' || value === 'plus';
  };

  const isMoodValue = (value: Mood): value is Exclude<Mood, ''> => {
    return (
      value === 'casual' ||
      value === 'minimal' ||
      value === 'feminine' ||
      value === 'chic' ||
      value === 'street' ||
      value === 'classic'
    );
  };

  const validateStepThree = () => {
    if (!isGenderValue(gender)) {
      setError('성별을 선택해주세요.');
      return false;
    }
    if (!isAgeGroupValue(ageGroup)) {
      setError('연령대를 선택해주세요.');
      return false;
    }
    if (!isBodyTypeValue(bodyType)) {
      setError('체형을 선택해주세요.');
      return false;
    }
    if (!isMoodValue(styleMoodPreference)) {
      setError('분위기 선호를 선택해주세요.');
      return false;
    }

    return true;
  };

  const handleMoveToStepTwo = () => {
    setError('');
    setInfo('');

    if (!agreeTerms || !agreePrivacy) {
      setError('필수 동의 항목에 모두 체크해주세요.');
      return;
    }

    setStep(2);
  };

  const handleMoveToStepThree = async () => {
    setError('');
    setInfo('');

    if (!validateStepTwo()) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedNickname = nickname.trim();
    const normalizedCode = emailVerificationCode.trim();

    if (normalizedCode.length !== 6) {
      setError('인증 코드는 6자리여야 합니다.');
      return;
    }

    setIsVerifyingCode(true);

    try {
      const isAvailable = await authApi.isNicknameAvailable(normalizedNickname);
      if (!isAvailable) {
        setError('이미 사용 중인 닉네임입니다.');
        return;
      }

      await authApi.verifySignupCode(normalizedEmail, normalizedCode);
      setStep(3);
    } catch (err: any) {
      const serverMsg = err.response?.data?.message;
      if (serverMsg && serverMsg !== '서버 오류가 발생했습니다') {
        setError(serverMsg);
        return;
      }

      const detailMsg = err.response?.data?.error?.detail;
      if (detailMsg && detailMsg.includes('인증 코드')) {
        setError('인증 코드가 올바르지 않습니다.');
        return;
      }

      setError('인증 코드가 올바르지 않습니다.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleToggleAllAgree = (checked: boolean) => {
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
  };

  const handleSendVerificationCode = async () => {
    setError('');
    setInfo('');
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('이메일을 입력해주세요.');
      return;
    }

    setIsSendingCode(true);

    try {
      await authApi.sendSignupVerification(normalizedEmail);
      setInfo('인증코드가 전송되었습니다.');
    } catch (err: any) {
      setError(err.response?.data?.message || '인증코드 전송에 실패했습니다.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

                if (step !== 3) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const normalizedCode = emailVerificationCode.trim();

    if (!validateStepTwo()) {
      return;
    }

    if (!validateStepThree() || !isGenderValue(gender)) {
      return;
    }

    if (!isAgeGroupValue(ageGroup) || !isBodyTypeValue(bodyType) || !isMoodValue(styleMoodPreference)) {
      return;
    }

    setIsLoading(true);

    try {
      const isAvailable = await authApi.isNicknameAvailable(nickname.trim());
      if (!isAvailable) {
        setStep(2);
        setError('이미 사용 중인 닉네임입니다.');
        return;
      }

      await signup(
        normalizedEmail,
        normalizedPassword,
        nickname,
        gender,
        ageGroup,
        bodyType,
        styleMoodPreference,
        normalizedCode
      );
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full">
        <Card className="animate-reveal border border-white/50 bg-[rgba(255,255,255,0.88)] shadow-[0_24px_50px_-30px_rgba(36,21,10,0.45)] backdrop-blur-md">
          <CardHeader className="text-center mb-8 animate-float">
            <div className="flex justify-center mb-4">
              <SparklesIcon className="h-12 w-12 text-primary-600" />
            </div>
            <CardTitle className="font-display text-secondary-900">회원가입</CardTitle>
            <CardDescription className="font-sans text-secondary-700">
              {step === 1 && '약관 동의'}
              {step === 2 && '계정 정보 입력'}
              {step === 3 && '스타일 프로필 입력'}
            </CardDescription>
            <div className="mt-4 flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-2.5 w-14 rounded-full ${step >= s ? 'bg-primary-600' : 'bg-gray-200'}`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="destructive" className="animate-reveal">{error}</Alert>}
              {info && <Alert className="animate-reveal">{info}</Alert>}

              {step === 1 && (
                <div className="space-y-3">
                  <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={allAgree}
                      onChange={(e) => handleToggleAllAgree(e.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <div>
                    <p className="text-sm font-semibold text-gray-900">모두 동의</p>
                    <p className="text-xs text-gray-500">필수 약관 동의 항목 전체에 동의합니다.</p>
                  </div>
                  </label>

                  {agreementItems.map((item) => (
                    <div key={item.key} className="rounded-lg border border-gray-200 bg-white">
                      <label className="flex items-start gap-3 p-3">
                        <input
                          type="checkbox"
                          checked={isAgreementChecked(item.key)}
                          onChange={(e) => {
                            updateAgreement(item.key, e.target.checked);
                          }}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="w-full">
                          <p className="text-sm font-medium text-gray-900">[필수] {item.label}</p>
                          <p className="text-xs text-gray-500">{item.description}</p>
                        </div>
                      </label>
                      <details className="border-t border-gray-100 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-semibold text-gray-700">
                          약관 상세 내용 보기
                        </summary>
                        <div className="mt-2 space-y-2">
                          <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
                            {item.details.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                          <p className="text-xs text-gray-500">{item.notice}</p>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {step === 2 && (
                <>
                  <div>
                    <Label htmlFor="email" className="font-display text-gray-700">이메일</Label>
                    <div className="space-y-2">
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="example@email.com"
                        required
                      />
                      <Button
                        type="button"
                        onClick={handleSendVerificationCode}
                        disabled={isSendingCode}
                        variant="secondary"
                        className="w-full animate-reveal"
                      >
                        {isSendingCode ? '인증코드 발송 중...' : '인증코드 발송'}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="emailVerificationCode" className="font-display text-gray-700">이메일 인증 코드</Label>
                    <Input
                      id="emailVerificationCode"
                      type="text"
                      value={emailVerificationCode}
                      onChange={(e) => setEmailVerificationCode(e.target.value)}
                      autoComplete="one-time-code"
                      placeholder="6자리 인증코드"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="nickname" className="font-display text-gray-700">닉네임</Label>
                    <Input
                      id="nickname"
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="닉네임"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="font-display text-gray-700">비밀번호</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        placeholder="8자 이상"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 z-10 inline-flex items-center justify-center px-3 text-gray-600 hover:text-gray-800"
                        aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                      >
                        {showPassword ? <EyeSlashIcon className="h-5 w-5 stroke-2" /> : <EyeIcon className="h-5 w-5 stroke-2" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      영문 대/소문자, 숫자, 특수문자를 각각 1자 이상 포함 (8~64자)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="font-display text-gray-700">비밀번호 확인</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                        placeholder="비밀번호 확인"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 z-10 inline-flex items-center justify-center px-3 text-gray-600 hover:text-gray-800"
                        aria-label={showConfirmPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                      >
                        {showConfirmPassword ? <EyeSlashIcon className="h-5 w-5 stroke-2" /> : <EyeIcon className="h-5 w-5 stroke-2" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

                {step === 3 && (
                <>
                  <div>
                    <Label htmlFor="gender" className="font-display text-gray-700">성별</Label>
                    <select
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                      required
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
                      required
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
                      required
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
                      required
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
                </>
              )}

              <div className="flex gap-2">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setError('');
                      setInfo('');
                      setStep((prev) => (prev === 3 ? 2 : 1));
                    }}
                  >
                    이전
                  </Button>
                )}

                {step === 1 && (
                  <Button
                    type="button"
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleMoveToStepTwo}
                    disabled={!allAgree}
                  >
                    다음
                  </Button>
                )}

                {step === 2 && (
                  <Button
                    type="button"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white"
                    onClick={handleMoveToStepThree}
                    disabled={isVerifyingCode}
                  >
                    {isVerifyingCode ? '코드 확인 중...' : '다음'}
                  </Button>
                )}

                {step === 3 && (
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white animate-reveal"
                  >
                    {isLoading ? '가입 중...' : '회원가입 완료'}
                  </Button>
                )}
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                이미 계정이 있으신가요?{' '}
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  로그인
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
