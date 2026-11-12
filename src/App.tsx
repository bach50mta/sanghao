import React, { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Order } from './types';
import { initSupabaseSync } from './lib/initSync';
import { Header } from './components/Header';
import { ProductCard } from './components/ProductCard';
import { BottomBar } from './components/BottomBar';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderSuccessModal } from './components/OrderSuccessModal';
import { ContactModal } from './components/ContactModal';
import { AdminModal } from './components/admin/AdminModal';
import { useCartStore } from './stores/cartStore';
import { useProductStore } from './stores/productStore';
import { useOrderStore } from './stores/orderStore';

export const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [orderOldDebt, setOrderOldDebt] = useState<number>(0);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const clearCart = useCartStore((state) => state.clearCart);
  const products = useProductStore((state) => state.products);
  const addOrderToStore = useOrderStore((state) => state.addOrder);

  useEffect(() => {
    return initSupabaseSync();
  }, []);

  // Hiển thị toàn bộ danh sách sản phẩm từ productStore, chỉ lọc theo ô tìm kiếm nếu có
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.code.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const handleOrderCreated = (order: Order, oldDebt: number = 0) => {
    // 1. Tự động lưu vào sổ đơn hàng của Chủ Cửa Hàng
    addOrderToStore(order);

    // 2. Chuyển sang màn hình xác nhận đặt hàng thành công
    setCompletedOrder(order);
    setOrderOldDebt(oldDebt);
    setIsCheckoutOpen(false);
    clearCart();
    setIsSuccessOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F6F8F5] flex flex-col font-sans">
      {/* Header gọn gàng với lối vào Chủ Cửa Hàng */}
      <Header onOpenAdmin={() => setIsAdminOpen(true)} />

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-md mx-auto w-full pb-8">
        <div className="px-3 pt-3 space-y-2.5">
          {/* Ô tìm kiếm đơn giản */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="search-products-input"
              name="searchQuery"
              aria-label="Tìm kiếm cám"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên cám, mã cám (D11, D41S...)..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border-2 border-slate-400 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-agri-600 focus:border-agri-700 shadow-2xs"
            />
          </div>

          {/* Danh sách các bao cám */}
          <div className="space-y-2.5 pt-1">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </main>

      {/* Thanh Đặt Hàng / Gọi Cửa Hàng Chân Trang */}
      <BottomBar
        onOpenCheckout={() => setIsCheckoutOpen(true)}
        onOpenContact={() => setIsContactOpen(true)}
      />

      {/* Form Đặt Hàng Siêu Gọn */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderCreated={handleOrderCreated}
      />

      {/* Đặt Hàng Thành Công */}
      <OrderSuccessModal
        order={completedOrder}
        oldDebt={orderOldDebt}
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
      />

      {/* Thông tin kho cám */}
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />

      {/* Giao diện dành riêng cho Chủ Cửa Hàng Sáng Hào (Sửa giá & Sổ đơn) */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />
    </div>
  );
};

export default App;
