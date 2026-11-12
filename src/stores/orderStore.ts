import { create } from 'zustand';
import { CartItem, Order } from '../types';
import { resetOrderSequence } from '../utils/format';

export type DeliveryStatus = 'pending' | 'shipping' | 'delivered';
export type PaymentStatus = 'unpaid' | 'paid';
export type OrderStatus = 'pending' | 'shipping' | 'delivered' | 'completed';

export interface ManagedOrder extends Order {
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
  deliveredAt?: string;
  paidAt?: string;
}

interface OrderState {
  orders: ManagedOrder[];
  addOrder: (order: Order) => void;
  updateStatus: (orderId: string, status: OrderStatus) => void;
  updateDeliveryStatus: (orderId: string, deliveryStatus: DeliveryStatus) => void;
  updatePaymentStatus: (orderId: string, paymentStatus: PaymentStatus) => void;
  toggleDelivered: (orderId: string) => void;
  markOrdersDelivered: (orderIds: string[]) => void;
  markOrdersPending: (orderIds: string[]) => void;
  togglePaid: (orderId: string) => void;
  updateOrderItems: (orderId: string, items: CartItem[]) => ManagedOrder | null;
  deleteOrder: (orderId: string) => void;
  clearAllOrders: () => void;
}

const STORAGE_KEY = 'sanghao_orders_store_v1';

function normalizeOrder(order: any): ManagedOrder {
  const deliveryStatus: DeliveryStatus =
    order.deliveryStatus ||
    (order.status === 'completed' || order.status === 'delivered'
      ? 'delivered'
      : order.status === 'shipping'
      ? 'shipping'
      : 'pending');

  const paymentStatus: PaymentStatus =
    order.paymentStatus || (order.status === 'completed' ? 'paid' : 'unpaid');

  const status: OrderStatus =
    deliveryStatus === 'delivered' && paymentStatus === 'paid'
      ? 'completed'
      : deliveryStatus === 'delivered'
      ? 'delivered'
      : deliveryStatus;

  const normalizedArea =
    typeof order.customer?.area === 'string'
      ? order.customer.area.replace(/^Phường\s+/i, '').trim()
      : order.customer?.area;

  return {
    ...order,
    customer: order.customer
      ? { ...order.customer, area: normalizedArea }
      : order.customer,
    deliveryStatus,
    paymentStatus,
    status
  };
}

function loadOrders(): ManagedOrder[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeOrder) : [];
  } catch {
    return [];
  }
}

