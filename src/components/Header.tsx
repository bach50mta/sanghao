import React from 'react';
import { PhoneCall, ShieldCheck } from 'lucide-react';
import { STORE_INFO } from '../data/mockProducts';

interface Props {
  onOpenAdmin: () => void;
}

export const Header: React.FC<Props> = ({ onOpenAdmin }) => {
  return (
    <header className="bg-agri-800 text-white px-4 py-3 shadow-md sticky top-0 z-30">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-black tracking-tight leading-tight text-white">
              🌾 ĐẠI LÝ SÁNG HÀO
            </h1>
            {/* Nút bấm dành cho Chủ Đại lý */}
            <button
              onClick={onOpenAdmin}
              className="text-agri-300 hover:text-white p-1 rounded-full opacity-80 active:scale-90"
              title="Khu vực Chủ Đại lý"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-agri-100 font-medium mt-0.5">
            Chất lượng uy tín • Phục vụ tận tâm
          </p>
        </div>

        {/* Nút Gọi Gọn Cho Nông Dân */}
        <a
          href={`tel:${STORE_INFO.phone}`}
          className="bg-harvest-500 hover:bg-harvest-600 active:scale-95 text-slate-950 px-2.5 py-1.5 rounded-lg font-extrabold text-[11px] flex items-center gap-1 shadow-sm shrink-0 border border-harvest-600"
        >
          <PhoneCall className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
          <span>GỌI ĐẠI LÝ</span>
        </a>
      </div>
    </header>
  );
};
