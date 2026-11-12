import React, { useState, useEffect } from 'react';
import { X, Sparkles, Send } from 'lucide-react';
import { CustomerInfo, Order } from '../types';
import { useCartStore } from '../stores/cartStore';
import { useUserStore } from '../stores/userStore';
import { useAreaStore } from '../stores/areaStore';
import { useOrderStore } from '../stores/orderStore';
import { useDebtStore } from '../stores/debtStore';
import { formatVND, generateOrderId } from '../utils/format';
import { fetchZaloPhoneNumber, fetchZaloUserInfo } from '../services/zalo';
import { sendAutomatedOrderNotification } from '../services/notificationService';
import { OrderItemsTable } from './OrderItemsTable';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (order: Order, oldDebt: number) => void;
}

export const CheckoutModal: React.FC<Props> = ({ isOpen, onClose, onOrderCreated }) => {
  const items = useCartStore((state) => state.items);
  const getTotalBags = useCartStore((state) => state.getTotalBags);
  const getTotalWeightKg = useCartStore((state) => state.getTotalWeightKg);
  const getTotalAmount = useCartStore((state) => state.getTotalAmount);

  const areas = useAreaStore((state) => state.areas);
  const orders = useOrderStore((state) => state.orders);
  const getCustomerDebtAt = useDebtStore((state) => state.getCustomerDebtAt);

  const savedCustomer = useUserStore((state) => state.customer);
  const setCustomer = useUserStore((state) => state.setCustomer);

  const [formData, setFormData] = useState<CustomerInfo>({
    ...savedCustomer,
    area: areas.includes(savedCustomer.area) ? savedCustomer.area : (areas[0] || '')
  });
  const [loadingZalo, setLoadingZalo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tự động điền theo tên Zalo và SĐT của khách khi mở modal đặt đơn
  useEffect(() => {
    if (isOpen) {
      if (!formData.name || !formData.phone) {
        handleAutoFillZalo();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalBags = getTotalBags();
  const totalWeightKg = getTotalWeightKg();
  const totalAmount = getTotalAmount();

  const fieldControlClass =
    'flex-1 min-w-0 w-full h-9 px-3 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-agri-600 focus:border-agri-700';

  // Tính nợ cũ của tài khoản khách hàng này trước đơn hôm nay
  const cleanPhone = formData.phone.trim();
  const oldDebt = cleanPhone ? getCustomerDebtAt(cleanPhone, orders) : 0;

  const handleAutoFillZalo = async () => {
    setLoadingZalo(true);
    setErrorMsg('');
    try {
      const user = await fetchZaloUserInfo();
      const phone = await fetchZaloPhoneNumber();

      setFormData((prev) => {
        const updated = {
          ...prev,
          name: user.name || prev.name || '',
          phone: phone || prev.phone
        };
        setCustomer(updated);
        return updated;
      });
    } catch {
      // Fallback nhập tay
    } finally {
      setLoadingZalo(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Vui lòng nhập tên người mua.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 9) {
      setErrorMsg('Vui lòng nhập số điện thoại để Đại lý gọi giao cám.');
      return;
    }
    if (!formData.farmAddress.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ chuồng trại để xe chở đến.');
      return;
    }

    setCustomer(formData);

    const order: Order = {
      orderId: generateOrderId(),
      customer: formData,
      items: items,
      totalBags,
      totalWeightKg,
      totalWeightTons: Number((totalWeightKg / 1000).toFixed(2)),
      totalAmount,
      paymentMethod: 'cod',
      shippingNote: `Khu vực: ${formData.area} (Miễn phí nội khu)`,
      createdAt: new Date().toISOString()
    };

    // Tự động kích hoạt thông báo ngầm cho chủ Đại lý
    sendAutomatedOrderNotification(order).catch(() => { });

    // Mở màn hình xác nhận đặt hàng thành công kèm thông tin nợ cũ
    onOrderCreated(order, oldDebt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header đơn giản */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-agri-800 text-white">
          <div>
            <h2 className="font-black text-lg leading-tight uppercase tracking-wide">PHIẾU ĐẶT HÀNG</h2>
            <p className="text-xs text-agri-100">Tổng: {totalBags} bao • {formatVND(totalAmount)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form điền nhanh */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Nút bấm tự điền Zalo */}
          <button
            type="button"
            onClick={handleAutoFillZalo}
            disabled={loadingZalo}
            className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-300 text-blue-900 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>{loadingZalo ? 'Đang lấy từ Zalo...' : '✨ Tự động điền theo tài khoản Zalo của tôi'}</span>
          </button>

          {/* Họ tên người đặt */}
          <div className="flex items-center gap-2">
            <label className="w-28 shrink-0 text-xs font-bold text-slate-800">
              Họ tên người đặt:
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ví dụ: Bác Ba, Anh Hải..."
              className={fieldControlClass}
              required
            />
          </div>

          {/* Số điện thoại */}
          <div className="flex items-center gap-2">
            <label className="w-28 shrink-0 text-xs font-bold text-slate-800">
              SĐT:
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Số điện thoại liên hệ..."
              className={fieldControlClass}
              required
            />
          </div>

          {/* Địa chỉ */}
          <div className="flex items-center gap-2">
            <label className="w-28 shrink-0 text-xs font-bold text-slate-800">
              Địa chỉ:
            </label>
            <input
              type="text"
              value={formData.farmAddress}
              onChange={(e) => setFormData({ ...formData, farmAddress: e.target.value })}
              placeholder="Thôn/Xóm, số nhà..."
              className={fieldControlClass}
              required
            />
          </div>

          {/* Mục chọn khu vực */}
          <div className="flex items-center gap-2">
            <label className="w-28 shrink-0 text-xs font-bold text-slate-800">
              Khu vực:
            </label>
            <select
              value={formData.area}
              onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              className={fieldControlClass}
            >
              {areas.map((ar) => (
                <option key={ar} value={ar}>
                  {ar}
                </option>
              ))}
            </select>
          </div>

          {/* Ghi chú */}
          <div className="flex items-start gap-2">
            <label className="w-28 shrink-0 text-xs font-bold text-slate-800 pt-2">
              Ghi chú:
            </label>
            <textarea
              rows={2}
              value={formData.deliveryNote}
              onChange={(e) => setFormData({ ...formData, deliveryNote: e.target.value })}
              placeholder="Thời gian giao mong muốn hoặc dặn dò thêm..."
              className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-agri-600 focus:border-agri-700 leading-snug"
            />
          </div>

          {/* CHI TIẾT ĐƠN HÀNG: TÊN HÀNG / SL / ĐƠN GIÁ / THÀNH TIỀN */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900 uppercase tracking-wide">
              CHI TIẾT ĐƠN HÀNG ({totalBags} BAO):
            </label>
            <OrderItemsTable items={items} compact />
          </div>

          {/* Nút bấm to đùng chốt đơn */}
          <button
            type="submit"
            className="w-full bg-agri-700 hover:bg-agri-800 active:scale-95 text-white py-3.5 px-4 rounded-2xl font-black text-base shadow-lg shadow-agri-700/30 flex items-center justify-center gap-2 transition-all mt-2 tracking-wide"
          >
            <Send className="w-5 h-5 stroke-[2.5]" />
            <span>ĐẶT HÀNG</span>
          </button>
        </form>
      </div>
    </div>
  );
};
