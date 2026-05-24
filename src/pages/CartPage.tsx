import { useState } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, Tag, ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface CartPageProps { onNavigate: (page: string) => void; }

export default function CartPage({ onNavigate }: CartPageProps) {
  const { items, total, removeFromCart, updateQuantity, clearCart } = useCart();
  const { supabaseUser } = useAuth();
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState('');
  const [checking, setChecking] = useState(false);
  const [placing, setPlacing] = useState(false);

  function applyCoupon() {
    setChecking(true);
    setTimeout(() => {
      if (coupon.toUpperCase() === 'CRAFT20') {
        setDiscount(0.20);
        setCouponMsg('✅ 20% discount applied!');
      } else {
        setDiscount(0);
        setCouponMsg('❌ Invalid coupon code');
      }
      setChecking(false);
    }, 600);
  }

  const discountAmount = total * discount;
  const shipping = total >= 499 ? 0 : 49;
  const finalTotal = total - discountAmount + shipping;

  async function handleCheckout() {
    if (!supabaseUser || items.length === 0) return;
    setPlacing(true);
    const { data: order, error } = await supabase
      .from('orders')
      .insert({ user_id: supabaseUser.id, total_amount: finalTotal, status: 'pending' })
      .select('id').single();
    if (error || !order) { setPlacing(false); alert('Checkout failed. Please try again.'); return; }
    await supabase.from('order_items').insert(
      items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_time_of_purchase: item.product?.price ?? 0,
      }))
    );
    await clearCart();
    setPlacing(false);
    onNavigate('orders');
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingBag size={72} className="mx-auto text-gray-100 mb-5" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-8">Looks like you haven't added anything yet</p>
        <button onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
          Browse Products <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Shopping Cart ({items.length} item{items.length !== 1 ? 's' : ''})</h1>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Items */}
        <div className="flex-1 space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 items-center">
              <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                {item.product?.image_url
                  ? <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-gray-200 text-xl">📦</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-indigo-500 font-semibold">{item.product?.category}</p>
                <p className="font-semibold text-gray-900 text-sm truncate">{item.product?.name}</p>
                <p className="text-sm text-gray-500">₹{item.product?.price.toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="px-2.5 py-1.5 hover:bg-gray-50 text-gray-600"><Minus size={12} /></button>
                <span className="px-3 py-1.5 text-sm font-semibold border-x border-gray-200 min-w-[2rem] text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="px-2.5 py-1.5 hover:bg-gray-50 text-gray-600"><Plus size={12} /></button>
              </div>
              <span className="font-bold text-gray-900 w-20 text-right">₹{((item.product?.price ?? 0) * item.quantity).toFixed(2)}</span>
              <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button onClick={clearCart} className="text-sm text-gray-400 hover:text-red-500 transition-colors mt-2">
            Clear cart
          </button>
        </div>

        {/* Summary */}
        <div className="lg:w-80 space-y-4">
          {/* Coupon */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Tag size={14} /> Coupon Code</p>
            <div className="flex gap-2">
              <input type="text" value={coupon} onChange={e => setCoupon(e.target.value)}
                placeholder="e.g. CRAFT20"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 uppercase" />
              <button onClick={applyCoupon} disabled={checking || !coupon}
                className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors">
                {checking ? '…' : 'Apply'}
              </button>
            </div>
            {couponMsg && <p className="text-xs mt-2">{couponMsg}</p>}
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="font-bold text-gray-900 mb-4">Order Summary</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>₹{total.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Discount (20%)</span><span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{shipping === 0 ? <span className="text-green-600 font-medium">Free</span> : `₹${shipping}`}</span>
              </div>
              {total < 499 && (
                <p className="text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded">
                  Add ₹{(499 - total).toFixed(0)} more for free shipping
                </p>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900 text-base">
                <span>Total</span><span>₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {supabaseUser ? (
              <button onClick={handleCheckout} disabled={placing}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                {placing ? 'Placing Order…' : <><span>Place Order</span><ArrowRight size={16} /></>}
              </button>
            ) : (
              <button onClick={() => onNavigate('auth')}
                className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700">
                Sign In to Checkout
              </button>
            )}
            <p className="text-center text-xs text-gray-400 mt-3">🔒 Secure checkout</p>
          </div>
        </div>
      </div>
    </div>
  );
}
