export interface User {
  id: string;
  username: string;
  full_name: string | null;
  email: string;
  created_at: string;
  shipping_address: string | null;
  billing_address: string | null;
  phone_number: string | null;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  stock_quantity: number;
  created_at: string;
  image_url: string | null;
  category: string | null;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  last_modified_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export interface Order {
  id: string;
  user_id: string;
  order_date: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_time_of_purchase: number;
  product?: Product;
}
