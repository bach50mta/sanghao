import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { Product } from '../types';
import { useCartStore } from '../stores/cartStore';
import { formatVND, formatProductName } from '../utils/format';

interface Props {
  product: Product;
}

export const ProductCard: React.FC<Props> = ({ product }) => {
  const items = useCartStore((state) => state.items);
  const addToCart = useCartStore((state) => state.addToCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const cartItem = items.find((item) => item.product.id === product.id);
  const quantity = cartItem?.quantity || 0;

  const handleSetQuantity = (nextQty: number) => {
    const cleanQty = Math.max(0, nextQty);
    if (cleanQty === 0) {
      if (quantity > 0) updateQuantity(product.id, 0);
      return;
    }
    if (quantity === 0) {
      addToCart(product, cleanQty);
    } else {
      updateQuantity(product.id, cleanQty);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border-2 p-3.5 shadow-xs flex items-center justify-between gap-3 transition-colors ${
        quantity > 0 ? 'border-agri-600' : 'border-slate-300'
      }`}
    >
      {/* Thông tin chính: Tên cám, giá tiền & quy cách */}
      <div className="flex-1 min-w-0">
        <h3 className="font-extrabold text-slate-900 text-base leading-snug">
          {formatProductName(product)}
        </h3>

        <div className="text-lg font-black text-agri-800 mt-1">
          {formatVND(product.price)}
          <span className="text-xs font-normal text-slate-500"> /bao ({product.weightPerBag}kg)</span>
        </div>
      </div>

      {/* Ô nhập số bao luôn hiển thị (mặc định 0) để khách điền trực tiếp */}
      <div className="shrink-0">
        <div
          className={`flex items-center gap-1.5 rounded-xl p-1 transition-colors ${
            quantity > 0
              ? 'bg-agri-50 border-2 border-agri-600'
              : 'bg-slate-50 border-2 border-slate-300'
          }`}
        >
          <button
            type="button"
            onClick={() => handleSetQuantity(quantity - 1)}
            disabled={quantity === 0}
            className="w-8 h-8 rounded-lg bg-white shadow-xs text-agri-900 flex items-center justify-center font-black active:scale-90 border-2 border-slate-300 shrink-0 disabled:opacity-40 disabled:active:scale-100"
            aria-label="Giảm 1 bao"
          >
            <Minus className="w-4 h-4 stroke-[3]" />
          </button>
          <div className="flex flex-col items-center">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={quantity}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                handleSetQuantity(val);
              }}
              className={`w-14 text-center text-sm font-black bg-white border-2 rounded py-0.5 shadow-inner focus:outline-hidden focus:ring-2 focus:ring-agri-700 ${
                quantity > 0 ? 'text-agri-950 border-agri-400' : 'text-slate-600 border-slate-300'
              }`}
              aria-label={`Số bao ${formatProductName(product)}`}
              title="Gõ số bao cần mua"
            />
            <span className="text-[9px] text-agri-700 font-bold leading-none mt-0.5">bao</span>
          </div>
          <button
            type="button"
            onClick={() => handleSetQuantity(quantity + 1)}
            className="w-8 h-8 rounded-lg bg-agri-700 text-white shadow-xs flex items-center justify-center font-black active:scale-90 shrink-0"
            aria-label="Tăng 1 bao"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};
