import { create } from 'zustand';
import { DebtPayment, PaymentReceipt, CustomerDebtSummary } from '../types';
import { ManagedOrder } from './orderStore';
import { clearTable, deleteRecord, upsertRecord } from '../lib/supabaseSync';

export interface DebtPreview {
  lastPaymentDate?: string;
  oldDebtFromLastPayment: number;
  recentOrders: Array<{
    orderId: string;
    createdAt: string;
    totalAmount: number;
    totalBags: number;
    isPaidDirect: boolean;
  }>;
  recentOrdersTotal: number;
  debtBeforePayment: number;
}

interface DebtState {
  payments: DebtPayment[];
  hydratePayments: (payments: DebtPayment[]) => void;
  addPayment: (data: Omit<DebtPayment, 'paymentId' | 'paidAt'>) => DebtPayment;
  deletePayment: (paymentId: string) => void;
  clearAllPayments: () => void;
  getCustomerSummary: (phone: string, orders: ManagedOrder[]) => CustomerDebtSummary | null;
  getAllCustomerSummaries: (orders: ManagedOrder[]) => CustomerDebtSummary[];
  getCustomerDebtAt: (phone: string, orders: ManagedOrder[], beforeDate?: string) => number;
  getPaymentPreview: (phone: string, orders: ManagedOrder[]) => DebtPreview;
  generatePaymentReceipt: (paymentId: string, orders: ManagedOrder[]) => PaymentReceipt | null;
}

const STORAGE_KEY = 'sanghao_debt_payments_v1';
const PAYMENT_SEQ_KEY = 'sanghao_payment_seq_v1';

/** Generates strictly sequential payment IDs (PT-001, PT-002, ...). */
function generatePaymentId(): string {
  let maxSeq = 0;
  try {
    maxSeq = parseInt(localStorage.getItem(PAYMENT_SEQ_KEY) || '0', 10) || 0;
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    if (savedRaw) {
      const parsed = JSON.parse(savedRaw);
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          const match = typeof p?.paymentId === 'string' ? p.paymentId.match(/^PT-(\d+)$/) : null;
          if (match) {
            maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
          }
        }
      }
    }
    const nextSeq = maxSeq + 1;
    localStorage.setItem(PAYMENT_SEQ_KEY, String(nextSeq));
    return `PT-${String(nextSeq).padStart(3, '0')}`;
  } catch {
    return `PT-${String(maxSeq + 1).padStart(3, '0')}`;
  }
}

function loadPayments(): DebtPayment[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function savePayments(payments: DebtPayment[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
  } catch {
    // Ignore
  }
}

type TimelineEvent =
  | { type: 'order'; id: string; date: string; amount: number; isUnpaid: boolean }
  | { type: 'payment'; id: string; date: string; amount: number };

function buildSortedTimeline(
  phone: string,
  orders: ManagedOrder[],
  payments: DebtPayment[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const ord of orders) {
    if (ord.customer.phone.trim() !== phone.trim()) continue;
    // Các đơn chưa giao chưa được tính vào công nợ
    if (ord.deliveryStatus !== 'delivered') continue;
    events.push({
      type: 'order',
      id: ord.orderId,
      date: ord.createdAt,
      amount: ord.totalAmount,
      isUnpaid: ord.paymentStatus === 'unpaid'
    });
  }

  for (const pm of payments) {
    if (pm.customerPhone.trim() !== phone.trim()) continue;
    events.push({
      type: 'payment',
      id: pm.paymentId,
      date: pm.paidAt,
      amount: pm.amount
    });
  }

  events.sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    // Nếu trùng thời gian, đơn hàng xảy ra trước thanh toán
    if (a.type === b.type) {
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    }
    return a.type === 'order' ? -1 : 1;
  });

  return events;
}

/**
 * Tính nợ của khách hàng theo sổ cái thời gian (Running Balance Ledger)
 * Nếu truyền beforeDate, chỉ tính các phát sinh trước thời điểm đó.
 */
export function computeCustomerDebtTimeline(
  phone: string,
  orders: ManagedOrder[],
  payments: DebtPayment[],
  beforeDate?: string
): number {
  if (!phone) return 0;
  const events = buildSortedTimeline(phone, orders, payments);

  let balance = 0;
  for (const ev of events) {
    if (beforeDate && ev.date >= beforeDate) continue;
    if (ev.type === 'order') {
      if (ev.isUnpaid) balance += ev.amount;
    } else {
      balance = Math.max(0, balance - ev.amount);
    }
  }

  return balance;
}

