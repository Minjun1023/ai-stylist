
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ChatBubbleOvalLeftEllipsisIcon, EyeIcon, EyeSlashIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import Alert from '../components/ui/alert';

const GoogleBadge: React.FC = () => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[15px] font-bold">
    <span className="bg-gradient-to-r from-blue-500 via-red-500 to-yellow-500 bg-clip-text text-transparent">
      G
    </span>
  </span>
);

const NaverBadge: React.FC = () => (
  <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-white text-[14px] font-black text-[#03C75A]">
    N
  </span>
);

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8080';

  const socialButtons = useMemo(
    () => [
      {
        key: 'kakao',
        label: '카카오 로그인',
        className: 'border border-[#F2D900] bg-[#FEE500] text-[#191919] hover:bg-[#f6da00]',
        icon: <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-[#3A1D1D]" />,
      },
      {
        key: 'naver',
        label: '네이버 로그인',
        className: 'border border-[#02b452] bg-[#03C75A] text-white hover:bg-[#02b452]',
        icon: <NaverBadge />,
      },
      {
        key: 'google',
        label: '구글 로그인',
        className: 'border border-[#dadce0] bg-white text-[#1f2937] hover:bg-[#f7f8f8]',
        icon: <GoogleBadge />,
      },
    ],
    []
  );

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get('error') === 'social_login_failed') {
      setError('소셜 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email.trim().toLowerCase(), password.trim());
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || '로그인에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    window.location.href = `${apiBaseUrl}/oauth2/authorization/${provider}`;
  };

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="animate-reveal border border-white/50 bg-[rgba(255,255,255,0.9)] shadow-[0_24px_50px_-30px_rgba(36,21,10,0.45)] backdrop-blur-md">
          <CardHeader className="mb-8 text-center animate-float">
            <div className="mb-4 flex justify-center">
              <SparklesIcon className="h-12 w-12 text-primary-600" />
            </div>
            <CardTitle className="font-display text-secondary-900">AI 스타일리스트</CardTitle>
            <CardDescription className="font-sans text-secondary-700">당신만의 퍼스널 스타일을 찾아보세요</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <Alert variant="destructive">{error}</Alert>}

              <div>
                <Label htmlFor="email" className="font-display text-gray-700">
                  이메일
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  placeholder="example@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password" className="font-display text-gray-700">
                  비밀번호
                </Label>
                <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    placeholder="••••••••"
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
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary-600 text-white hover:bg-primary-700"
              >
                {isLoading ? '로그인 중...' : '로그인'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">이메일이 곧 아이디입니다.</span>
                <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-700">
                  비밀번호 찾기
                </Link>
              </div>
            </form>

            <div className="my-5 flex items-center gap-3">
              <Separator className="flex-1 border-gray-300" />
              <span className="text-xs text-gray-500">또는 소셜 계정으로 로그인</span>
              <Separator className="flex-1 border-gray-300" />
            </div>

            <div className="space-y-2">
              {socialButtons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  onClick={() => handleSocialLogin(button.key)}
                  className={`inline-flex h-12 w-full items-center justify-start rounded-2xl px-4 text-base font-semibold transition-colors ${button.className}`}
                >
                  <span className="mr-3 inline-flex h-6 w-6 items-center justify-center">{button.icon}</span>
                  <span className="text-base">{button.label}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 text-center">
              <p className="text-gray-600">
                계정이 없으신가요?{' '}
                <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-700">
                  회원가입
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
