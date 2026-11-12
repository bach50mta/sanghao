import { create } from 'zustand';

interface AreaState {
  areas: string[];
}

// 8 khu vực (phường) mới trên địa bàn thị xã Nghi Sơn cũ (theo Nghị quyết 1686/NQ-UBTVQH15)
export const FIXED_DELIVERY_AREAS = [
  'Tân Dân',
  'Ngọc Sơn',
  'Hải Lĩnh',
  'Tĩnh Gia',
  'Đào Duy Từ',
  'Hải Bình',
  'Trúc Lâm',
  'Nghi Sơn',
];

export const useAreaStore = create<AreaState>(() => ({
  areas: FIXED_DELIVERY_AREAS,
}));
