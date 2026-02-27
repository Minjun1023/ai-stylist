
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/common/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import Loading from './components/common/Loading';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OAuth2CallbackPage from './pages/OAuth2CallbackPage';
import SocialSignupPage from './pages/SocialSignupPage';
import HomePage from './pages/HomePage';
import CalendarPage from './pages/CalendarPage';
import PersonalColorPage from './pages/PersonalColorPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import StylePage from './pages/StylePage';
import StyleHistoryPage from './pages/StyleHistoryPage';
import ProductDetailPage from './pages/ProductDetailPage';

const App: React.FC = () => {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading message="앱을 불러오는 중..." />
      </div>
    );
  }

  const renderWithLayout = (page: React.ReactNode, protectedPage = false) => {
    const content = (
      <Layout>
        <div className="page-transition">{page}</div>
      </Layout>
    );

    if (protectedPage) {
      return <ProtectedRoute>{content}</ProtectedRoute>;
    }

    return content;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/oauth2/callback" element={<OAuth2CallbackPage />} />
        <Route path="/social-signup" element={<ProtectedRoute><SocialSignupPage /></ProtectedRoute>} />

        {/* Protected Routes */}
        <Route path="/" element={renderWithLayout(<HomePage />)} />
        <Route
          path="/style"
          element={<Navigate to={isAuthenticated ? '/style/recommend' : '/style/recommend/guest'} replace />}
        />
        <Route path="/calendar" element={renderWithLayout(<CalendarPage />, true)} />
        <Route path="/personal-color" element={renderWithLayout(<PersonalColorPage />, true)} />
        <Route path="/chat" element={renderWithLayout(<ChatPage />, true)} />
        <Route path="/style/recommend/guest" element={renderWithLayout(<StylePage />)} />
        <Route
          path="/style/recommend"
          element={isAuthenticated ? renderWithLayout(<StylePage />) : <Navigate to="/style/recommend/guest" replace />}
        />
        <Route path="/style/recommendations" element={renderWithLayout(<StyleHistoryPage />)} />
        <Route path="/profile" element={renderWithLayout(<ProfilePage />, true)} />
        <Route path="/catalog/products/:sku" element={renderWithLayout(<ProductDetailPage />)} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
