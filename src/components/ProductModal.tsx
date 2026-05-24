import { useState } from 'react';
import { X, ShoppingCart, Package, Star, Minus, Plus, Heart } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  onAuthRequired: () => void;
  onAddedToCart: () => void;
  wishlist: Set<string>;
  onToggleWishlist: (id: string) => void;
}

export default function ProductModal({ product, onClose, onAuthRequired, onAddedToCart, wishlist, onToggleWishlist }: ProductModalProps) {
  const { addToCart } = useCart();
  const { supabaseUser } = useAuth();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!supabaseUser) { onAuthRequired(); return; }
    setAdding(true);
    await addToCart(product, qty);
    setAdding(false);
    onAddedToCart();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white rounded-full p-1.5 shadow-sm hover:bg-gray-100">
          <X size={18} />
        </button>

        <div className="aspect-video bg-gray-50 overflow-hidden rounded-t-2xl">
          {product.image_url
            ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><Package size={64} className="text-gray-200" /></div>
          }
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              {product.category && (
                <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wide bg-indigo-50 px-2 py-0.5 rounded-full">
                  {product.category}
                </span>
              )}
              <h2 className="text-xl font-bold text-gray-900 mt-2">{product.name}</h2>
            </div>
            <button onClick={() => onToggleWishlist(product.id)}
              className={`p-2 rounded-full border transition-colors flex-shrink-0
                ${wishlist.has(product.id) ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-400 hover:text-red-400'}`}>
              <Heart size={18} fill={wishlist.has(product.id) ? 'currentColor' : 'none'} />
            </button>
          </div>

          <div className="flex items-center gap-1 mb-3">
            {[1,2,3,4,5].map(s => <Star key={s} size={14} className="text-amber-400" fill="currentColor" />)}
            <span className="text-xs text-gray-500 ml-1">4.8 (124 reviews)</span>
          </div>

          <p className="text-gray-600 text-sm leading-relaxed mb-4">{product.description}</p>

          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold text-gray-900">₹{product.price.toFixed(2)}</span>
            <span className={`text-sm font-medium px-2 py-1 rounded-full
              ${product.stock_quantity > 10 ? 'bg-green-50 text-green-700'
              : product.stock_quantity > 0 ? 'bg-amber-50 text-amber-700'
              : 'bg-red-50 text-red-600'}`}>
              {product.stock_quantity > 10 ? 'In Stock'
               : product.stock_quantity > 0 ? `Only ${product.stock_quantity} left`
               : 'Out of Stock'}
            </span>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <span className="text-sm font-medium text-gray-700">Quantity</span>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setQty(Math.max(1, qty - 1))}
                className="px-3 py-2 hover:bg-gray-50 transition-colors">
                <Minus size={14} />
              </button>
              <span className="px-4 py-2 text-sm font-semibold border-x border-gray-200">{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock_quantity, qty + 1))}
                className="px-3 py-2 hover:bg-gray-50 transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <span className="text-sm text-gray-500">= ₹{(product.price * qty).toFixed(2)}</span>
          </div>

          <button onClick={handleAdd} disabled={adding || product.stock_quantity === 0}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <ShoppingCart size={18} />
            {adding ? 'Adding…' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
