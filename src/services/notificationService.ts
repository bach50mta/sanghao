import { Order } from '../types';
import { STORE_INFO } from '../data/mockProducts';
import { formatVND, formatProductName, formatWeight } from '../utils/format';

const WEBHOOK_STORAGE_KEY = 'sanghao_bot_webhook_url_v1';

export function getStoredWebhookUrl(): string {
  try {
    return localStorage.getItem(WEBHOOK_STORAGE_KEY) || ((import.meta as any).env?.VITE_ORDER_WEBHOOK_URL as string) || '';
  } catch {
    return '';
  }
}

export function saveStoredWebhookUrl(url: string): void {
  try {
    localStorage.setItem(WEBHOOK_STORAGE_KEY, url.trim());
  } catch {
    // Ignore
  }
}

export interface NotificationResult {
  shopNotified: boolean;
  customerNotified: boolean;
  details: string;
}

/**
 * Tự động gửi thông báo đơn hàng mới qua Chatbot / Webhook:
 * 1. Báo tức thời về Zalo / Telegram của Chủ Đại lý
 * 2. Gửi tin nhắn xác thực tạo đơn thành công về Zalo của Khách Hàng (thông qua Zalo OA / ZNS hoặc Webhook Bot)
 */
export async function sendAutomatedOrderNotification(order: Order): Promise<NotificationResult> {
  const webhookUrl = getStoredWebhookUrl();

  const formattedItems = order.items
    .map((it) => `• ${formatProductName(it.product)}: ${it.quantity} bao (${formatVND(it.quantity * it.product.price)})`)
    .join('\n');

  // Bản tin chuẩn hóa gửi cho Chủ Đại lý
  const shopMessage = `🔔 [ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO] CÓ ĐƠN CÁM MỚI!
------------------------------
Mã đơn: #${order.orderId}
Khách: ${order.customer.name} - 📞 ${order.customer.phone}
Khu vực: 📍 ${order.customer.area || 'Chưa chọn'}
Địa chỉ: ${order.customer.farmAddress}
Hẹn giờ giao: ${order.customer.deliveryNote || 'Càng sớm càng tốt'}

Danh sách cám:
${formattedItems}

Tổng: ${order.totalBags} bao (${formatWeight(order.totalWeightKg)})
Tiền: ${formatVND(order.totalAmount)} (${order.paymentMethod === 'vietqr' ? 'Chuyển khoản VietQR' : 'Tiền mặt khi nhận cám'})`;

  // Bản tin xác thực gửi cho Khách Hàng
  const customerConfirmationMessage = `✅ Đại lý Cám Sáng Hào xác nhận đã nhận đơn hàng #${order.orderId}!
Anh/Chị: ${order.customer.name}
Giao đến: ${order.customer.farmAddress} (${order.customer.area})
Số lượng: ${order.totalBags} bao cám
Tổng tiền: ${formatVND(order.totalAmount)}
Chủ Đại lý (${STORE_INFO.owner} - ${STORE_INFO.phone}) sẽ sớm liên hệ và điều xe giao tận chuồng cho bà con. Cảm ơn bà con đã tin tưởng!`;

  const payload = {
    event: 'order_created',
    orderId: order.orderId,
    createdAt: order.createdAt,
    shopOwner: {
      name: STORE_INFO.owner,
      phone: STORE_INFO.phone,
      zalo: STORE_INFO.zaloId
    },
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      area: order.customer.area,
      address: order.customer.farmAddress,
      deliveryNote: order.customer.deliveryNote
    },
    orderSummary: {
      totalBags: order.totalBags,
      totalWeightTons: order.totalWeightTons,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod
    },
    items: order.items.map((it) => ({
      name: formatProductName(it.product),
      code: it.product.code,
      quantity: it.quantity,
      price: it.product.price,
      subtotal: it.quantity * it.product.price
    })),
    messages: {
      forShopOwner: shopMessage,
      forCustomer: customerConfirmationMessage
    }
  };

  // Nếu đã cấu hình Webhook URL (Zalo OA Bot, Google Apps Script, n8n, Make, Telegram Bot...)
  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return {
          shopNotified: true,
          customerNotified: true,
          details: 'Đã tự động gửi thông báo đơn qua Chatbot Bot Webhook.'
        };
      }
    } catch (err) {
      console.warn('Webhook notification failed, fallbacking:', err);
    }
  }

  // Fallback: Lưu vào log hàng đợi thông báo local
  try {
    const queueKey = 'sanghao_pending_notifications_v1';
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    queue.push(payload);
    localStorage.setItem(queueKey, JSON.stringify(queue.slice(-50)));
  } catch {
    // Ignore
  }

  return {
    shopNotified: false,
    customerNotified: false,
    details: 'Đơn đã lưu hệ thống. Để kích hoạt chatbot tự động bắn tin qua Zalo, vui lòng kết nối Zalo OA / Webhook URL trong Quản trị.'
  };
}
