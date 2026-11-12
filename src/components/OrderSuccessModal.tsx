import React from 'react';
import { CheckCircle2, X, MapPin, Calendar } from 'lucide-react';
import { Order } from '../types';
import { OrderItemsTable } from './OrderItemsTable';

interface Props {
  order: Order | null;
  oldDebt?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<Props> = ({ order, isOpen, onClose }) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Top Success Banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-agri-700 text-white p-5 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-2 backdrop-blur shadow-inner">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-extrabold text-lg">Đặt Hàng Thành Công!</h3>
          <p className="text-xs text-emerald-100 mt-0.5">
            Mã đơn: <span className="font-bold text-white">#{order.orderId}</span>
          </p>
        </div>

        {/* Order Details Body */}
        <div className="p-4 space-y-3 text-xs overflow-y-auto flex-1">
          {/* Thông tin người nhận đặt lên trên cùng */}
          <div className="bg-slate-50 rounded-xl p-3 border-2 border-slate-300 space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-agri-700 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-700">
                <span className="font-bold text-slate-900">{order.customer.name} ({order.customer.phone})</span>
                <p className="text-slate-600 mt-0.5">{order.customer.farmAddress} ({order.customer.area})</p>
              </div>
            </div>

            {order.customer.deliveryNote && (
              <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                <Calendar className="w-4 h-4 text-agri-700 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="text-slate-500">Ghi chú: </span>
                  <span className="font-semibold text-slate-800">{order.customer.deliveryNote}</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <h4 className="font-black text-slate-900 text-[11px] uppercase tracking-wide">
                CHI TIẾT ĐƠN HÀNG:
              </h4>
              <OrderItemsTable items={order.items} compact />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full bg-agri-700 hover:bg-agri-800 text-white py-2.5 rounded-xl font-bold text-xs shadow-md"
          >
            Đóng & Tiếp tục mua hàng
          </button>
        </div>
      </div>
    </div>
  );
};
