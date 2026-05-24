import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { CartItem, Product } from '../types';
import { useAuth } from './AuthContext';

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  loading: boolean;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { supabaseUser } = useAuth();
  const [cartId, setCartId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (supabaseUser) {
      initCart(supabaseUser.id);
    } else {
      setCartId(null);
      setItems([]);
    }
  }, [supabaseUser]);

  async function initCart(userId: string) {
    setLoading(true);
    let { data: cart } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cart) {
      const { data: newCart } = await supabase
        .from('carts')
        .insert({ user_id: userId })
        .select('id')
        .single();
      cart = newCart;
    }

    if (cart) {
      setCartId(cart.id);
      await fetchItems(cart.id);
    }
    setLoading(false);
  }

  async function fetchItems(cId: string) {
    const { data } = await supabase
      .from('cart_items')
      .select('*, product:products(*)')
      .eq('cart_id', cId);
    setItems((data as CartItem[]) || []);
  }

  async function addToCart(product: Product, quantity = 1) {
    if (!cartId) return;
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      await updateQuantity(existing.id, existing.quantity + quantity);
    } else {
      await supabase.from('cart_items').insert({
        cart_id: cartId,
        product_id: product.id,
        quantity,
      });
      await fetchItems(cartId);
    }
  }

  async function removeFromCart(cartItemId: string) {
    await supabase.from('cart_items').delete().eq('id', cartItemId);
    setItems((prev) => prev.filter((i) => i.id !== cartItemId));
  }

  async function updateQuantity(cartItemId: string, quantity: number) {
    if (quantity <= 0) {
      await removeFromCart(cartItemId);
      return;
    }
    await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId);
    setItems((prev) =>
      prev.map((i) => (i.id === cartItemId ? { ...i, quantity } : i))
    );
  }

  async function clearCart() {
    if (!cartId) return;
    await supabase.from('cart_items').delete().eq('cart_id', cartId);
    setItems([]);
  }

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce(
    (sum, i) => sum + (i.product?.price ?? 0) * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ items, itemCount, total, loading, addToCart, removeFromCart, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
