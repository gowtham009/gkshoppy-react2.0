import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Order, OrderItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Package } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function OrdersPage() {
  const { supabaseUser } = useAuth();
  const [orders, setOrders] = useState<(Order & { items: OrderItem[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (supabaseUser) fetchOrders();
  }, [supabaseUser]);

  async function fetchOrders() {
    setLoading(true);
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', supabaseUser!.id)
      .order('order_date', { ascending: false });

    if (!ordersData) { setLoading(false); return; }

    const ordersWithItems = await Promise.all(
      ordersData.map(async (order) => {
        const { data: items } = await supabase
          .from('order_items')
          .select('*, product:products(*)')
          .eq('order_id', order.id);
        return { ...order, items: (items as OrderItem[]) || [] };
      })
    );

    setOrders(ordersWithItems as (Order & { items: OrderItem[] })[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Package size={64} className="mx-auto text-gray-200 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">No orders yet</h2>
        <p className="text-gray-500">Your order history will appear here</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400 font-mono">#{order.id.slice(0, 8)}</p>
                <p className="text-sm text-gray-500">
                  {new Date(order.order_date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
                <span className="font-bold text-gray-900">₹{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-gray-600">
                  <span>{item.product?.name ?? 'Unknown Product'} × {item.quantity}</span>
                  <span>₹{(item.price_at_time_of_purchase * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
