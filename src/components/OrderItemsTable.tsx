import React from 'react';
import { CartItem } from '../types';
import { formatVND, formatProductName } from '../utils/format';

interface Props {
  items: CartItem[];
  compact?: boolean;
}

/** Displays order line items in separated columns: Tên hàng, SL, Đơn giá, Thành tiền. */
export const OrderItemsTable: React.FC<Props> = ({ items, compact = false }) => {
  if (items.length === 0) return null;

  const cellPad = compact ? 'py-1 px-1.5' : 'py-1.5 px-2';
  const totalBags = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0
  );

  return (
    <div className="rounded-xl border-2 border-slate-300 overflow-x-auto bg-white">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] border-b-2 border-slate-300">
            <th className={`text-left ${cellPad}`}>Tên hàng</th>
            <th className={`text-center ${cellPad} whitespace-nowrap`}>SL</th>
            <th className={`text-right ${cellPad} whitespace-nowrap`}>Đơn giá</th>
            <th className={`text-right ${cellPad} whitespace-nowrap`}>Thành tiền</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const lineTotal = item.quantity * item.product.price;
            return (
              <tr key={item.product.id} className="text-slate-700">
                <td className={`${cellPad} align-top`}>
                  <span className="font-semibold text-slate-900 block leading-tight">
                    {formatProductName(item.product)}
                  </span>
                </td>
                <td className={`${cellPad} text-center align-top font-bold text-slate-800 whitespace-nowrap`}>
                  {item.quantity}b
                </td>
                <td className={`${cellPad} text-right align-top text-slate-600 whitespace-nowrap tabular-nums`}>
                  {formatVND(item.product.price)}
                </td>
                <td className={`${cellPad} text-right align-top font-black text-slate-900 whitespace-nowrap tabular-nums`}>
                  {formatVND(lineTotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 border-t-2 border-slate-300 text-slate-900 font-black">
            <td colSpan={3} className={`${cellPad} text-left uppercase text-[11px]`}>
              Tổng hóa đơn ({totalBags} bao):
            </td>
            <td className={`${cellPad} text-right whitespace-nowrap tabular-nums text-xs text-agri-900`}>
              {formatVND(totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

