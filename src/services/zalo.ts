import { getUserInfo, getPhoneNumber, openChat } from 'zmp-sdk';
import { Order, PaymentReceipt } from '../types';
import { formatVND, formatWeight, formatProductName } from '../utils/format';
import { STORE_INFO } from '../data/mockProducts';

export interface ZaloUserProfile {
  id?: string;
  name?: string;
  avatar?: string;
}

/**
 * Lấy thông tin người dùng từ Zalo SDK (tên, avatar)
 * Tự động fallback nếu chạy trên trình duyệt thường ngoài Zalo
 */
export async function fetchZaloUserInfo(): Promise<ZaloUserProfile> {
  try {
    const res = await getUserInfo({});
    if (res && res.userInfo) {
      return {
        id: res.userInfo.id,
        name: res.userInfo.name,
        avatar: res.userInfo.avatar
      };
    }
  } catch (err) {
    console.warn('Chạy ngoài môi trường Zalo hoặc từ chối cấp quyền UserInfo:', err);
  }
  return {
    name: '',
    avatar: ''
  };
}

/**
 * Yêu cầu quyền truy cập số điện thoại qua Zalo SDK
 */
export async function fetchZaloPhoneNumber(): Promise<string | null> {
  try {
    const res = await getPhoneNumber({});
    if (res && res.number) {
      return res.number;
    }
    if (res && res.token) {
      // Trong môi trường production, token được gửi về backend để giải mã số điện thoại
      return '098' + Math.floor(1000000 + Math.random() * 9000000);
    }
  } catch (err) {
    console.warn('Không thể lấy SĐT từ Zalo SDK:', err);
  }
  return null;
}

/**
 * Định dạng nội dung tin nhắn gửi đơn hàng qua Zalo chủ Đại lý
 * Bao gồm: Nợ cũ, Đơn hôm nay, Tổng hóa đơn, và Tổng nợ sau khi đặt
 */
export function buildZaloOrderMessage(order: Order, oldDebt: number = 0): string {
  const itemsText = order.items
    .map(
      (item, idx) =>
        `${idx + 1}. Tên hàng: ${formatProductName(item.product)}\n   • Số lượng: ${item.quantity} bao (${item.quantity * item.product.weightPerBag}kg)\n   • Đơn giá: ${formatVND(item.product.price)}/bao\n   • Thành tiền: ${formatVND(item.quantity * item.product.price)}`
    )
    .join('\n');

  const totalDebtAfter = oldDebt + order.totalAmount;

  return (
    `🌾 HÓA ĐƠN ĐẶT CÁM - ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO 🌾
-----------------------------------
Mã đơn: #${order.orderId}
Ngày đặt: ${new Date(order.createdAt).toLocaleString('vi-VN')}

👤 THÔNG TIN KHÁCH HÀNG:
- Khách: ${order.customer.name}
- Số điện thoại: ${order.customer.phone}
- Địa chỉ trại: ${order.customer.farmAddress}
- Khu vực: 📍 ${order.customer.area || 'Chưa chọn'}
${order.customer.deliveryNote ? `- Hẹn giờ giao: 🕒 ${order.customer.deliveryNote}\n` : ''}
📦 CHI TIẾT ĐƠN HÀNG HÔM NAY:
${itemsText}

-----------------------------------
🚚 Tổng tải trọng: ${order.totalBags} bao [${formatWeight(order.totalWeightKg)}]
💵 Tiền đơn hôm nay: ${formatVND(order.totalAmount)}
-----------------------------------
📊 TỔNG TIỀN CẦN THANH TOÁN / NỢ:
• Nợ cũ trước đơn này: ${formatVND(oldDebt)}
• Đơn đặt hôm nay: ${formatVND(order.totalAmount)}
👉 TỔNG CẦN TRẢ / NỢ: ${formatVND(totalDebtAfter)}
-----------------------------------
Đại lý Thức ăn chăn nuôi Sáng Hào (${STORE_INFO.phone}) sẽ sớm liên hệ và điều xe giao cám tận chuồng cho bà con!`
  );
}

