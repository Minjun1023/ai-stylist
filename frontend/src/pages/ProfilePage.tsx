
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { personalColorApi } from '../api/personalColor';
import { authApi } from '../api/auth';
import { PersonalColorResult } from '../types';
import Loading from '../components/common/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { UserCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

const ProfilePage: React.FC = () => {
  const location = useLocation();
  const { user, updateUser } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [gender, setGender] = useState<'male' | 'female' | 'undisclosed'>(user?.gender === 'male' || user?.gender === 'female' || user?.gender === 'undisclosed' ? user.gender : 'undisclosed');
  const [ageGroup, setAgeGroup] = useState<'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus'>(
    user?.ageGroup === 'teens' ||
    user?.ageGroup === 'twenties_early' ||
    user?.ageGroup === 'twenties_late' ||
    user?.ageGroup === 'thirties_early' ||
    user?.ageGroup === 'thirties_late' ||
    user?.ageGroup === 'forties_plus'
      ? user.ageGroup
      : 'twenties_early'
  );
  const [bodyType, setBodyType] = useState<'slim' | 'standard' | 'curvy' | 'muscular' | 'plus'>(
    user?.bodyType === 'slim' ||
    user?.bodyType === 'standard' ||
    user?.bodyType === 'curvy' ||
    user?.bodyType === 'muscular' ||
    user?.bodyType === 'plus'
      ? user.bodyType
      : 'standard'
  );
  const [styleMoodPreference, setStyleMoodPreference] = useState<'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic'>(
    user?.styleMoodPreference === 'casual' ||
    user?.styleMoodPreference === 'minimal' ||
    user?.styleMoodPreference === 'feminine' ||
    user?.styleMoodPreference === 'chic' ||
    user?.styleMoodPreference === 'street' ||
    user?.styleMoodPreference === 'classic'
      ? user.styleMoodPreference
      : 'casual'
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<PersonalColorResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  useEffect(() => {
    setNickname(user?.nickname || '');
    setGender((user?.gender === 'male' || user?.gender === 'female' || user?.gender === 'undisclosed') ? user.gender : 'undisclosed');
    setAgeGroup(
      user?.ageGroup === 'teens' ||
      user?.ageGroup === 'twenties_early' ||
      user?.ageGroup === 'twenties_late' ||
      user?.ageGroup === 'thirties_early' ||
      user?.ageGroup === 'thirties_late' ||
      user?.ageGroup === 'forties_plus'
        ? user.ageGroup
        : 'twenties_early'
    );
    setBodyType(
      user?.bodyType === 'slim' ||
      user?.bodyType === 'standard' ||
      user?.bodyType === 'curvy' ||
      user?.bodyType === 'muscular' ||
      user?.bodyType === 'plus'
        ? user.bodyType
        : 'standard'
    );
    setStyleMoodPreference(
      user?.styleMoodPreference === 'casual' ||
      user?.styleMoodPreference === 'minimal' ||
      user?.styleMoodPreference === 'feminine' ||
      user?.styleMoodPreference === 'chic' ||
      user?.styleMoodPreference === 'street' ||
      user?.styleMoodPreference === 'classic'
        ? user.styleMoodPreference
        : 'casual'
    );
  }, [user]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get('complete') === 'true' && user?.styleProfileCompleted === false) {
      setIsEditing(true);
    }
  }, [location.search, user?.styleProfileCompleted]);

  const loadResults = async () => {
    try {
      const data = await personalColorApi.getResults();
      setResults(data);
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleSaveProfile = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      alert('닉네임은 필수입니다');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await authApi.updateProfile({
        nickname: trimmedNickname,
        gender,
        ageGroup,
        bodyType,
        styleMoodPreference,
      });
      updateUser(updated);
      setIsEditing(false);
    } catch (error) {
      alert('프로필 업데이트에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  const getColorTypeLabel = (colorType: string) => {
    const labels: Record<string, string> = {
      spring_warm: '봄 웜톤',
      summer_cool: '여름 쿨톤',
      autumn_warm: '가을 웜톤',
      winter_cool: '겨울 쿨톤',
    };
    return labels[colorType] || colorType;
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      SURVEY: '설문 진단',
      IMAGE: '이미지 진단',
      HYBRID: '종합 진단',
    };
    return labels[method] || method;
  };

  const getGenderLabel = (value?: string) => {
    const labels: Record<string, string> = {
      male: '남성',
      female: '여성',
      undisclosed: '선택 안 함',
    };
    return labels[value || ''] || '-';
  };

  const getAgeGroupLabel = (value?: string) => {
    const labels: Record<string, string> = {
      teens: '10대',
      twenties_early: '20대 초반',
      twenties_late: '20대 후반',
      thirties_early: '30대 초반',
      thirties_late: '30대 후반',
      forties_plus: '40대 이상',
    };
    return labels[value || ''] || '-';
  };

  const getBodyTypeLabel = (value?: string) => {
    const labels: Record<string, string> = {
      slim: '슬림형',
      standard: '보통형',
      curvy: '볼륨형',
      muscular: '근육형',
      plus: '플러스형',
    };
    return labels[value || ''] || '-';
  };

  const getMoodLabel = (value?: string) => {
    const labels: Record<string, string> = {
      casual: '캐주얼',
      minimal: '미니멀',
      feminine: '페미닌',
      chic: '시크',
      street: '스트릿',
      classic: '클래식',
    };
    return labels[value || ''] || '-';
  };

  const formatJoinDate = (dateValue?: string) => {
    if (!dateValue) {
      return '-';
    }

    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return parsed.toLocaleDateString();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 sm:space-y-6">
      {user?.styleProfileCompleted === false && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent>
            <p className="text-sm font-medium text-amber-800">
              스타일 추천 정확도를 높이기 위해 성별/연령대를 입력해주세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Profile Card */}
      <Card>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="bg-primary-100 rounded-full p-4">
              <UserCircleIcon className="h-12 w-12 text-primary-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user?.nickname}</h1>
              <p className="text-gray-600">{user?.email}</p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="nickname" className="block">
                  닉네임
                </Label>
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
              <div className="flex space-x-3">
                <div className="flex-1">
                  <Label htmlFor="gender" className="block">
                    성별
                  </Label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'undisclosed')}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="undisclosed">선택 안 함</option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                  </select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="ageGroup" className="block">
                    연령대
                  </Label>
                  <select
                    id="ageGroup"
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value as 'teens' | 'twenties_early' | 'twenties_late' | 'thirties_early' | 'thirties_late' | 'forties_plus')}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="teens">10대</option>
                    <option value="twenties_early">20대 초반</option>
                    <option value="twenties_late">20대 후반</option>
                    <option value="thirties_early">30대 초반</option>
                    <option value="thirties_late">30대 후반</option>
                    <option value="forties_plus">40대 이상</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-3">
                <div className="flex-1">
                  <Label htmlFor="bodyType" className="block">
                    체형
                  </Label>
                  <select
                    id="bodyType"
                    value={bodyType}
                    onChange={(e) => setBodyType(e.target.value as 'slim' | 'standard' | 'curvy' | 'muscular' | 'plus')}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="slim">슬림형</option>
                    <option value="standard">보통형</option>
                    <option value="curvy">볼륨형</option>
                    <option value="muscular">근육형</option>
                    <option value="plus">플러스형</option>
                  </select>
                </div>
                <div className="flex-1">
                  <Label htmlFor="styleMoodPreference" className="block">
                    분위기 선호
                  </Label>
                  <select
                    id="styleMoodPreference"
                    value={styleMoodPreference}
                    onChange={(e) => setStyleMoodPreference(e.target.value as 'casual' | 'minimal' | 'feminine' | 'chic' | 'street' | 'classic')}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="casual">캐주얼</option>
                    <option value="minimal">미니멀</option>
                    <option value="feminine">페미닌</option>
                    <option value="chic">시크</option>
                    <option value="street">스트릿</option>
                    <option value="classic">클래식</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? '저장 중...' : '저장'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setNickname(user?.nickname || '');
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setIsEditing(true)}>
              프로필 수정
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">내 프로필 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
              <p className="text-xs text-gray-500">이메일</p>
              <p className="text-sm font-medium text-gray-900 break-all">{user?.email || '-'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
              <p className="text-xs text-gray-500">닉네임</p>
              <p className="text-sm font-medium text-gray-900">{user?.nickname || '-'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
              <p className="text-xs text-gray-500">가입일</p>
              <p className="text-sm font-medium text-gray-900">{formatJoinDate(user?.createdAt)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
              <p className="text-xs text-gray-500">성별</p>
              <p className="text-sm font-medium text-gray-900">{getGenderLabel(user?.gender)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
              <p className="text-xs text-gray-500">연령대</p>
              <p className="text-sm font-medium text-gray-900">{getAgeGroupLabel(user?.ageGroup)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
              <p className="text-xs text-gray-500">체형</p>
              <p className="text-sm font-medium text-gray-900">{getBodyTypeLabel(user?.bodyType)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white/70 p-3">
              <p className="text-xs text-gray-500">분위기 선호</p>
              <p className="text-sm font-medium text-gray-900">{getMoodLabel(user?.styleMoodPreference)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Color Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">퍼스널 컬러</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <SparklesIcon className="h-6 w-6 text-primary-600" />
            {user?.personalColor ? (
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg p-4 w-full">
                <p className="text-sm opacity-80">현재 퍼스널 컬러</p>
                <p className="text-2xl font-bold">{getColorTypeLabel(user.personalColor)}</p>
              </div>
            ) : (
              <p className="text-gray-600">아직 퍼스널 컬러 진단을 받지 않으셨습니다.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">진단 기록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingResults ? (
            <Loading message="기록을 불러오는 중..." />
          ) : results.length === 0 ? (
            <p className="text-gray-600 text-center py-4">진단 기록이 없습니다</p>
          ) : (
                <div className="space-y-3">
              {results.map((result) => (
                <Card key={result.id} className="border border-gray-200/80">
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {getColorTypeLabel(result.colorType)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {getMethodLabel(result.method)} • 신뢰도 {Math.round(result.confidence * 100)}%
                        </p>
                        {result.needsFollowUp && (
                          <p className="text-xs text-amber-600 mt-1">보완 설문이 필요했던 기록</p>
                        )}
                        {result.evidence && result.evidence.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {result.evidence.slice(0, 2).map((item, idx) => (
                              <li key={idx} className="text-xs text-gray-600">
                                • {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(result.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
