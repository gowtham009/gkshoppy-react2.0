import { ShoppingCart, Store, User, LogOut, Heart, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';

interface NavbarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

export default function Navbar({ onNavigate, currentPage }: NavbarProps) {
  const { profile, signOut } = useAuth();
  const { itemCount, total } = useCart();

  const navLink = (page: string, label: string) => (
    <button onClick={() => onNavigate(page)}
      className={`text-sm font-medium transition-colors px-1 py-0.5 border-b-2
        ${currentPage === page ? 'text-indigo-600 border-indigo-600' : 'text-gray-600 border-transparent hover:text-indigo-600'}`}>
      {label}
    </button>
  );

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => onNavigate('home')} className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">🎨</span>
            <span className="text-indigo-600">GK</span>
            <span className="text-gray-800">Shoppy</span>
          </button>

          <div className="hidden sm:flex items-center gap-5">
            {navLink('home', 'Shop')}
            {profile && navLink('orders', 'Orders')}
          </div>

          <div className="flex items-center gap-2">
            {profile ? (
              <>
                <button onClick={() => onNavigate('profile')}
                  className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                  <User size={16} />
                  <span className="max-w-24 truncate">{profile.username}</span>
                </button>
                <button onClick={() => onNavigate('orders')}
                  className="sm:hidden p-2 text-gray-500 hover:text-indigo-600">
                  <Package size={20} />
                </button>
                <button onClick={signOut}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button onClick={() => onNavigate('auth')}
                className="text-sm font-semibold text-indigo-600 border border-indigo-200 px-4 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                Sign In
              </button>
            )}

            <button onClick={() => onNavigate('cart')}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${currentPage === 'cart' ? 'bg-indigo-700 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
              <ShoppingCart size={16} />
              <span className="hidden sm:block">Cart</span>
              {itemCount > 0 && (
                <>
                  <span className="hidden sm:block text-indigo-200">·</span>
                  <span className="hidden sm:block">₹{total.toFixed(0)}</span>
                  <span className="absolute -top-2 -right-2 sm:hidden bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {itemCount}
                  </span>
                </>
              )}
              {itemCount > 0 && (
                <span className="hidden sm:flex absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 items-center justify-center font-bold">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
