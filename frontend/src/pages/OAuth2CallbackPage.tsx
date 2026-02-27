
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Loading from '../components/common/Loading';
import { useAuthStore } from '../stores/authStore';

const OAuth2CallbackPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token')?.trim() || '';
    const errorParam = params.get('error')?.trim() || '';

    const run = async () => {
      if (errorParam) {
        setError('소셜 로그인에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      if (!token) {
        setError('유효하지 않은 소셜 로그인 응답입니다.');
        return;
      }

      localStorage.setItem('accessToken', token);

      try {
        await checkAuth();
        const latestUser = useAuthStore.getState().user;
        if (latestUser?.styleProfileCompleted === false) {
          navigate('/social-signup', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } catch {
        localStorage.removeItem('accessToken');
        setError('소셜 로그인 처리 중 오류가 발생했습니다.');
      }
    };

    void run();
  }, [location.search, checkAuth, navigate]);

  if (!error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
        <div className="max-w-md w-full">
          <div className="card">
            <Loading message="소셜 로그인 처리 중..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="max-w-md w-full">
        <div className="card space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">로그인 오류</h1>
          <p className="text-sm text-red-600">{error}</p>
          <Link to="/login" className="btn-primary w-full inline-flex justify-center py-3 font-medium">
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OAuth2CallbackPage;
