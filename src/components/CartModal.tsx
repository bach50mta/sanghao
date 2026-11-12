import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, Truck, ArrowRight, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { formatVND, formatWeight, formatProductName } from '../utils/format';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: () => void;
}

type PendingCartDelete =
  | { kind: 'all' }
  | { kind: 'item'; productId: string; name: string };

export const CartModal: React.FC<Props> = ({ isOpen, onClose, onProceedToCheckout }) => {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const clearCart = useCartStore((state) => state.clearCart);
  const getTotalBags = useCartStore((state) => state.getTotalBags);
  const getTotalWeightKg = useCartStore((state) => state.getTotalWeightKg);
  const getTotalAmount = useCartStore((state) => state.getTotalAmount);
  const [pendingDelete, setPendingDelete] = useState<PendingCartDelete | null>(null);

  if (!isOpen) return null;

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'all') {
      clearCart();
    } else {
      removeFromCart(pendingDelete.productId);
    }
    setPendingDelete(null);
  };

  const totalBags = getTotalBags();
  const totalWeightKg = getTotalWeightKg();
  const totalAmount = getTotalAmount();

  // Đề xuất phương tiện vận chuyển dựa trên tải trọng
  const getVehicleAdvice = (kg: number) => {
    if (kg <= 0) return null;
    if (kg <= 400) {
      return {
        vehicle: 'Xe máy chở hàng',
        icon: '🛵',
        note: 'Giao nhanh linh hoạt vào tận ngõ ngách chuồng trại nhỏ.'
      };
    }
    if (kg <= 1500) {
      return {
        vehicle: 'Xe ba gác đại lý',
        icon: '🛺',
        note: 'Chở được từ 10 - 35 bao, thuận tiện đường đan nông thôn.'
      };
    }
    return {
      vehicle: 'Xe tải thùng đại lý Sáng Hào',
      icon: '🚚',
      note: 'Chở trên 1.5 tấn (trên 40 bao), bốc xếp tận kho trại của bạn.'
    };
  };

  const advice = getVehicleAdvice(totalWeightKg);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-surface-light">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-agri-100 flex items-center justify-center text-agri-800">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base leading-tight">Giỏ Hàng Của Bạn</h2>
              <p className="text-[11px] text-slate-500">{totalBags} bao thức ăn chăn nuôi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => setPendingDelete({ kind: 'all' })}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50"
              >
                Xóa tất cả
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-2">🛒</div>
              <p className="font-bold text-slate-700">Giỏ hàng đang trống</p>
              <p className="text-xs text-slate-500 mt-1">Bà con chọn loại cám phù hợp cho vật nuôi nhé!</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id}
                className="p-3 rounded-xl border-2 border-slate-300 bg-slate-50/50 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-bold text-slate-900">
                      {formatProductName(item.product)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.product.weightPerBag}kg/bao • {formatVND(item.product.price)}
                  </div>
                  <div className="text-xs font-bold text-agri-800 mt-0.5">
                    {formatVND(item.quantity * item.product.price)}
                    <span className="text-[10px] font-normal text-slate-500 ml-1">
                      ({item.quantity * item.product.weightPerBag}kg)
                    </span>
                  </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-1.5 bg-white border-2 border-slate-300 rounded-lg p-1 shrink-0">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 active:scale-90"
                    aria-label="Giảm 1 bao"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={item.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                      updateQuantity(item.product.id, val);
                    }}
                    className="w-12 text-center text-xs font-black text-slate-900 border-2 border-slate-300 rounded px-1 py-0.5 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-agri-600"
                    title="Gõ số bao cần mua"
                  />
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="w-6 h-6 rounded bg-agri-700 hover:bg-agri-800 text-white flex items-center justify-center font-bold active:scale-90"
                    aria-label="Tăng 1 bao"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={() =>
                    setPendingDelete({
                      kind: 'item',
                      productId: item.product.id,
                      name: formatProductName(item.product),
                    })
                  }
                  className="text-slate-400 hover:text-rose-500 p-1.5"
                  title="Xóa món này"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}

          {/* Vehicle Recommendation Box */}
          {advice && (
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border-2 border-amber-300 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-900 mb-1">
                <span className="text-base">{advice.icon}</span>
                <span>Phương tiện giao dự kiến: {advice.vehicle}</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                {advice.note}
              </p>
              <div className="mt-2 pt-2 border-t border-amber-200/70 flex items-center justify-between text-[11px] font-semibold text-amber-950">
                <span>Tổng tải trọng:</span>
                <span className="text-agri-900 font-bold">{formatWeight(totalWeightKg)} ({totalBags} bao)</span>
              </div>
            </div>
          )}

          {/* Shipping Policy Note */}
          {items.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 text-emerald-900 text-[11px] border-2 border-emerald-300">
              <Truck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Chính sách vận chuyển: </span>
                <span>Miễn phí giao hàng tận trại nội khu. Đơn ở xa Đại lý Thức ăn chăn nuôi Sáng Hào sẽ chủ động nhắn Zalo/gọi để thỏa thuận xe giao tiện nhất!</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Checkout Button */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <span className="text-xs text-slate-500 block">Tạm tính ({totalBags} bao):</span>
                <span className="text-xl font-black text-agri-800">{formatVND(totalAmount)}</span>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                Free ship nội khu
              </span>
            </div>

            <button
              onClick={onProceedToCheckout}
              className="w-full bg-agri-700 hover:bg-agri-800 active:scale-[0.98] text-white py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg shadow-agri-700/25 flex items-center justify-center gap-2 transition-all"
            >
              <span>Tiến hành đặt hàng</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={pendingDelete !== null}
        title="Bạn chắc chắn muốn xóa?"
        message={
          pendingDelete?.kind === 'all'
            ? `Xóa toàn bộ ${items.length} loại cám (${totalBags} bao) khỏi giỏ hàng hiện tại?`
            : pendingDelete
            ? `Xóa "${pendingDelete.name}" khỏi giỏ hàng của bạn?`
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

