import { create } from 'zustand';
import { Product } from '../types';
import { MOCK_PRODUCTS } from '../data/mockProducts';
import { formatProductName } from '../utils/format';
import {
  clearTable,
  deleteRecord,
  upsertMany,
  upsertRecord,
} from '../lib/supabaseSync';

interface ProductState {
  products: Product[];
  hydrateProducts: (products: Product[]) => void;
  updatePrice: (id: string, newPrice: number) => void;
  toggleStock: (id: string) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  deleteProduct: (id: string) => void;
  resetDefaultProducts: () => void;
}

const STORAGE_KEY = 'sanghao_products_data_v2';

function loadProducts(): Product[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: Product) => ({
          ...p,
          brand: '',
          name: formatProductName(p)
        }));
      }
    }
  } catch (e) {
    console.error('Error loading products from storage:', e);
  }
  return MOCK_PRODUCTS;
}

function saveProducts(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch (e) {
    console.error('Error saving products:', e);
  }
}

export const useProductStore = create<ProductState>((set) => ({
  products: loadProducts(),

  hydrateProducts: (remoteProducts) => {
    const normalized = remoteProducts.map((p) => ({
      ...p,
      brand: '',
      name: formatProductName(p),
    }));
    saveProducts(normalized);
    set({ products: normalized });
  },

  updatePrice: (id, newPrice) => {
    set((state) => {
      const updated = state.products.map((p) =>
        p.id === id ? { ...p, price: newPrice } : p
      );
      saveProducts(updated);
      const target = updated.find((p) => p.id === id);
      if (target) void upsertRecord('products', target.id, target);
      return { products: updated };
    });
  },

  toggleStock: (id) => {
    set((state) => {
      const updated = state.products.map((p) =>
        p.id === id ? { ...p, inStock: !p.inStock } : p
      );
      saveProducts(updated);
      const target = updated.find((p) => p.id === id);
      if (target) void upsertRecord('products', target.id, target);
      return { products: updated };
    });
  },

  addProduct: (newProdData) => {
    set((state) => {
      const newProduct: Product = {
        ...newProdData,
        brand: '',
        name: formatProductName(newProdData),
        id: `prod-${Date.now()}`
      };
      const updated = [newProduct, ...state.products];
      saveProducts(updated);
      void upsertRecord('products', newProduct.id, newProduct);
      return { products: updated };
    });
  },

  deleteProduct: (id) => {
    set((state) => {
      const updated = state.products.filter((p) => p.id !== id);
      saveProducts(updated);
      void deleteRecord('products', id);
      return { products: updated };
    });
  },

  resetDefaultProducts: () => {
    saveProducts(MOCK_PRODUCTS);
    set({ products: MOCK_PRODUCTS });
    void clearTable('products').then(() =>
      upsertMany(
        'products',
        MOCK_PRODUCTS.map((p) => ({ id: p.id, data: p })),
      ),
    );
  }
}));