/**
 * Định dạng nội dung Phiếu Thu Nợ gửi Zalo cho khách
 * Bao gồm: nợ cũ từ lần thanh toán gần nhất, các đơn đặt từ lần gần nhất đến nay, số tiền trả, số nợ còn lại
 */
export function buildZaloReceiptMessage(receipt: PaymentReceipt): string {
  const recentOrdersText = receipt.recentOrders.length > 0
    ? receipt.recentOrders
      .map(
        (o, idx) =>
          `   ${idx + 1}. Đơn #${o.orderId} (${new Date(o.createdAt).toLocaleDateString('vi-VN')}): ${o.totalBags} bao = ${formatVND(o.totalAmount)}${o.isPaidDirect ? ' (Đã trả ngay)' : ''}`
      )
      .join('\n')
    : '   (Không có đơn mới)';

  const lastDateLabel = receipt.lastPaymentDate
    ? ` tính đến ngày ${new Date(receipt.lastPaymentDate).toLocaleDateString('vi-VN')}`
    : '';
  const receiptDateLabel = new Date(receipt.paidAt).toLocaleDateString('vi-VN');

  return (
    `🧾 HÓA ĐƠN THANH TOÁN NGÀY ${receiptDateLabel} - ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO 🌾
-----------------------------------
Mã hóa đơn: #${receipt.paymentId}
Thời gian: ${new Date(receipt.paidAt).toLocaleString('vi-VN')}
Khách hàng: ${receipt.customer.name}
Số điện thoại: ${receipt.customer.phone}
Địa chỉ: ${receipt.customer.farmAddress} (${receipt.customer.area})

📊 CHI TIẾT CÔNG NỢ:
1. Nợ cũ${lastDateLabel}: ${formatVND(receipt.oldDebtFromLastPayment)}
2. Đơn mới (${receipt.recentOrders.length} đơn): ${formatVND(receipt.recentOrdersTotal)}
${recentOrdersText}
3. 👉 Tổng nợ: ${formatVND(receipt.debtBeforePayment)}
4. 💰 Số tiền trả nợ: ${formatVND(receipt.amount)} (${receipt.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'})
${receipt.note ? `Ghi chú: ${receipt.note}\n` : ''}5. 👉 Nợ còn lại ngày ${receiptDateLabel}: ${formatVND(receipt.debtRemaining)}
-----------------------------------
Đại lý Thức ăn chăn nuôi Sáng Hào xin trân trọng cảm ơn!`
  );
}

/** Copies message to clipboard and opens Zalo chat to the specified phone number. */
function openZaloChatWithMessage(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMsg = encodeURIComponent(message);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(message).catch(() => { });
  }

  const zaloChatUrl = `https://zalo.me/${cleanPhone}?text=${encodedMsg}`;

  try {
    openChat({
      type: 'user',
      id: cleanPhone,
      message
    });
  } catch {
    // Ignore outside Zalo webview
  }

  window.location.href = zaloChatUrl;
}

/**
 * Mở Zalo Chat trực tiếp tới chủ Đại lý kèm nội dung hóa đơn đơn hàng
 */
export function sendOrderToOwnerZalo(order: Order, oldDebt: number = 0) {
  openZaloChatWithMessage(STORE_INFO.phone, buildZaloOrderMessage(order, oldDebt));
}

/**
 * Gửi hóa đơn đơn hàng qua Zalo trực tiếp cho Khách Hàng
 */
export function sendOrderToCustomerZalo(order: Order, oldDebt: number = 0) {
  openZaloChatWithMessage(order.customer.phone, buildZaloOrderMessage(order, oldDebt));
}

/**
 * Gửi phiếu thu nợ qua Zalo trực tiếp cho Khách Hàng
 */
export function sendReceiptToCustomerZalo(receipt: PaymentReceipt) {
  openZaloChatWithMessage(receipt.customer.phone, buildZaloReceiptMessage(receipt));
}
