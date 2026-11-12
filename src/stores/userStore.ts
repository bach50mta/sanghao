import { create } from 'zustand';
import { CustomerInfo } from '../types';
import { FIXED_DELIVERY_AREAS } from './areaStore';

interface UserState {
  customer: CustomerInfo;
  setCustomer: (info: Partial<CustomerInfo>) => void;
  resetCustomer: () => void;
}

const STORAGE_KEY = 'sanghao_customer_v1';

const defaultCustomer: CustomerInfo = {
  name: '',
  phone: '',
  farmAddress: '',
  area: FIXED_DELIVERY_AREAS[0],
  deliveryDate: 'Trong ngày',
  deliveryNote: ''
};

function loadSavedCustomer(): CustomerInfo {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultCustomer;
    const parsed = JSON.parse(saved);
    const merged = { ...defaultCustomer, ...parsed };
    if (typeof merged.area === 'string') {
      merged.area = merged.area.replace(/^Phường\s+/i, '').trim();
    }
    if (!FIXED_DELIVERY_AREAS.includes(merged.area)) {
      merged.area = FIXED_DELIVERY_AREAS[0];
    }
    return merged;
  } catch {
    return defaultCustomer;
  }
}

export const useUserStore = create<UserState>((set) => ({
  customer: loadSavedCustomer(),
  setCustomer: (info) => {
    set((state) => {
      const updated = { ...state.customer, ...info };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return { customer: updated };
    });
  },
  resetCustomer: () => {
    set({ customer: defaultCustomer });
  }
}));