/**
 * Tính số dư nợ còn lại NGAY SAU khi áp dụng 1 phiếu thanh toán cụ thể
 */
function computeDebtRemainingAfterPayment(
  phone: string,
  orders: ManagedOrder[],
  payments: DebtPayment[],
  targetPaymentId: string
): number {
  const events = buildSortedTimeline(phone, orders, payments);
  let balance = 0;

  for (const ev of events) {
    if (ev.type === 'order') {
      if (ev.isUnpaid) balance += ev.amount;
    } else {
      balance = Math.max(0, balance - ev.amount);
      if (ev.id === targetPaymentId) {
        return balance;
      }
    }
  }

  return balance;
}

function buildCustomerDebtSummary(
  phone: string,
  customerOrders: ManagedOrder[],
  payments: DebtPayment[]
): CustomerDebtSummary {
  const latestOrder = customerOrders[0];
  const deliveredOrders = customerOrders.filter((o) => o.deliveryStatus === 'delivered');
  const customerPayments = payments.filter((p) => p.customerPhone.trim() === phone);

  const totalPurchased = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const paidDirectTotal = deliveredOrders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPaid =
    customerPayments.reduce((sum, p) => sum + p.amount, 0) + paidDirectTotal;

  const currentDebt = computeCustomerDebtTimeline(phone, customerOrders, payments);

  return {
    phone,
    name: latestOrder.customer.name,
    farmAddress: latestOrder.customer.farmAddress,
    area: latestOrder.customer.area,
    totalOrdersCount: deliveredOrders.length,
    totalPurchased,
    totalPaid,
    currentDebt,
    lastOrderDate: latestOrder.createdAt,
    lastPaymentDate: customerPayments[0]?.paidAt
  };
}

