import { ShoppingCart, Heart, Eye, Star } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../contexts/useCart';
import { useAuth } from '../contexts/AuthContext';
import { getGeneratedProductImage } from '../lib/productImages';

interface ProductCardProps {
  product: Product;
  onAuthRequired: () => void;
  onAddedToCart: () => void;
  onViewDetail: (product: Product) => void;
  wishlist: Set<string>;
  onToggleWishlist: (id: string) => void;
}

export default function ProductCard({ product, onAuthRequired, onAddedToCart, onViewDetail, wishlist, onToggleWishlist }: ProductCardProps) {
  const { addToCart } = useCart();
  const { user } = useAuth();

  async function handleAddToCart(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) { onAuthRequired(); return; }
    try {
      await addToCart(product);
      onAddedToCart();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Unable to add this item to your cart.');
    }
  }

  return (
    <div onClick={() => onViewDetail(product)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group">
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <img
          src={product.image_url || getGeneratedProductImage(product.name, product.category)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={event => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = getGeneratedProductImage(product.name, product.category);
          }}
        />
        {/* Wishlist */}
        <button onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }}
          className={`absolute top-2 right-2 p-1.5 rounded-full shadow-sm transition-colors
            ${wishlist.has(product.id) ? 'bg-red-500 text-white' : 'bg-white text-gray-400 hover:text-red-400'}`}>
          <Heart size={14} fill={wishlist.has(product.id) ? 'currentColor' : 'none'} />
        </button>
        {/* Quick view */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-white text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Eye size={12} /> Quick View
          </span>
        </div>
        {product.stock_quantity === 0 && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
      </div>

      <div className="p-3">
        {product.category && (
          <span className="text-xs text-indigo-500 font-semibold">{product.category}</span>
        )}
        <h3 className="font-semibold text-gray-900 text-sm mt-0.5 line-clamp-2 leading-snug">{product.name}</h3>
        <div className="flex items-center gap-1 mt-1 mb-2">
          {[1,2,3,4,5].map(s => <Star key={s} size={10} className="text-amber-400" fill="currentColor" />)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">₹{product.price.toFixed(2)}</span>
          <button onClick={handleAddToCart} disabled={product.stock_quantity === 0}
            className="flex items-center gap-1 bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <ShoppingCart size={12} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
