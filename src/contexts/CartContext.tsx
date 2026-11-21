import {
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { apiRequest } from '../lib/api';
import { CartResponse } from '../types';
import { useAuth } from './AuthContext';
import { CartContext } from './cart-context';
import { CartItem, Product } from '../types';

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCartId(null);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const cart = await apiRequest<CartResponse>('/cart');
      setCartId(cart.id);
      setItems(cart.items);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void refreshCart().catch((error: unknown) => {
        console.error('Unable to load the shopping cart:', error);
      });
    } else {
      setCartId(null);
      setItems([]);
    }
  }, [user, refreshCart]);

  async function addToCart(product: Product, quantity = 1) {
    if (!cartId) throw new Error('Your cart is still loading. Please try again.');
    const cart = await apiRequest<CartResponse>('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId: product.id, quantity }),
    });
    setItems(cart.items);
  }

  async function removeFromCart(cartItemId: string) {
    const cart = await apiRequest<CartResponse>(
      `/cart/items/${encodeURIComponent(cartItemId)}`,
      { method: 'DELETE' },
    );
    setItems(cart.items);
  }

  async function updateQuantity(cartItemId: string, quantity: number) {
    const cart = await apiRequest<CartResponse>(
      `/cart/items/${encodeURIComponent(cartItemId)}`,
      { method: 'PATCH', body: JSON.stringify({ quantity }) },
    );
    setItems(cart.items);
  }

  async function clearCart() {
    if (!cartId) return;
    const cart = await apiRequest<CartResponse>('/cart', { method: 'DELETE' });
    setItems(cart.items);
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce(
    (sum, i) => sum + (i.product?.price ?? 0) * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        total,
        loading,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
