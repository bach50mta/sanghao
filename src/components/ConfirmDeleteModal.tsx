import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Shared confirmation dialog shown before any destructive delete action. */
export const ConfirmDeleteModal: React.FC<Props> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Xác nhận xóa',
  onCancel,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="font-black text-sm text-slate-900">{title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
          {message}
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md active:scale-95 transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

