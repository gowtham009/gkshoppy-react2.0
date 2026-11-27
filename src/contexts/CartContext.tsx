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
import { isLocalAuthMode } from '../lib/auth';

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  function demoCartKey() {
    return `gkshoppy.demo.cart.${user?.id ?? 'anonymous'}`;
  }

  const readDemoCart = useCallback((): CartItem[] => {
    try {
      return JSON.parse(localStorage.getItem(`gkshoppy.demo.cart.${user?.id ?? 'anonymous'}`) || '[]') as CartItem[];
    } catch {
      return [];
    }
  }, [user?.id]);

  function writeDemoCart(nextItems: CartItem[]) {
    localStorage.setItem(demoCartKey(), JSON.stringify(nextItems));
    setItems(nextItems);
  }

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCartId(null);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      if (isLocalAuthMode()) {
        setCartId(`demo-cart-${user.id}`);
        setItems(readDemoCart());
        return;
      }
      const cart = await apiRequest<CartResponse>('/cart');
      setCartId(cart.id);
      setItems(cart.items);
    } finally {
      setLoading(false);
    }
  }, [user, readDemoCart]);

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
    if (isLocalAuthMode()) {
      const existing = readDemoCart();
      const found = existing.find(item => item.product_id === product.id);
      const next = found
        ? existing.map(item => item.product_id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item)
        : [...existing, {
          id: `demo-item-${product.id}`,
          cart_id: `demo-cart-${user?.id}`,
          product_id: product.id,
          quantity,
          created_at: new Date().toISOString(),
          product,
        }];
      writeDemoCart(next);
      setCartId(`demo-cart-${user?.id}`);
      return;
    }
    if (!cartId) throw new Error('Your cart is still loading. Please try again.');
    const cart = await apiRequest<CartResponse>('/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId: product.id, quantity }),
    });
    setItems(cart.items);
  }

  async function removeFromCart(cartItemId: string) {
    if (isLocalAuthMode()) {
      writeDemoCart(readDemoCart().filter(item => item.id !== cartItemId));
      return;
    }
    const cart = await apiRequest<CartResponse>(
      `/cart/items/${encodeURIComponent(cartItemId)}`,
      { method: 'DELETE' },
    );
    setItems(cart.items);
  }

  async function updateQuantity(cartItemId: string, quantity: number) {
    if (isLocalAuthMode()) {
      const next = readDemoCart()
        .map(item => item.id === cartItemId ? { ...item, quantity } : item)
        .filter(item => item.quantity > 0);
      writeDemoCart(next);
      return;
    }
    const cart = await apiRequest<CartResponse>(
      `/cart/items/${encodeURIComponent(cartItemId)}`,
      { method: 'PATCH', body: JSON.stringify({ quantity }) },
    );
    setItems(cart.items);
  }

  async function clearCart() {
    if (isLocalAuthMode()) {
      writeDemoCart([]);
      return;
    }
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