export const useDebtStore = create<DebtState>((set, get) => ({
  payments: loadPayments(),

  hydratePayments: (remotePayments) => {
    const sorted = remotePayments
      .slice()
      .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
    savePayments(sorted);
    set({ payments: sorted });
  },

  addPayment: (data) => {
    const newPayment: DebtPayment = {
      ...data,
      paymentId: generatePaymentId(),
      paidAt: new Date().toISOString()
    };

    set((state) => {
      const updated = [newPayment, ...state.payments];
      savePayments(updated);
      return { payments: updated };
    });

    void upsertRecord('debt_payments', newPayment.paymentId, newPayment);
    return newPayment;
  },

  deletePayment: (paymentId) => {
    set((state) => {
      const updated = state.payments.filter((p) => p.paymentId !== paymentId);
      savePayments(updated);
      return { payments: updated };
    });
    void deleteRecord('debt_payments', paymentId);
  },

  clearAllPayments: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PAYMENT_SEQ_KEY);
    } catch {
      // Ignore
    }
    set({ payments: [] });
    void clearTable('debt_payments');
  },

  getCustomerDebtAt: (phone, orders, beforeDate) => {
    const { payments } = get();
    return computeCustomerDebtTimeline(phone, orders, payments, beforeDate);
  },

  getCustomerSummary: (phone, orders) => {
    const { payments } = get();
    const cleanPhone = phone.trim();
    const customerOrders = orders.filter((o) => o.customer.phone.trim() === cleanPhone);
    if (customerOrders.length === 0) return null;

    return buildCustomerDebtSummary(cleanPhone, customerOrders, payments);
  },

  getAllCustomerSummaries: (orders) => {
    const { payments } = get();
    const phoneMap = new Map<string, ManagedOrder[]>();

    for (const ord of orders) {
      const phone = ord.customer.phone.trim();
      if (!phone) continue;
      const list = phoneMap.get(phone) || [];
      list.push(ord);
      phoneMap.set(phone, list);
    }

    const summaries: CustomerDebtSummary[] = [];
    for (const [phone, customerOrders] of phoneMap.entries()) {
      summaries.push(buildCustomerDebtSummary(phone, customerOrders, payments));
    }

    return summaries.sort((a, b) => b.currentDebt - a.currentDebt);
  },

  getPaymentPreview: (phone, orders) => {
    const { payments } = get();
    const cleanPhone = phone.trim();
    const customerOrders = orders
      .filter((o) => o.customer.phone.trim() === cleanPhone && o.deliveryStatus === 'delivered')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const customerPaymentsSorted = payments
      .filter((p) => p.customerPhone.trim() === cleanPhone)
      .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

    const lastPayment =
      customerPaymentsSorted.length > 0
        ? customerPaymentsSorted[customerPaymentsSorted.length - 1]
        : null;

    // Nợ còn lại tính đến lần trả nợ gần nhất (SAU khi đã trừ số tiền lần trả trước)
    const oldDebtFromLastPayment = lastPayment
      ? computeDebtRemainingAfterPayment(cleanPhone, orders, payments, lastPayment.paymentId)
      : 0;

    // Các đơn phát sinh thêm sau lần trả nợ trước đó đến hiện tại
    const recentOrders = customerOrders.filter((o) => {
      if (!lastPayment) return true;
      return new Date(o.createdAt).getTime() > new Date(lastPayment.paidAt).getTime();
    });

    const recentOrdersTotal = recentOrders
      .filter((o) => o.paymentStatus === 'unpaid')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const debtBeforePayment = oldDebtFromLastPayment + recentOrdersTotal;

    return {
      lastPaymentDate: lastPayment?.paidAt,
      oldDebtFromLastPayment,
      recentOrders: recentOrders.map((o) => ({
        orderId: o.orderId,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        totalBags: o.totalBags,
        isPaidDirect: o.paymentStatus === 'paid'
      })),
      recentOrdersTotal,
      debtBeforePayment
    };
  },

  generatePaymentReceipt: (paymentId, orders) => {
    const { payments } = get();
    const currentPayment = payments.find((p) => p.paymentId === paymentId);
    if (!currentPayment) return null;

    const phone = currentPayment.customerPhone.trim();
    const customerOrders = orders
      .filter((o) => o.customer.phone.trim() === phone && o.deliveryStatus === 'delivered')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const latestOrder =
      customerOrders[customerOrders.length - 1] ||
      orders.find((o) => o.customer.phone.trim() === phone);

    // Tìm lần trả nợ ngay trước currentPayment
    const allCustomerPaymentsSorted = payments
      .filter((p) => p.customerPhone.trim() === phone)
      .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());

    const currentIndex = allCustomerPaymentsSorted.findIndex((p) => p.paymentId === paymentId);
    const previousPayment = currentIndex > 0 ? allCustomerPaymentsSorted[currentIndex - 1] : null;

    // 1. Nợ còn lại tính đến lần trả nợ gần nhất (sau khi trừ số tiền lần trước đã trả)
    const oldDebtFromLastPayment = previousPayment
      ? computeDebtRemainingAfterPayment(phone, orders, payments, previousPayment.paymentId)
      : 0;

    // 2. Các đơn phát sinh thêm sau lần trả nợ trước đó đến thời điểm trả nợ này
    const currentPaidTime = new Date(currentPayment.paidAt).getTime();
    const prevPaidTime = previousPayment ? new Date(previousPayment.paidAt).getTime() : -Infinity;

    const recentOrders = customerOrders.filter((o) => {
      const ordTime = new Date(o.createdAt).getTime();
      return ordTime > prevPaidTime && ordTime <= currentPaidTime;
    });

    const recentOrdersTotal = recentOrders
      .filter((o) => o.paymentStatus === 'unpaid')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // 3. Tổng nợ đến hôm nay (trước khi trừ số tiền trả lần này)
    const debtBeforePayment = oldDebtFromLastPayment + recentOrdersTotal;

    // 4. Số tiền nợ còn lại sau hôm nay
    const debtRemaining = Math.max(0, debtBeforePayment - currentPayment.amount);

    return {
      paymentId: currentPayment.paymentId,
      customer: {
        name: currentPayment.customerName || latestOrder?.customer.name || 'Khách Hàng',
        phone,
        farmAddress: latestOrder?.customer.farmAddress || '',
        area: latestOrder?.customer.area || ''
      },
      paidAt: currentPayment.paidAt,
      lastPaymentDate: previousPayment?.paidAt,
      amount: currentPayment.amount,
      paymentMethod: currentPayment.paymentMethod,
      note: currentPayment.note,
      oldDebtFromLastPayment,
      recentOrdersTotal,
      debtBeforePayment,
      debtRemaining,
      recentOrders: recentOrders.map((o) => ({
        orderId: o.orderId,
        createdAt: o.createdAt,
        totalAmount: o.totalAmount,
        totalBags: o.totalBags,
        isPaidDirect: o.paymentStatus === 'paid'
      }))
    };
  }
}));
