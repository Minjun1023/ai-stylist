
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="max-w-md w-full">
        <div className="card">
          <h1 className="text-2xl font-bold text-gray-900">비밀번호 재설정</h1>
          <p className="text-gray-600 mt-2">
            가입한 이메일을 입력하면 비밀번호 재설정 방법을 안내합니다.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="example@email.com"
                required
              />
            </div>

            {submitted && (
              <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
                가입한 이메일로 재설정 링크가 전송되었습니다.
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={isLoading} className="btn-primary w-full py-3 font-medium">
              {isLoading ? '요청 중...' : '재설정 안내 받기'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
