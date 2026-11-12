import React from 'react';
import { X, MapPin, Phone, Clock, Store, ShieldCheck, MessageCircle } from 'lucide-react';
import { STORE_INFO } from '../data/mockProducts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
        <div className="bg-agri-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-harvest-500" />
            <h3 className="font-bold text-sm">Thông Tin Đại lý</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3.5 text-xs text-slate-700">
          <div className="bg-slate-50 rounded-2xl p-3.5 border-2 border-slate-300 space-y-2.5">
            <div>
              <span className="text-[10px] font-bold text-agri-800 uppercase tracking-wide bg-agri-100 px-2 py-0.5 rounded">
                {STORE_INFO.businessType}
              </span>
              <h4 className="font-black text-slate-900 text-sm mt-1">{STORE_INFO.name}</h4>
              <p className="text-slate-500 text-[11px]">Chủ hộ kinh doanh: <span className="font-semibold text-slate-800">{STORE_INFO.owner}</span></p>
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
              <MapPin className="w-4 h-4 text-agri-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Địa chỉ kho hàng:</span>
                <p className="text-slate-600 mt-0.5">{STORE_INFO.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <Clock className="w-4 h-4 text-agri-700 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">Giờ phục vụ: </span>
                <span className="text-slate-600">{STORE_INFO.workingHours}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <Phone className="w-4 h-4 text-agri-700 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">Hotline / Zalo: </span>
                <span className="font-bold text-agri-800 text-sm">{STORE_INFO.phone}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-emerald-900 text-xs">Cam Kết Chất Lượng Thức Ăn Chăn Nuôi</h5>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                100% thức ăn gia súc gia cầm chính hãng từ Cargill, C.P, De Heus, Guyomarc'h có tem niêm phong và ngày sản xuất mới nhất. Đền tiền gấp đôi nếu phát hiện cám mốc, kém chất lượng.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={`https://zalo.me/${STORE_INFO.phone}`}
              target="_blank"
              rel="noreferrer"
              className="bg-[#0068FF] hover:bg-[#0055D4] text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Nhắn Tin Zalo</span>
            </a>

            <a
              href={`tel:${STORE_INFO.phone}`}
              className="bg-harvest-500 hover:bg-harvest-600 text-slate-950 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Phone className="w-4 h-4 text-slate-900" />
              <span>Gọi Điện Ngay</span>
            </a>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 py-2 rounded-xl font-bold text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

