export interface Product {
  id: string;
  code: string;
  name: string;
  brand: string;
  stage: string;
  weightPerBag: number; // kg
  price: number; // VND per bag
  tonPrice: number; // VND per ton (ước tính sau chiết khấu)
  crudeProtein: string; // Hàm lượng đạm
  description: string;
  usageGuide: string;
  inStock: boolean;
  badge?: string;
}

export interface CartItem {
  product: Product;
  quantity: number; // Số bao
}

export interface CustomerInfo {
  name: string;
  phone: string;
  farmAddress: string;
  area: string;
  deliveryDate?: string;
  deliveryNote: string;
  zaloId?: string;
}

export type PaymentMethod = 'vietqr' | 'cod';

export interface Order {
  orderId: string;
  customer: CustomerInfo;
  items: CartItem[];
  totalBags: number;
  totalWeightKg: number;
  totalWeightTons: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  shippingNote: string;
  createdAt: string;
}

/**
 * Phiếu ghi chép thanh toán nợ của khách hàng
 */
export interface DebtPayment {
  paymentId: string;
  customerPhone: string;
  customerName: string;
  amount: number; // Số tiền khách trả
  paymentMethod: 'cash' | 'transfer'; // Tiền mặt hoặc chuyển khoản
  paidAt: string; // Ngày giờ thanh toán ISO
  note?: string; // Ghi chú (Ví dụ: Trả tiền đợt xuất chuồng, trả trước 1 phần...)
}

/**
 * Bảng tổng hợp công nợ theo từng khách hàng (gom theo SĐT)
 */
export interface CustomerDebtSummary {
  phone: string;
  name: string;
  farmAddress: string;
  area: string;
  totalOrdersCount: number;
  totalPurchased: number; // Tổng tiền cám đã mua từ trước đến nay
  totalPaid: number;      // Tổng tiền đã thanh toán
  currentDebt: number;    // Nợ hiện tại
  lastOrderDate?: string;
  lastPaymentDate?: string;
}

/**
 * Hóa đơn khi khách đặt đơn mới
 */
export interface OrderInvoice {
  orderId: string;
  customer: CustomerInfo;
  items: CartItem[];
  orderAmount: number;
  oldDebt: number;        // Nợ cũ trước đơn này
  totalDebtAfter: number; // Tổng nợ sau khi đặt = oldDebt + orderAmount (nếu nợ)
  createdAt: string;
}

/**
 * Phiếu thu nợ khi khách trả tiền
 */
export interface PaymentReceipt {
  paymentId: string;
  customer: {
    name: string;
    phone: string;
    farmAddress: string;
    area: string;
  };
  paidAt: string;
  lastPaymentDate?: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  note?: string;
  oldDebtFromLastPayment: number; // Nợ còn lại tính đến lần trả nợ gần nhất
  recentOrdersTotal: number;      // Tổng tiền các đơn phát sinh thêm (chưa thanh toán) sau lần trả nợ trước đó
  debtBeforePayment: number;      // Tổng nợ đến hôm nay (trước khi trả)
  debtRemaining: number;          // Số tiền nợ còn lại sau hôm nay
  recentOrders: Array<{
    orderId: string;
    createdAt: string;
    totalAmount: number;
    totalBags: number;
    isPaidDirect: boolean;
  }>;
}
