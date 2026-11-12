import React from 'react';
import { ShoppingBag, ArrowRight, PhoneCall, MapPin } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { formatVND } from '../utils/format';
import { STORE_INFO } from '../data/mockProducts';

interface Props {
  onOpenCheckout: () => void;
  onOpenContact: () => void;
}

export const BottomBar: React.FC<Props> = ({ onOpenCheckout, onOpenContact }) => {
  const items = useCartStore((state) => state.items);
  const getTotalBags = useCartStore((state) => state.getTotalBags);
  const getTotalAmount = useCartStore((state) => state.getTotalAmount);

  const totalBags = getTotalBags();
  const totalAmount = getTotalAmount();

  if (items.length > 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-300 p-3 shadow-2xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Tổng tiền và số bao */}
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-agri-700 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md">
              {totalBags}b
            </div>
            <div>
              <div className="text-base font-black text-agri-900 leading-tight">
                {formatVND(totalAmount)}
              </div>
              <div className="text-xs text-slate-500 font-bold">
                Đã chọn {totalBags} bao cám
              </div>
            </div>
          </div>

          {/* Nút bấm Đặt hàng to nổi bật */}
          <button
            onClick={onOpenCheckout}
            className="bg-harvest-500 hover:bg-harvest-600 active:scale-95 text-slate-950 font-black text-sm py-3 px-5 rounded-2xl shadow-lg shadow-harvest-500/30 flex items-center gap-1.5 transition-all border border-harvest-600"
          >
            <span>ĐẶT MUA NGAY</span>
            <ArrowRight className="w-5 h-5 stroke-[3]" />
          </button>
        </div>
      </div>
    );
  }

  // Khi chưa chọn bao cám nào: hiển thị thanh hỗ trợ gọi nhanh
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-300 py-3 px-4 shadow-md">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2 text-xs">
        <button
          onClick={onOpenContact}
          className="flex items-center gap-1.5 text-slate-700 font-bold hover:text-agri-800"
        >
          <MapPin className="w-4 h-4 text-agri-700" />
          <span>{STORE_INFO.shortAddress}</span>
        </button>

        <a
          href={`tel:${STORE_INFO.phone}`}
          className="flex items-center gap-1 text-agri-800 font-black"
        >
          <PhoneCall className="w-4 h-4 text-harvest-600" />
          <span>{STORE_INFO.phone}</span>
        </a>
      </div>
    </div>
  );
};
