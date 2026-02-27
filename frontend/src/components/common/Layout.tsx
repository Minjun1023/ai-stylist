
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  HomeIcon,
  BellIcon,
  CpuChipIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuthStore();
  const styleRecommendPath = isAuthenticated ? '/style/recommend' : '/style/recommend/guest';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: HomeIcon, label: '홈' },
    { path: styleRecommendPath, icon: ShoppingBagIcon, label: '옷장' },
    { path: '/chat', icon: CpuChipIcon, label: '스타일리스트' },
    { path: '/profile', icon: UserCircleIcon, label: '프로필' },
  ];

  return (
    <div className="min-h-screen bg-[#f2f4f8] text-secondary-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-primary-100/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between px-5 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-50">
              <SparklesIcon className="h-6 w-6 text-primary-600" />
            </span>
            <span className="text-[30px] font-display font-semibold leading-none text-secondary-900">AI Stylist</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 transition-colors hover:bg-primary-100"
              aria-label="알림"
            >
              <BellIcon className="h-6 w-6" />
            </button>
            {isAuthenticated ? (
              <button
                onClick={handleLogout}
                className="hidden h-10 w-10 items-center justify-center rounded-full text-secondary-600 transition-colors hover:bg-secondary-100 hover:text-secondary-900 sm:inline-flex"
                aria-label="로그아웃"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                aria-label="로그인"
              >
                <UserCircleIcon className="h-5 w-5" />
                <span className="ml-2 hidden sm:inline">로그인</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6 sm:pb-8 sm:pt-7">
        {children}
      </main>

      {/* Bottom Navigation (Mobile) */}
      {isAuthenticated && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-primary-100/80 bg-white/95 backdrop-blur-sm md:hidden">
          <div className="flex h-16 items-center justify-around pb-[env(safe-area-inset-bottom)]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex min-w-[72px] flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide ${
                    isActive ? 'text-primary-600' : 'text-secondary-500'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
