export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

/** Formats product display text with product code first, avoiding duplicate codes. */
export function formatProductName(product: { code?: string; name: string }): string {
  const rawName = product.name.trim();
  const code = (product.code || '').trim();
  if (!code) return rawName;

  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = rawName
    .replace(new RegExp(`^${escapedCode}\\s*[-–:]?\\s*`, 'i'), '')
    .replace(new RegExp(`\\s*[-–(]*\\s*${escapedCode}\\s*\\)?$`, 'i'), '')
    .trim();

  return stripped ? `${code} - ${stripped}` : code;
}

export function formatWeight(totalKg: number): string {
  if (totalKg >= 1000) {
    const tons = Number((totalKg / 1000).toFixed(2));
    return `${tons} tấn`;
  }
  return `${totalKg.toLocaleString('vi-VN')} kg`;
}

const ORDER_SEQ_STORAGE_KEY = 'sanghao_order_seq_v1';
const ORDERS_STORAGE_KEY = 'sanghao_orders_store_v1';

/** Generates strictly sequential order IDs in format SHyymm-xxx (e.g. SH2611-001). */
export function generateOrderId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `SH${yy}${mm}-`;

  let maxSeq = 0;
  try {
    maxSeq = parseInt(localStorage.getItem(ORDER_SEQ_STORAGE_KEY) || '0', 10) || 0;
    const savedOrdersRaw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (savedOrdersRaw) {
      const parsed = JSON.parse(savedOrdersRaw);
      if (Array.isArray(parsed)) {
        for (const o of parsed) {
          const match = typeof o?.orderId === 'string' ? o.orderId.match(/^SH(?:\d{4}|)-(\d+)$/) : null;
          if (match) {
            maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
          }
        }
      }
    }
    const nextSeq = maxSeq + 1;
    localStorage.setItem(ORDER_SEQ_STORAGE_KEY, String(nextSeq));
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  } catch {
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }
}

/** Resets the sequential order ID counter back to zero so new orders start at SH-001. */
export function resetOrderSequence(): void {
  try {
    localStorage.removeItem(ORDER_SEQ_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export interface BankConfig {
  bankId: string; // e.g. MB, VCB, ICB, AGR, TCB
  bankName: string;
  accountNo: string;
  accountName: string;
}

export const STORE_BANK: BankConfig = {
  bankId: 'AGR', // Agribank (Ngân hàng Nông nghiệp & Phát triển Nông thôn)
  bankName: 'Agribank - Chi nhánh Thanh Hóa',
  accountNo: '3500205123456',
  accountName: 'KHUONG VAN SANG'
};

export function getVietQRUrl(amount: number, memo: string, bank: BankConfig = STORE_BANK): string {
  const cleanMemo = encodeURIComponent(memo.replace(/[^a-zA-Z0-9 ]/g, '').toUpperCase());
  const cleanName = encodeURIComponent(bank.accountName);
  return `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNo}-compact2.png?amount=${amount}&addInfo=${cleanMemo}&accountName=${cleanName}`;
}

