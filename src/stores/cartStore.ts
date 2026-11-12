import { create } from 'zustand';
import { CartItem, Product } from '../types';

interface CartState {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getTotalBags: () => number;
  getTotalWeightKg: () => number;
  getTotalAmount: () => number;
}

const STORAGE_KEY = 'sanghao_cart_v1';

function loadInitialCart(): CartItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function persistCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  items: loadInitialCart(),

  addToCart: (product: Product, quantity = 1) => {
    set((state) => {
      const existingIndex = state.items.findIndex((item) => item.product.id === product.id);
      let updatedItems: CartItem[];
      if (existingIndex > -1) {
        updatedItems = state.items.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
        );
      } else {
        updatedItems = [...state.items, { product, quantity }];
      }
      persistCart(updatedItems);
      return { items: updatedItems };
    });
  },

  updateQuantity: (productId: string, quantity: number) => {
    set((state) => {
      let updatedItems: CartItem[];
      if (quantity <= 0) {
        updatedItems = state.items.filter((item) => item.product.id !== productId);
      } else {
        updatedItems = state.items.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        );
      }
      persistCart(updatedItems);
      return { items: updatedItems };
    });
  },

  removeFromCart: (productId: string) => {
    set((state) => {
      const updatedItems = state.items.filter((item) => item.product.id !== productId);
      persistCart(updatedItems);
      return { items: updatedItems };
    });
  },

  clearCart: () => {
    persistCart([]);
    set({ items: [] });
  },

  getTotalBags: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getTotalWeightKg: () => {
    return get().items.reduce((sum, item) => sum + item.quantity * item.product.weightPerBag, 0);
  },

  getTotalAmount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
  }
}));

