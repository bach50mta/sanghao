import { DebtPayment, Product } from '../types';
import { ManagedOrder, useOrderStore } from '../stores/orderStore';
import { DeliverySlipRecord, useDeliverySlipStore } from '../stores/deliverySlipStore';
import { useProductStore } from '../stores/productStore';
import { useDebtStore } from '../stores/debtStore';
import { isSupabaseConfigured } from './supabase';
import {
  fetchCollection,
  subscribeTableChanges,
  SyncTable,
  upsertMany,
} from './supabaseSync';

async function syncTableFromRemote<T>(
  table: SyncTable,
  getLocal: () => T[],
  getId: (item: T) => string,
  hydrate: (items: T[]) => void,
  allowSeedIfRemoteEmpty: boolean,
): Promise<void> {
  const remote = await fetchCollection<T>(table);
  if (!remote) return;
  if (remote.length > 0) {
    hydrate(remote);
    return;
  }
  if (allowSeedIfRemoteEmpty) {
    const local = getLocal();
    if (local.length > 0) {
      await upsertMany(
        table,
        local.map((item) => ({ id: getId(item), data: item })),
      );
    }
  } else {
    hydrate([]);
  }
}

/**
 * Initializes bidirectional Supabase sync (initial hydration + Realtime updates).
 * Safely no-ops when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not configured.
 */
export function initSupabaseSync(): () => void {
  if (!isSupabaseConfigured) return () => {};

  const syncProducts = (allowSeed: boolean) =>
    syncTableFromRemote<Product>(
      'products',
      () => useProductStore.getState().products,
      (p) => p.id,
      (items) => useProductStore.getState().hydrateProducts(items),
      allowSeed,
    );

  const syncOrders = (allowSeed: boolean) =>
    syncTableFromRemote<ManagedOrder>(
      'orders',
      () => useOrderStore.getState().orders,
      (o) => o.orderId,
      (items) => useOrderStore.getState().hydrateOrders(items),
      allowSeed,
    );

  const syncSlips = (allowSeed: boolean) =>
    syncTableFromRemote<DeliverySlipRecord>(
      'delivery_slips',
      () => useDeliverySlipStore.getState().slips,
      (s) => s.slipId,
      (items) => useDeliverySlipStore.getState().hydrateSlips(items),
      allowSeed,
    );

  const syncPayments = (allowSeed: boolean) =>
    syncTableFromRemote<DebtPayment>(
      'debt_payments',
      () => useDebtStore.getState().payments,
      (p) => p.paymentId,
      (items) => useDebtStore.getState().hydratePayments(items),
      allowSeed,
    );

  void Promise.all([
    syncProducts(true),
    syncOrders(true),
    syncSlips(true),
    syncPayments(true),
  ]);

  const unsubs = [
    subscribeTableChanges('products', () => void syncProducts(false)),
    subscribeTableChanges('orders', () => void syncOrders(false)),
    subscribeTableChanges('delivery_slips', () => void syncSlips(false)),
    subscribeTableChanges('debt_payments', () => void syncPayments(false)),
  ];

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}

