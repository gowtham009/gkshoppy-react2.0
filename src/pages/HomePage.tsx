import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../types';
import ProductCard from '../components/ProductCard';
import ProductModal from '../components/ProductModal';
import Toast, { ToastMessage } from '../components/Toast';
import { Search, SlidersHorizontal, Heart, LayoutGrid, List, ChevronDown, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

interface HomePageProps { onAuthRequired: () => void; }

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'name', label: 'Name A–Z' },
];

export default function HomePage({ onAuthRequired }: HomePageProps) {
  const { addToCart } = useCart();
  const { supabaseUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [showWishlist, setShowWishlist] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [maxPrice, setMaxPrice] = useState(2000);
  const [showFilters, setShowFilters] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    const prods = (data as Product[]) || [];
    setProducts(prods);
    const cats = Array.from(new Set(prods.map(p => p.category).filter(Boolean))) as string[];
    setCategories(cats.sort());
    setLoading(false);
  }

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  function toggleWishlist(id: string) {
    setWishlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); addToast('Removed from wishlist'); }
      else { next.add(id); addToast('Added to wishlist ❤️'); }
      return next;
    });
  }

  async function handleQuickAdd(product: Product) {
    if (!supabaseUser) { onAuthRequired(); return; }
    await addToCart(product);
    addToast(`${product.name.slice(0, 30)}… added to cart 🛒`);
  }

  const filtered = products
    .filter(p => {
      if (showWishlist && !wishlist.has(p.id)) return false;
      if (inStockOnly && p.stock_quantity === 0) return false;
      const q = search.toLowerCase();
      const matchSearch = !search || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
      const matchCat = !category || p.category === category;
      const matchPrice = p.price <= maxPrice;
      return matchSearch && matchCat && matchPrice;
    })
    .sort((a, b) => {
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-around opacity-10 text-9xl select-none pointer-events-none">
          🦢🌸📄✂️🎨
        </div>
        <div className="relative">
          <p className="text-indigo-100 text-sm font-semibold uppercase tracking-wider mb-1">GK Shoppy</p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Paper Craft Paradise</h1>
          <p className="text-indigo-100 mb-4">50+ premium paper craft products — origami, scrapbooking, quilling &amp; more</p>
          <div className="flex flex-wrap gap-2">
            {['🚚 Free Shipping ₹499+', '✅ 100% Handpicked', '↩️ Easy Returns'].map(tag => (
              <span key={tag} className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {['', ...categories].map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${category === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'}`}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search products, categories…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors
              ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 bg-white hover:border-indigo-400'}`}>
            <SlidersHorizontal size={14} /> Filters
          </button>
          <button onClick={() => setShowWishlist(!showWishlist)}
            className={`relative flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-colors
              ${showWishlist ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 bg-white hover:border-red-300'}`}>
            <Heart size={14} fill={showWishlist ? 'currentColor' : 'none'} />
            {wishlist.size > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">{wishlist.size}</span>}
          </button>
          <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            className="p-2.5 border border-gray-200 rounded-xl text-gray-600 hover:border-indigo-400 bg-white">
            {viewMode === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 flex flex-wrap gap-8 items-start">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Max Price: ₹{maxPrice}</p>
            <input type="range" min={100} max={2000} step={50} value={maxPrice}
              onChange={e => setMaxPrice(Number(e.target.value))}
              className="w-48 accent-indigo-600" />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>₹100</span><span>₹2000</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Availability</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
              In Stock Only
            </label>
          </div>
          <button onClick={() => { setMaxPrice(2000); setInStockOnly(false); setSearch(''); setCategory(''); setSort('newest'); }}
            className="text-xs text-indigo-600 hover:underline self-end mb-0.5">Reset all filters</button>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4">
        {loading ? 'Loading products…' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}
        {category && <span className="ml-1 font-semibold text-indigo-600">in {category}</span>}
        {showWishlist && <span className="ml-1 text-red-500">· wishlist</span>}
      </p>

      {/* Product Grid / List */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl aspect-[3/4] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Search size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="text-lg font-semibold text-gray-700">No products found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
          {products.length === 0 && (
            <p className="text-sm mt-4 text-indigo-500 bg-indigo-50 inline-block px-4 py-2 rounded-lg">
              Run <code className="font-mono">seed_products.sql</code> in Supabase SQL Editor to add products
            </p>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p}
              onAuthRequired={onAuthRequired}
              onAddedToCart={() => addToast(`Added to cart 🛒`)}
              onViewDetail={setSelectedProduct}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(p => (
            <div key={p.id} onClick={() => setSelectedProduct(p)}
              className="bg-white border border-gray-100 rounded-xl p-4 flex gap-4 hover:shadow-md cursor-pointer transition-shadow items-center">
              <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-200 text-2xl">📦</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-indigo-500 font-semibold">{p.category}</span>
                <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{p.description}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="font-bold text-gray-900 text-lg">₹{p.price.toFixed(2)}</span>
                <button onClick={e => { e.stopPropagation(); handleQuickAdd(p); }}
                  disabled={p.stock_quantity === 0}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                  <ShoppingCart size={12} /> Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProduct && (
        <ProductModal product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAuthRequired={() => { setSelectedProduct(null); onAuthRequired(); }}
          onAddedToCart={() => addToast(`Added to cart 🛒`)}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist} />
      )}

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