function saveOrders(orders: ManagedOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Ignore
  }
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: loadOrders(),

  addOrder: (order) => {
    set((state) => {
      const managed: ManagedOrder = {
        ...order,
        deliveryStatus: 'pending',
        paymentStatus: 'unpaid',
        status: 'pending'
      };
      const updated: ManagedOrder[] = [managed, ...state.orders];
      saveOrders(updated);
      return { orders: updated };
    });
  },

  updateStatus: (orderId, status) => {
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (o.orderId !== orderId) return o;
        const deliveryStatus: DeliveryStatus =
          status === 'completed' || status === 'delivered' ? 'delivered' : status;
        const paymentStatus: PaymentStatus =
          status === 'completed' ? 'paid' : o.paymentStatus;
        return {
          ...o,
          status,
          deliveryStatus,
          paymentStatus
        };
      });
      saveOrders(updated);
      return { orders: updated };
    });
  },

  updateDeliveryStatus: (orderId, deliveryStatus) => {
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (o.orderId !== orderId) return o;
        const isCompleted = deliveryStatus === 'delivered' && o.paymentStatus === 'paid';
        const status: OrderStatus = isCompleted ? 'completed' : deliveryStatus === 'delivered' ? 'delivered' : deliveryStatus;
        return {
          ...o,
          deliveryStatus,
          status,
          deliveredAt: deliveryStatus === 'delivered' ? (o.deliveredAt || new Date().toISOString()) : undefined
        };
      });
      saveOrders(updated);
      return { orders: updated };
    });
  },

  updatePaymentStatus: (orderId, paymentStatus) => {
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (o.orderId !== orderId) return o;
        const isCompleted = o.deliveryStatus === 'delivered' && paymentStatus === 'paid';
        const status: OrderStatus = isCompleted ? 'completed' : o.deliveryStatus === 'delivered' ? 'delivered' : o.deliveryStatus;
        return {
          ...o,
          paymentStatus,
          status,
          paidAt: paymentStatus === 'paid' ? (o.paidAt || new Date().toISOString()) : undefined
        };
      });
      saveOrders(updated);
      return { orders: updated };
    });
  },

  toggleDelivered: (orderId) => {
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (o.orderId !== orderId) return o;
        const nextDelivery: DeliveryStatus = o.deliveryStatus === 'delivered' ? 'pending' : 'delivered';
        const isCompleted = nextDelivery === 'delivered' && o.paymentStatus === 'paid';
        const status: OrderStatus = isCompleted ? 'completed' : nextDelivery === 'delivered' ? 'delivered' : nextDelivery;
        return {
          ...o,
          deliveryStatus: nextDelivery,
          status,
          deliveredAt: nextDelivery === 'delivered' ? new Date().toISOString() : undefined
        };
      });
      saveOrders(updated);
      return { orders: updated };
    });
  },

  markOrdersDelivered: (orderIds) => {
    const idSet = new Set(orderIds);
    const nowIso = new Date().toISOString();
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (!idSet.has(o.orderId)) return o;
        const isCompleted = o.paymentStatus === 'paid';
        return {
          ...o,
          deliveryStatus: 'delivered',
          status: isCompleted ? 'completed' : 'delivered',
          deliveredAt: o.deliveredAt || nowIso
        };
      });
      saveOrders(updated);
      return { orders: updated };
    });
  },

  markOrdersPending: (orderIds) => {
    const idSet = new Set(orderIds);
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (!idSet.has(o.orderId)) return o;
        return {
          ...o,
          deliveryStatus: 'pending',
          status: 'pending',
          deliveredAt: undefined
        };
      });
      saveOrders(updated);
      return { orders: updated };
    });
  },

  togglePaid: (orderId) => {
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (o.orderId !== orderId) return o;
        const nextPayment: PaymentStatus = o.paymentStatus === 'paid' ? 'unpaid' : 'paid';
        const isCompleted = o.deliveryStatus === 'delivered' && nextPayment === 'paid';
        const status: OrderStatus = isCompleted ? 'completed' : o.deliveryStatus === 'delivered' ? 'delivered' : o.deliveryStatus;
        return {
          ...o,
          paymentStatus: nextPayment,
          status,
          paidAt: nextPayment === 'paid' ? new Date().toISOString() : undefined
        };
      });
      saveOrders(updated);
      return { orders: updated };
    });
  },

  updateOrderItems: (orderId, items) => {
    const cleanedItems = items.filter((it) => it.quantity > 0);
    if (cleanedItems.length === 0) return null;

    let editedOrder: ManagedOrder | null = null;
    set((state) => {
      const updated: ManagedOrder[] = state.orders.map((o) => {
        if (o.orderId !== orderId || o.deliveryStatus === 'delivered') return o;
        const totalBags = cleanedItems.reduce((sum, it) => sum + it.quantity, 0);
        const totalWeightKg = cleanedItems.reduce(
          (sum, it) => sum + it.quantity * it.product.weightPerBag,
          0
        );
        const totalWeightTons = Number((totalWeightKg / 1000).toFixed(2));
        const totalAmount = cleanedItems.reduce(
          (sum, it) => sum + it.quantity * it.product.price,
          0
        );
        editedOrder = {
          ...o,
          items: cleanedItems,
          totalBags,
          totalWeightKg,
          totalWeightTons,
          totalAmount,
        };
        return editedOrder;
      });
      saveOrders(updated);
      return { orders: updated };
    });
    return editedOrder;
  },

  deleteOrder: (orderId) => {
    set((state) => {
      const updated: ManagedOrder[] = state.orders.filter((o) => o.orderId !== orderId);
      saveOrders(updated);
      return { orders: updated };
    });
  },

  clearAllOrders: () => {
    resetOrderSequence();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    set({ orders: [] });
  }
}));
