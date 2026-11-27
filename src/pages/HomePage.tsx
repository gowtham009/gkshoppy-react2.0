import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import { Product } from '../types';
import ProductCard from '../components/ProductCard';
import ProductModal from '../components/ProductModal';
import Toast, { ToastMessage } from '../components/Toast';
import { Search, SlidersHorizontal, Heart, LayoutGrid, List, ChevronDown, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/useCart';
import { useAuth } from '../contexts/AuthContext';
import { getGeneratedProductImage } from '../lib/productImages';

interface HomePageProps { onAuthRequired: () => void; }

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'name', label: 'Name A–Z' },
];

const DEMO_PRODUCTS: Product[] = [
  { id: 'demo-1', name: 'Rainbow Origami Paper Set', price: 299, description: 'Vibrant multi-colour origami paper in 20 colours.', stock_quantity: 150, created_at: '2026-01-01', image_url: '/product-images/origami.jpg', category: 'Origami' },
  { id: 'demo-2', name: 'Premium Scrapbook Starter Kit', price: 599, description: 'A complete kit for preserving memories beautifully.', stock_quantity: 50, created_at: '2026-01-02', image_url: '/product-images/scrapbooking.jpg', category: 'Scrapbooking' },
  { id: 'demo-3', name: 'Quilling Starter Kit', price: 449, description: 'Tools and colourful strips for creative paper coils.', stock_quantity: 80, created_at: '2026-01-03', image_url: '/product-images/quilling.jpg', category: 'Quilling' },
  { id: 'demo-4', name: 'Card Making Starter Kit', price: 499, description: 'Everything needed to make thoughtful handmade cards.', stock_quantity: 55, created_at: '2026-01-04', image_url: '/product-images/card-making.jpg', category: 'Card Making' },
  { id: 'demo-5', name: 'Paper Flower Making Kit', price: 399, description: 'Create beautiful roses and peonies from crepe paper.', stock_quantity: 70, created_at: '2026-01-05', image_url: '/product-images/paper-flowers.jpg', category: 'Paper Flowers' },
  { id: 'demo-6', name: 'Washi Tape Collection', price: 349, description: 'Ten premium washi rolls for journals and gifts.', stock_quantity: 130, created_at: '2026-01-06', image_url: '/product-images/washi-tape.jpg', category: 'Washi Tape' },
  { id: 'demo-7', name: 'Pastel Cardstock Pack', price: 299, description: 'Soft pastel sheets for cards, covers and journaling.', stock_quantity: 90, created_at: '2026-01-07', image_url: '/product-images/cardstock.jpg', category: 'Cardstock' },
  { id: 'demo-8', name: 'Kids Paper Craft Activity Box', price: 349, description: 'Ten fun paper projects for young makers.', stock_quantity: 100, created_at: '2026-01-08', image_url: '/product-images/kids-craft.jpg', category: 'Kids Craft' },
];

export default function HomePage({ onAuthRequired }: HomePageProps) {
  const { addToCart } = useCart();
  const { user } = useAuth();
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
  const [loadError, setLoadError] = useState('');

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const prods = await apiRequest<Product[]>('/products', {}, false);
      setProducts(prods);
      const cats = Array.from(new Set(prods.map(p => p.category).filter(Boolean))) as string[];
      setCategories(cats.sort());
      setLoadError('');
    } catch {
      setProducts(DEMO_PRODUCTS);
      setCategories(Array.from(new Set(DEMO_PRODUCTS.map(p => p.category).filter(Boolean))) as string[]);
      setLoadError('');
      addToast('Showing the featured catalog', 'success');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);

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
    if (!user) { onAuthRequired(); return; }
    try {
      await addToCart(product);
      addToast(`${product.name.slice(0, 30)}… added to cart 🛒`);
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Unable to add item to cart.', 'error');
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#f4c95d] mb-9 min-h-[390px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(255,255,255,.55),transparent_24%),linear-gradient(115deg,#f7df9d_0%,#f4c95d_58%,#edaf42_100%)]" />
        <div className="relative grid md:grid-cols-[1.05fr_.95fr] items-center min-h-[390px]">
          <div className="px-7 py-10 sm:px-12 md:px-14">
            <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-stone-700">
              New craft collection
            </span>
            <h1 className="mt-5 max-w-xl text-4xl sm:text-5xl lg:text-[58px] leading-[1.02] font-black tracking-tight text-stone-900">
              Make something beautiful.
            </h1>
            <p className="mt-5 max-w-lg text-base sm:text-lg text-stone-700">
              Thoughtfully chosen papers, tools and creative kits for every imagination.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-full bg-stone-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5">
                Shop the collection
              </button>
              <button onClick={() => setCategory('Origami')}
                className="rounded-full bg-white/75 px-6 py-3 text-sm font-bold text-stone-800 backdrop-blur-sm">
                Explore Origami
              </button>
            </div>
          </div>
          <div className="relative hidden h-full min-h-[390px] md:block">
            <div className="absolute right-[12%] top-[12%] h-[300px] w-[300px] rotate-3 rounded-[42px] bg-white/80 shadow-[0_30px_60px_rgba(93,71,31,.18)]" />
            <div className="absolute right-[18%] top-[18%] h-[255px] w-[255px] -rotate-6 rounded-[32px] bg-[#df6f62]" />
            <div className="absolute right-[22%] top-[24%] h-[210px] w-[210px] rotate-12 rounded-full border-[24px] border-[#f8eab7] bg-[#7b5cb5]" />
            <div className="absolute right-[31%] top-[31%] h-[120px] w-[120px] rotate-45 rounded-[18px] bg-[#f4c95d] shadow-xl" />
            <div className="absolute right-[8%] bottom-[10%] rounded-2xl bg-white px-4 py-3 shadow-xl">
              <p className="text-xs font-bold text-stone-500">CRAFT OF THE MONTH</p>
              <p className="text-sm font-black text-stone-900">Paper flower kit</p>
            </div>
          </div>
        </div>
      </section>

      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide">
        {['', ...categories].map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-bold border transition-all
              ${category === c ? 'bg-stone-900 text-white border-stone-900 shadow-md' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'}`}>
            {c || 'All products'}
          </button>
        ))}
      </div>

      {/* Search & Controls */}
      <div id="catalog" className="flex flex-col sm:flex-row gap-3 mb-3 scroll-mt-24">
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
          <p className="text-lg font-semibold text-gray-700">{loadError ? 'Products are unavailable' : 'No products found'}</p>
          <p className="text-sm text-gray-400 mt-1">{loadError || 'Try adjusting your search or filters'}</p>
          {products.length === 0 && (
            <p className="text-sm mt-4 text-indigo-500 bg-indigo-50 inline-block px-4 py-2 rounded-lg">
              Run <code className="font-mono">seed_products.sql</code> against the GKShoppy database to add products
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
                <img
                  src={p.image_url || getGeneratedProductImage(p.name, p.category)}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={event => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = getGeneratedProductImage(p.name, p.category);
                  }}
                />
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
