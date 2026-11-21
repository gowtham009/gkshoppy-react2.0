import { createContext } from 'react';
import { CartItem, Product } from '../types';

export interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  total: number;
  loading: boolean;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

export const CartContext = createContext<CartContextValue | undefined>(undefined);
