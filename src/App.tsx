import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import OrdersPage from './pages/OrdersPage';
import ProfilePage from './pages/ProfilePage';

function AppContent() {
  const [page, setPage] = useState('home');
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function navigate(p: string) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onNavigate={navigate} currentPage={page} />
      <main>
        {page === 'home' && <HomePage onAuthRequired={() => navigate('auth')} />}
        {page === 'auth' && <AuthPage onSuccess={() => navigate('home')} />}
        {page === 'cart' && <CartPage onNavigate={navigate} />}
        {page === 'orders' && <OrdersPage />}
        {page === 'profile' && <ProfilePage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}
