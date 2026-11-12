import { create } from 'zustand';
import { ManagedOrder } from './orderStore';
import {
  clearTable,
  deleteRecord,
  upsertMany,
  upsertRecord,
} from '../lib/supabaseSync';

export type DeliverySlipType = 'delivery' | 'pickup';

export interface DeliverySlipRecord {
  slipId: string;
  createdAt: string;
  driverNote: string;
  orders: ManagedOrder[];
  totalBags: number;
  slipType?: DeliverySlipType;
}

interface DeliverySlipState {
  slips: DeliverySlipRecord[];
  hydrateSlips: (slips: DeliverySlipRecord[]) => void;
  addSlip: (
    orders: ManagedOrder[],
    driverNote: string,
    slipType?: DeliverySlipType,
  ) => DeliverySlipRecord;
  syncOrderInSlips: (updatedOrder: ManagedOrder) => void;
  deleteSlip: (slipId: string) => void;
  clearAllSlips: () => void;
}

const SLIPS_STORAGE_KEY = 'sanghao_delivery_slips_v1';
const SLIP_SEQ_STORAGE_KEY = 'sanghao_delivery_slip_seq_v1';
const PICKUP_SEQ_STORAGE_KEY = 'sanghao_pickup_slip_seq_v1';

function generateDeliverySlipId(
  existingSlips: DeliverySlipRecord[],
  slipType: DeliverySlipType = 'delivery',
): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const codePrefix = slipType === 'pickup' ? 'TL' : 'PG';
  const seqKey = slipType === 'pickup' ? PICKUP_SEQ_STORAGE_KEY : SLIP_SEQ_STORAGE_KEY;
  const prefix = `${codePrefix}${yy}${mm}-`;

  let maxSeq = 0;
  try {
    maxSeq = parseInt(localStorage.getItem(seqKey) || '0', 10) || 0;
  } catch {
    maxSeq = 0;
  }

  const idRegex = new RegExp(`^${codePrefix}(?:\\d{4}|)-(\\d+)$`);
  for (const slip of existingSlips) {
    const match = typeof slip.slipId === 'string' ? slip.slipId.match(idRegex) : null;
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
    }
  }

  const nextSeq = maxSeq + 1;
  try {
    localStorage.setItem(seqKey, String(nextSeq));
  } catch {
    // Ignore storage write errors
  }
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

function loadInitialSlips(): DeliverySlipRecord[] {
  try {
    const raw = localStorage.getItem(SLIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const useDeliverySlipStore = create<DeliverySlipState>((set, get) => ({
  slips: loadInitialSlips(),

  hydrateSlips: (remoteSlips) => {
    const sorted = remoteSlips
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    try {
      localStorage.setItem(SLIPS_STORAGE_KEY, JSON.stringify(sorted));
    } catch {
      // Ignore storage write errors
    }
    set({ slips: sorted });
  },

  addSlip: (orders, driverNote, slipType = 'delivery') => {
    const current = get().slips;
    const record: DeliverySlipRecord = {
      slipId: generateDeliverySlipId(current, slipType),
      createdAt: new Date().toISOString(),
      driverNote: driverNote.trim(),
      orders: orders.map((o) => ({ ...o })),
      totalBags: orders.reduce((s, o) => s + o.totalBags, 0),
      slipType,
    };
    const updated = [record, ...current];
    try {
      localStorage.setItem(SLIPS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage write errors
    }
    set({ slips: updated });
    void upsertRecord('delivery_slips', record.slipId, record);
    return record;
  },

  syncOrderInSlips: (updatedOrder) => {
    set((state) => {
      let changed = false;
      const changedSlips: DeliverySlipRecord[] = [];
      const updated = state.slips.map((slip) => {
        if (!slip.orders.some((o) => o.orderId === updatedOrder.orderId)) {
          return slip;
        }
        changed = true;
        const orders = slip.orders.map((o) =>
          o.orderId === updatedOrder.orderId ? { ...updatedOrder } : o
        );
        const nextSlip: DeliverySlipRecord = {
          ...slip,
          orders,
          totalBags: orders.reduce((s, o) => s + o.totalBags, 0),
        };
        changedSlips.push(nextSlip);
        return nextSlip;
      });
      if (!changed) return state;
      try {
        localStorage.setItem(SLIPS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      void upsertMany(
        'delivery_slips',
        changedSlips.map((s) => ({ id: s.slipId, data: s })),
      );
      return { slips: updated };
    });
  },

  deleteSlip: (slipId) => {
    set((state) => {
      const updated = state.slips.filter((s) => s.slipId !== slipId);
      try {
        localStorage.setItem(SLIPS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      void deleteRecord('delivery_slips', slipId);
      return { slips: updated };
    });
  },

  clearAllSlips: () => {
    try {
      localStorage.removeItem(SLIPS_STORAGE_KEY);
      localStorage.removeItem(SLIP_SEQ_STORAGE_KEY);
      localStorage.removeItem(PICKUP_SEQ_STORAGE_KEY);
    } catch {
      // Ignore storage write errors
    }
    set({ slips: [] });
    void clearTable('delivery_slips');
  },
}));

