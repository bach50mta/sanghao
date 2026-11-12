import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Lock,
  Save,
  Plus,
  Minus,
  Trash2,
  Phone,
  MessageCircle,
  Package,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Truck,
  DollarSign,
  Filter,
  FileText,
  Search,
  UserCheck,
  Check,
  ChevronDown,
  Receipt,
  Download,
  History,
  Printer,
  Pencil
} from 'lucide-react';
import { useProductStore } from '../../stores/productStore';
import { useOrderStore, OrderStatus, DeliveryStatus, PaymentStatus, ManagedOrder } from '../../stores/orderStore';
import { useAreaStore } from '../../stores/areaStore';
import { useDebtStore } from '../../stores/debtStore';
import { useDeliverySlipStore, DeliverySlipRecord } from '../../stores/deliverySlipStore';
import { formatVND, formatWeight, formatProductName } from '../../utils/format';
import { saveReceiptAsImage, saveOrderAsImage } from '../../utils/receiptImage';
import { printPaymentReceiptPdf } from '../../utils/receiptPrint';
import {
  summarizeDeliverySlipProducts,
  printDeliverySlipPdf,
} from '../../utils/deliverySlip';
import { OrderItemsTable } from '../OrderItemsTable';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';
import { CartItem, CustomerDebtSummary, DebtPayment, PaymentReceipt, Product } from '../../types';
import { STORE_INFO } from '../../data/mockProducts';

type PendingAdminDelete =
  | { kind: 'order'; id: string; label: string }
  | { kind: 'product'; id: string; label: string }
  | { kind: 'slip'; id: string; label: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface RecentOrderItem {
  orderId: string;
  createdAt: string;
  totalAmount: number;
  totalBags: number;
  isPaidDirect: boolean;
}

/** Renders the itemized post-payment order list shared by payment preview and receipt modals. */
const RecentOrdersBreakdown: React.FC<{ orders: RecentOrderItem[] }> = ({ orders }) => {
  if (orders.length === 0) {
    return (
      <span className="text-[10px] text-slate-400 italic block ml-2">
        (Không có đơn mới)
      </span>
    );
  }

  return (
    <div className="ml-2 space-y-0.5 mt-1 text-[10px]">
      {orders.map((o) => (
        <div key={o.orderId} className="flex justify-between gap-2 text-slate-700">
          <span>
            • #{o.orderId} ({new Date(o.createdAt).toLocaleDateString('vi-VN')} • {o.totalBags}b)
            {o.isPaidDirect ? ' [Đã trả ngay]' : ''}:
          </span>
          <span className={`font-bold shrink-0 ${o.isPaidDirect ? 'line-through text-slate-400' : ''}`}>
            {formatVND(o.totalAmount)}
          </span>
        </div>
      ))}
    </div>
  );
};

export const AdminModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'debt' | 'prices'>('orders');

  // Stores
  const products = useProductStore((state) => state.products);
  const updatePrice = useProductStore((state) => state.updatePrice);
  const toggleStock = useProductStore((state) => state.toggleStock);
  const addProduct = useProductStore((state) => state.addProduct);
  const deleteProduct = useProductStore((state) => state.deleteProduct);

  const orders = useOrderStore((state) => state.orders);
  const markOrdersDelivered = useOrderStore((state) => state.markOrdersDelivered);
  const markOrdersPending = useOrderStore((state) => state.markOrdersPending);
  const updateOrderItems = useOrderStore((state) => state.updateOrderItems);
  const deleteOrder = useOrderStore((state) => state.deleteOrder);
  const clearAllOrders = useOrderStore((state) => state.clearAllOrders);

  const areas = useAreaStore((state) => state.areas);

  // Debt store
  const payments = useDebtStore((state) => state.payments);
  const addPayment = useDebtStore((state) => state.addPayment);
  const deletePayment = useDebtStore((state) => state.deletePayment);
  const clearAllPayments = useDebtStore((state) => state.clearAllPayments);
  const getAllCustomerSummaries = useDebtStore((state) => state.getAllCustomerSummaries);
  const getPaymentPreview = useDebtStore((state) => state.getPaymentPreview);
  const generatePaymentReceipt = useDebtStore((state) => state.generatePaymentReceipt);
  const getCustomerDebtAt = useDebtStore((state) => state.getCustomerDebtAt);

  // Delivery slip history store
  const deliverySlips = useDeliverySlipStore((state) => state.slips);
  const addDeliverySlip = useDeliverySlipStore((state) => state.addSlip);
  const syncOrderInSlips = useDeliverySlipStore((state) => state.syncOrderInSlips);
  const deleteDeliverySlip = useDeliverySlipStore((state) => state.deleteSlip);
  const clearAllSlips = useDeliverySlipStore((state) => state.clearAllSlips);

  // State sửa giá (phải bấm "Sửa" mới mở ô nhập & Lưu)
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  // State bộ lọc đơn hàng & Cân đối xe chở nhiều khu vực
  const [orderFilter, setOrderFilter] = useState<'pending' | 'delivered'>('pending');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]); // Multi-select khu vực
  const [isAreaDropdownOpen, setIsAreaDropdownOpen] = useState(false);
  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]); // Tích chọn từng đơn giao xe
  const [orderListAsc, setOrderListAsc] = useState(false);

  useEffect(() => {
    if (!isAreaDropdownOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
        setIsAreaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isAreaDropdownOpen]);

  // State xác nhận xóa dữ liệu làm lại từ đầu & xác nhận xóa từng mục
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingAdminDelete | null>(null);

  // State tìm kiếm khách hàng trong Sổ Nợ
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // State Modal ghi nhận trả nợ
  const [payingCustomer, setPayingCustomer] = useState<CustomerDebtSummary | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<'cash' | 'transfer'>('cash');
  const [paymentNoteInput, setPaymentNoteInput] = useState<string>('');

  // State Modal Hóa đơn thanh toán vừa xuất
  const [activeReceipt, setActiveReceipt] = useState<PaymentReceipt | null>(null);
  const [savedReceiptImage, setSavedReceiptImage] = useState(false);

  // State Modal xem chi tiết đơn hàng cũ
  const [activeOrder, setActiveOrder] = useState<ManagedOrder | null>(null);
  const [savedOrderImage, setSavedOrderImage] = useState(false);

  // State Modal tạo phiếu giao cho lái xe & lịch sử phiếu giao
  const [deliverySlipOrders, setDeliverySlipOrders] = useState<ManagedOrder[] | null>(null);
  const [driverNoteInput, setDriverNoteInput] = useState('');
  const [exportedSlipPdf, setExportedSlipPdf] = useState(false);
  const [activeHistorySlipId, setActiveHistorySlipId] = useState<string | null>(null);
  const [slipHistoryMode, setSlipHistoryMode] = useState<'delivery' | 'pickup' | null>(null);
  const [slipFilterMonth, setSlipFilterMonth] = useState<string>('all');
  const [slipFilterYear, setSlipFilterYear] = useState<string>('all');
  const [slipHistoryAsc, setSlipHistoryAsc] = useState(false);

  // State sửa đơn khách đặt (số lượng từng sản phẩm -> cập nhật tiền đơn & công nợ)
  const [editingOrder, setEditingOrder] = useState<ManagedOrder | null>(null);
  const [editingOrderItems, setEditingOrderItems] = useState<CartItem[]>([]);
  const [editAddProductId, setEditAddProductId] = useState<string>('');

  // State xem chi tiết lịch sử sổ nợ của 1 khách (tách 2 tab: Đơn hàng / Phiếu thanh toán)
  const [historyCustomer, setHistoryCustomer] = useState<CustomerDebtSummary | null>(null);
  const [historyTab, setHistoryTab] = useState<'orders' | 'payments'>('orders');
  const [historyAsc, setHistoryAsc] = useState(true);

  // State thêm sản phẩm mới
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProd, setNewProd] = useState({
    name: '',
    code: '',
    brand: '',
    stage: 'Tập ăn / Vỗ béo',
    weightPerBag: 25,
    price: 350000,
    tonPrice: 0,
    crudeProtein: '18% Đạm',
    description: '',
    usageGuide: '',
    inStock: true
  });

  if (!isOpen) return null;

  // Xác thực mã PIN chủ Đại lý (Mặc định 0678)
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '0678' || pinInput === '6789' || pinInput === STORE_INFO.phone || pinInput === '0869260678') {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleStartEditPrice = (id: string, currentPrice: number) => {
    setEditingPrices((prev) => ({ ...prev, [id]: currentPrice }));
    setEditingProductId(id);
  };

  const handleCancelEditPrice = (id: string) => {
    setEditingPrices((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditingProductId((prev) => (prev === id ? null : prev));
  };

  const handlePriceChange = (id: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
    setEditingPrices((prev) => ({ ...prev, [id]: num }));
  };

  const handleSavePrice = (id: string, currentPrice: number) => {
    const newPrice = editingPrices[id] !== undefined ? editingPrices[id] : currentPrice;
    if (newPrice > 0) {
      updatePrice(id, newPrice);
      setEditingProductId(null);
      setSavedSuccessId(id);
      setTimeout(() => setSavedSuccessId(null), 1500);
    }
  };

  const handleAddNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name.trim() || newProd.price <= 0) return;
    addProduct(newProd);
    setShowAddForm(false);
    setNewProd({
      name: '',
      code: '',
      brand: '',
      stage: 'Tập ăn / Vỗ béo',
      weightPerBag: 25,
      price: 350000,
      tonPrice: 0,
      crudeProtein: '18% Đạm',
      description: '',
      usageGuide: '',
      inStock: true
    });
  };

  // Toggle chọn 1 hoặc nhiều khu vực để tính xe chở
  const handleToggleArea = (area: string) => {
    if (area === 'all') {
      setSelectedAreas([]);
      return;
    }
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  // TÍNH TOÁN CÂN ĐỐI XE CHỞ (ƯU TIÊN CÁC ĐƠN ĐÃ TÍCH CHỌN, NẾU CHƯA CHỌN TÍNH ĐƠN CHƯA GIAO THEO KHU VỰC)
  const pendingOrdersInSelection = orders.filter((o) => {
    const isUndelivered = o.deliveryStatus !== 'delivered';
    const matchArea = selectedAreas.length === 0 || selectedAreas.includes(o.customer.area);
    return isUndelivered && matchArea;
  });

  // Lọc và sắp xếp danh sách đơn hàng
  const filteredOrders = orders
    .filter((ord) => {
      // 1. Lọc theo nhiều khu vực được chọn
      if (selectedAreas.length > 0) {
        if (!selectedAreas.includes(ord.customer.area)) return false;
      }

      // 2. Lọc theo trạng thái giao hàng
      if (orderFilter === 'pending') {
        return ord.deliveryStatus !== 'delivered';
      }
      return ord.deliveryStatus === 'delivered';
    })
    .slice()
    .sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      const cmp = diff !== 0 ? diff : a.orderId.localeCompare(b.orderId, undefined, { numeric: true });
      return orderListAsc ? cmp : -cmp;
    });

  const selectedOrdersList = orders.filter((o) => selectedOrderIds.includes(o.orderId));
  const loadTargetOrders =
    selectedOrdersList.length > 0 ? selectedOrdersList : pendingOrdersInSelection;

  const totalPendingBags = loadTargetOrders.reduce((s, o) => s + o.totalBags, 0);
  const totalPendingKg = loadTargetOrders.reduce((s, o) => s + o.totalWeightKg, 0);

  // Thống kê giao hàng
  const pendingOrdersCount = orders.filter((o) => o.deliveryStatus !== 'delivered').length;
  const deliveredOrdersCount = orders.filter((o) => o.deliveryStatus === 'delivered').length;

  const visibleUndeliveredIds = filteredOrders
    .filter((o) => o.deliveryStatus !== 'delivered')
    .map((o) => o.orderId);
  const isAllVisibleSelected =
    visibleUndeliveredIds.length > 0 &&
    visibleUndeliveredIds.every((id) => selectedOrderIds.includes(id));

  const handleToggleSelectOrder = (orderId: string) => {
    const target = orders.find((o) => o.orderId === orderId);
    if (!target || target.deliveryStatus === 'delivered') return;
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleToggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !visibleUndeliveredIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...visibleUndeliveredIds])));
    }
  };

  const handleOpenDeliverySlip = () => {
    if (selectedOrdersList.length === 0) return;
    setExportedSlipPdf(false);
    setDriverNoteInput('');
    setActiveHistorySlipId(null);
    setDeliverySlipOrders(selectedOrdersList);
  };

  const truckDeliverySlips = deliverySlips.filter((s) => s.slipType !== 'pickup');
  const pickupSlips = deliverySlips.filter((s) => s.slipType === 'pickup');

  const handleOpenHistorySlip = (slip: DeliverySlipRecord) => {
    setExportedSlipPdf(false);
    setDriverNoteInput(slip.driverNote);
    setActiveHistorySlipId(slip.slipId);
    setDeliverySlipOrders(slip.orders);
  };

  const commitCurrentDeliverySlip = (): string | undefined => {
    if (!deliverySlipOrders || deliverySlipOrders.length === 0) return undefined;
    let resolvedSlipId = activeHistorySlipId || undefined;
    if (!resolvedSlipId) {
      const savedSlip = addDeliverySlip(deliverySlipOrders, driverNoteInput);
      resolvedSlipId = savedSlip.slipId;
      setActiveHistorySlipId(savedSlip.slipId);
    }
    const orderIds = deliverySlipOrders.map((o) => o.orderId);
    markOrdersDelivered(orderIds);
    setSelectedOrderIds((prev) => prev.filter((id) => !orderIds.includes(id)));
    return resolvedSlipId;
  };

  const handleSaveDeliverySlip = () => {
    commitCurrentDeliverySlip();
    setDeliverySlipOrders(null);
  };

  const handlePrintDeliverySlipPdf = () => {
    if (!deliverySlipOrders || deliverySlipOrders.length === 0) return;
    const slipId = commitCurrentDeliverySlip();
    printDeliverySlipPdf(deliverySlipOrders, driverNoteInput, slipId);
    setExportedSlipPdf(true);
    setTimeout(() => setExportedSlipPdf(false), 2500);
  };

  const handleCustomerSelfPickup = () => {
    if (selectedOrdersList.length === 0) return;
    addDeliverySlip(selectedOrdersList, '', 'pickup');
    const orderIds = selectedOrdersList.map((o) => o.orderId);
    markOrdersDelivered(orderIds);
    setSelectedOrderIds((prev) => prev.filter((id) => !orderIds.includes(id)));
  };

  // TỔNG HỢP CÔNG NỢ KHÁCH HÀNG
  const allCustomerSummaries = getAllCustomerSummaries(orders);
  const filteredCustomerSummaries = allCustomerSummaries.filter((cust) => {
    const q = customerSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      cust.name.toLowerCase().includes(q) ||
      cust.phone.includes(q) ||
      cust.area.toLowerCase().includes(q) ||
      cust.farmAddress.toLowerCase().includes(q)
    );
  });

  const totalStoreDebt = allCustomerSummaries.reduce((sum, c) => sum + c.currentDebt, 0);
  const indebtedCustomerCount = allCustomerSummaries.filter((c) => c.currentDebt > 0).length;

  // Xử lý mở modal thanh toán nợ cho khách
  const handleOpenPayModal = (customer: CustomerDebtSummary) => {
    setPayingCustomer(customer);
    setPaymentAmountInput(customer.currentDebt > 0 ? customer.currentDebt.toString() : '');
    setPaymentMethodInput('cash');
    setPaymentNoteInput('');
  };

  // Xác nhận lưu phiếu thu nợ
  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;

    const amount = parseInt(paymentAmountInput.replace(/\D/g, ''), 10) || 0;
    if (amount <= 0) return;

    const payment = addPayment({
      customerPhone: payingCustomer.phone,
      customerName: payingCustomer.name,
      amount,
      paymentMethod: paymentMethodInput,
      note: paymentNoteInput.trim() || undefined
    });

    // Tạo hóa đơn phiếu thu nợ
    const receipt = generatePaymentReceipt(payment.paymentId, orders);
    setPayingCustomer(null);
    if (receipt) {
      setActiveReceipt(receipt);
    }
  };

  const handleSaveReceiptImage = async (receipt: PaymentReceipt) => {
    try {
      await saveReceiptAsImage(receipt);
      setSavedReceiptImage(true);
      setTimeout(() => setSavedReceiptImage(false), 2200);
    } catch {
      // Fallback failure is non-blocking
    }
  };

  const handleSaveOrderImage = async (order: ManagedOrder, oldDebt: number) => {
    try {
      await saveOrderAsImage(order, oldDebt);
      setSavedOrderImage(true);
      setTimeout(() => setSavedOrderImage(false), 2200);
    } catch {
      // Fallback failure is non-blocking
    }
  };

  const handleOpenEditOrder = (order: ManagedOrder) => {
    if (order.deliveryStatus === 'delivered') return;
    setEditingOrder(order);
    setEditingOrderItems(order.items.map((it) => ({ ...it })));
    setEditAddProductId('');
  };

  const handleChangeEditOrderQty = (productId: string, nextQty: number) => {
    const cleanQty = Math.max(0, nextQty);
    setEditingOrderItems((prev) =>
      prev.map((it) => (it.product.id === productId ? { ...it, quantity: cleanQty } : it))
    );
  };

  const handleAddProductToEditOrder = (productId: string) => {
    if (!productId) return;
    const prod = products.find((p: Product) => p.id === productId);
    if (!prod) return;
    setEditingOrderItems((prev) => {
      const existing = prev.find((it) => it.product.id === productId);
      if (existing) {
        return prev.map((it) =>
          it.product.id === productId ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [...prev, { product: prod, quantity: 1 }];
    });
    setEditAddProductId('');
  };

  const handleSaveEditedOrder = () => {
    if (!editingOrder || editingOrder.deliveryStatus === 'delivered') return;
    const updatedOrder = updateOrderItems(editingOrder.orderId, editingOrderItems);
    if (!updatedOrder) return;
    syncOrderInSlips(updatedOrder);
    if (activeOrder?.orderId === updatedOrder.orderId) {
      setActiveOrder(updatedOrder);
    }
    setEditingOrder(null);
    setEditingOrderItems([]);
  };

  const handleConfirmAdminDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'order') {
      setSelectedOrderIds((prev) => prev.filter((id) => id !== pendingDelete.id));
      deleteOrder(pendingDelete.id);
    } else if (pendingDelete.kind === 'product') {
      deleteProduct(pendingDelete.id);
    } else if (pendingDelete.kind === 'slip') {
      const deletedSlip = deliverySlips.find((s) => s.slipId === pendingDelete.id);
      const remainingOrderIds = new Set(
        deliverySlips
          .filter((s) => s.slipId !== pendingDelete.id)
          .flatMap((s) => s.orders.map((o) => o.orderId))
      );
      const revertOrderIds = (deletedSlip?.orders ?? [])
        .map((o) => o.orderId)
        .filter((id) => !remainingOrderIds.has(id));

      deleteDeliverySlip(pendingDelete.id);
      if (revertOrderIds.length > 0) {
        markOrdersPending(revertOrderIds);
      }
      if (activeHistorySlipId === pendingDelete.id) {
        setDeliverySlipOrders(null);
        setActiveHistorySlipId(null);
      }
    }
    setPendingDelete(null);
  };

  const handleConfirmResetData = () => {
    clearAllOrders();
    clearAllPayments();
    clearAllSlips();
    try {
      localStorage.removeItem('sanghao_auto_notifications_v1');
    } catch {
      // Ignore
    }
    setPayingCustomer(null);
    setActiveReceipt(null);
    setActiveOrder(null);
    setEditingOrder(null);
    setEditingOrderItems([]);
    setPendingDelete(null);
    setDeliverySlipOrders(null);
    setActiveHistorySlipId(null);
    setSlipHistoryMode(null);
    setHistoryCustomer(null);
    setSelectedOrderIds([]);
    setShowResetConfirm(false);
  };

  // Màn hình nhập mã PIN nếu chưa đăng nhập
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border-2 border-agri-200 animate-in zoom-in-95 text-center">
          <div className="w-14 h-14 bg-agri-100 text-agri-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="font-black text-lg text-slate-900">ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO</h3>
          <p className="text-xs text-slate-500 mt-1">
            Nhập mã PIN để quản lý đơn hàng, sổ nợ và giá cám
          </p>

          <form onSubmit={handleVerifyPin} className="mt-4 space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={10}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError(false);
              }}
              placeholder="Nhập mã PIN"
              className="w-full text-center text-lg tracking-widest font-black py-3 px-4 rounded-xl border-2 border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-agri-700 bg-slate-50"
              autoFocus
            />

            {pinError && (
              <p className="text-xs text-rose-600 font-bold">Mã PIN không đúng. Vui lòng nhập lại!</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-slate-300 font-bold text-xs text-slate-700"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-agri-700 hover:bg-agri-800 text-white font-black text-xs shadow-md"
              >
                Mở Khóa
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Giao diện chính của Chủ Đại lý (nền #F6F8F5 & header agri-800 đồng bộ giao diện khách)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75">
      <div className="w-full max-w-md bg-[#F6F8F5] rounded-3xl shadow-2xl border-2 border-agri-200 overflow-hidden flex flex-col h-[94vh]">
        {/* Header Admin đồng bộ giao diện khách */}
        <div className="bg-agri-800 text-white p-3.5 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-harvest-500 text-slate-950">
              Quản Trị Viên
            </span>
            <h3 className="font-black text-base text-white mt-1">Chủ Đại lý: {STORE_INFO.owner}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Tab chức năng: Mặc định là Đơn Hàng -> Sổ Nợ Khách -> Sửa Giá */}
        <div className="grid grid-cols-3 border-b border-agri-200 bg-agri-50 text-[11px] font-black text-center shrink-0">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-2.5 border-b-2 transition-all relative ${activeTab === 'orders'
              ? 'border-agri-700 bg-white text-agri-800'
              : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
          >
            📦 Đơn Hàng ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('debt')}
            className={`py-2.5 border-b-2 transition-all relative ${activeTab === 'debt'
              ? 'border-agri-700 bg-white text-agri-800'
              : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
          >
            📒 Sổ Nợ ({indebtedCustomerCount})
            {indebtedCustomerCount > 0 && (
              <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('prices')}
            className={`py-2.5 border-b-2 transition-all ${activeTab === 'prices'
              ? 'border-agri-700 bg-white text-agri-800'
              : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
          >
            💰 Sửa Giá ({products.length})
          </button>
        </div>

        {/* TAB 1: SỔ ĐƠN HÀNG & CÂN ĐỐI XE CHỞ THEO 1 HOẶC NHIỀU KHU VỰC */}
        {activeTab === 'orders' && (
          <div className="p-3 overflow-y-auto flex-1 space-y-3">
            {/* BẢNG THỐNG KÊ CHUNG & LẬP PHIẾU GIAO */}
            <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-xs text-emerald-950 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    {selectedOrdersList.length > 0
                      ? `Đang chọn ${selectedOrdersList.length} đơn giao xe`
                      : selectedAreas.length > 0
                        ? `Thống kê chung (${selectedAreas.join(' + ')})`
                        : 'Thống kê chung'}
                  </span>
                </span>
                {selectedOrdersList.length > 0 ? (
                  <button
                    onClick={() => setSelectedOrderIds([])}
                    className="text-[10px] bg-white text-slate-700 border border-slate-300 font-bold px-2 py-0.5 rounded-full shrink-0"
                  >
                    Bỏ chọn
                  </button>
                ) : (
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full shrink-0">
                    {pendingOrdersInSelection.length} đơn chưa giao
                  </span>
                )}
              </div>

              {/* Thông số tổng bao và tải trọng */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded-xl border-2 border-emerald-300 text-center">
                  <span className="text-[10px] text-slate-500 font-bold block">
                    {selectedOrdersList.length > 0 ? 'Tổng Bao Đã Chọn' : 'Tổng Bao Chưa Giao'}
                  </span>
                  <span className="text-base font-black text-emerald-900">{totalPendingBags} bao</span>
                </div>
                <div className="bg-white p-2 rounded-xl border-2 border-emerald-300 text-center">
                  <span className="text-[10px] text-slate-500 font-bold block">Tổng Tải Trọng</span>
                  <span className="text-base font-black text-emerald-900">
                    {formatWeight(totalPendingKg)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleOpenDeliverySlip}
                    disabled={selectedOrdersList.length === 0}
                    className={`w-full py-2.5 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${selectedOrdersList.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm active:scale-95'
                      }`}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>
                      {selectedOrdersList.length > 0
                        ? `Tạo Phiếu Giao (${selectedOrdersList.length})`
                        : 'Tạo Phiếu Giao'}
                    </span>
                  </button>
                  <button
                    onClick={handleCustomerSelfPickup}
                    disabled={selectedOrdersList.length === 0}
                    className={`w-full py-2.5 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${selectedOrdersList.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm active:scale-95'
                      }`}
                  >
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span>
                      {selectedOrdersList.length > 0
                        ? `Khách đến lấy (${selectedOrdersList.length})`
                        : 'Khách đến lấy'}
                    </span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSlipHistoryMode('delivery')}
                    className="w-full py-1.5 px-2 bg-white hover:bg-emerald-50 text-slate-700 border-2 border-emerald-300 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
                  >
                    <History className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Lịch sử phiếu giao ({truckDeliverySlips.length})</span>
                  </button>
                  <button
                    onClick={() => setSlipHistoryMode('pickup')}
                    className="w-full py-1.5 px-2 bg-white hover:bg-amber-50 text-slate-700 border-2 border-amber-300 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Lịch sử khách đến lấy ({pickupSlips.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BỘ LỌC 1: TRẠNG THÁI GIAO HÀNG (Chưa giao / Đã giao) */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 border-2 border-slate-300 rounded-xl text-[11px] font-bold text-slate-700">
              <button
                onClick={() => setOrderFilter('pending')}
                className={`py-1.5 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${orderFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs font-black'
                  : 'text-amber-800 hover:text-amber-950'
                  }`}
              >
                🚚 Chưa Giao ({pendingOrdersCount})
              </button>
              <button
                onClick={() => setOrderFilter('delivered')}
                className={`py-1.5 px-1 rounded-lg transition-all flex items-center justify-center gap-1 ${orderFilter === 'delivered'
                  ? 'bg-emerald-700 text-white shadow-xs font-black'
                  : 'text-emerald-800 hover:text-emerald-950'
                  }`}
              >
                ✅ Đã Giao ({deliveredOrdersCount})
              </button>
            </div>

            {/* BỘ LỌC 2: Ô CHỌN KHU VỰC XỔ XUỐNG */}
            <div ref={areaDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setIsAreaDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white hover:bg-slate-50 border-2 border-slate-400 rounded-2xl text-xs font-bold text-slate-900 shadow-2xs transition-colors"
              >
                <span className="truncate text-left">
                  {selectedAreas.length === 0
                    ? '📍 Tất cả khu vực'
                    : selectedAreas.length === 1
                      ? `📍 ${selectedAreas[0]}`
                      : `📍 Đã chọn ${selectedAreas.length} khu vực: ${selectedAreas.join(', ')}`}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isAreaDropdownOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {isAreaDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border-2 border-slate-400 rounded-2xl shadow-xl overflow-hidden">
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleArea('all');
                        setIsAreaDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-bold transition-colors ${selectedAreas.length === 0
                        ? 'bg-emerald-50 text-agri-900'
                        : 'text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedAreas.length === 0
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-300'
                            }`}
                        >
                          {selectedAreas.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span>Tất cả khu vực</span>
                      </span>
                    </button>

                    {areas.map((ar) => {
                      const isSelected = selectedAreas.includes(ar);
                      const countPending = orders.filter(
                        (o) => o.customer.area === ar && o.deliveryStatus !== 'delivered'
                      ).length;

                      return (
                        <button
                          key={ar}
                          type="button"
                          onClick={() => handleToggleArea(ar)}
                          className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-bold transition-colors ${isSelected
                            ? 'bg-emerald-50/70 text-agri-900'
                            : 'text-slate-800 hover:bg-slate-50'
                            }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected
                                ? 'bg-agri-700 border-agri-700 text-white'
                                : 'bg-white border-slate-300'
                                }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <span className="truncate">📍 {ar}</span>
                          </span>

                          {countPending > 0 && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-black shrink-0 ${isSelected ? 'bg-agri-700 text-white' : 'bg-amber-100 text-amber-900'
                                }`}
                            >
                              {countPending} đơn
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {selectedAreas.length === 0
                        ? 'Đang lọc tất cả'
                        : `Đã chọn ${selectedAreas.length} khu vực`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAreaDropdownOpen(false)}
                      className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* DANH SÁCH ĐƠN HÀNG: CHỌN TẤT CẢ (CHỈ ĐƠN CHƯA GIAO) & SẮP XẾP */}
            <div className="flex items-center justify-between gap-2 text-[11px] px-1">
              <label
                className={`inline-flex items-center gap-1.5 font-bold select-none ${visibleUndeliveredIds.length === 0
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-slate-700 cursor-pointer'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={isAllVisibleSelected}
                  onChange={handleToggleSelectAllVisible}
                  disabled={visibleUndeliveredIds.length === 0}
                  className="w-4 h-4 rounded border-slate-300 text-agri-700 accent-emerald-700 disabled:opacity-40"
                />
                <span>Chọn tất cả chưa giao ({visibleUndeliveredIds.length})</span>
              </label>

              <button
                onClick={() => setOrderListAsc((prev) => !prev)}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200"
              >
                {orderListAsc ? '↑ Thứ tự cũ → mới' : '↓ Mới nhất trước'}
              </button>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-xs">Không có đơn hàng nào phù hợp bộ lọc</p>
                <button
                  onClick={() => {
                    setOrderFilter('pending');
                    setSelectedAreas([]);
                  }}
                  className="mt-2 text-xs text-agri-700 font-bold underline"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            ) : (
              filteredOrders.map((ord) => {
                const isDelivered = ord.deliveryStatus === 'delivered';
                const isChecked = !isDelivered && selectedOrderIds.includes(ord.orderId);

                return (
                  <div
                    key={ord.orderId}
                    className={`p-3.5 rounded-2xl border-2 transition-all space-y-2 ${isChecked
                      ? 'border-emerald-600 ring-2 ring-emerald-500/30 bg-emerald-50/40'
                      : isDelivered
                        ? 'border-emerald-400 bg-emerald-50/30'
                        : 'border-orange-400 bg-white shadow-2xs'
                      }`}
                  >
                    {/* Header đơn: Ô tích chọn giao xe (khóa nếu đã giao), Mã đơn, Thời gian & Trạng thái */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <label
                        className={`flex items-start gap-2 select-none ${isDelivered ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDelivered}
                          onChange={() => handleToggleSelectOrder(ord.orderId)}
                          className={`w-4 h-4 mt-0.5 rounded border-slate-300 shrink-0 ${isDelivered
                            ? 'accent-slate-400 opacity-35 cursor-not-allowed'
                            : 'accent-emerald-700 cursor-pointer'
                            }`}
                        />
                        <div>
                          <span className="font-black text-xs text-slate-900 block">#{ord.orderId}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(ord.createdAt).toLocaleTimeString('vi-VN')} •{' '}
                            {new Date(ord.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </label>

                      {/* Huy hiệu giao hàng */}
                      <div className="shrink-0">
                        {isDelivered ? (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            <span>ĐÃ GIAO</span>
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            🚚 Chưa giao
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thông tin Khách & Hẹn giờ giao */}
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="font-black text-slate-900 text-sm block truncate">
                          {ord.customer.name}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 leading-tight">
                          <span>{ord.customer.farmAddress}</span>
                          {ord.customer.area && (
                            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0">
                              📍 {ord.customer.area}
                            </span>
                          )}
                        </div>
                        {ord.customer.deliveryNote && (
                          <p className="text-amber-900 text-[11px] font-bold bg-amber-100/80 px-2 py-0.5 rounded-md inline-block mt-0.5">
                            🕒 Hẹn giao: {ord.customer.deliveryNote}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        <a
                          href={`tel:${ord.customer.phone}`}
                          className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold"
                          title="Gọi điện cho khách"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        <a
                          href={`https://zalo.me/${ord.customer.phone}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold"
                          title="Nhắn Zalo cho khách"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        {!isDelivered && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditOrder(ord)}
                            className="w-8 h-8 rounded-xl bg-agri-100 hover:bg-agri-200 text-agri-800 flex items-center justify-center font-bold"
                            title="Sửa đơn"
                            aria-label="Sửa đơn"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'order',
                              id: ord.orderId,
                              label: `Đơn #${ord.orderId} (${ord.customer.name} - ${ord.totalBags} bao)`,
                            })
                          }
                          className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center font-bold"
                          title="Xóa đơn"
                          aria-label="Xóa đơn"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Thông tin chung đơn hàng: chỉ hiện mã SP & số lượng (bấm Xem hóa đơn để xem đầy đủ & tiền) */}
                    <div className="bg-slate-50 px-2.5 py-2 rounded-xl border-2 border-slate-200 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {ord.items.map((item) => (
                          <span
                            key={item.product.id}
                            className="inline-flex items-center gap-1 bg-white border-2 border-slate-300 px-2 py-0.5 rounded-lg text-[11px] font-bold text-slate-800"
                          >
                            <span className="text-agri-800 font-black">{item.product.code}</span>
                            <span className="text-slate-400">×</span>
                            <span>{item.quantity}</span>
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600">
                        Tổng: <strong className="text-slate-900">{ord.totalBags} bao</strong> ({formatWeight(ord.totalWeightKg)})
                      </div>
                    </div>

                    {/* XEM HÓA ĐƠN CHI TIẾT (CHỈ HIỆN Ở ĐƠN ĐÃ GIAO) */}
                    {isDelivered && (
                      <div className="pt-0.5">
                        <button
                          onClick={() => setActiveOrder(ord)}
                          className="w-full py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-300"
                        >
                          <FileText className="w-3.5 h-3.5 text-agri-700" />
                          <span>Xem hóa đơn</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: SỔ NỢ CÔNG NỢ TỪNG KHÁCH HÀNG & GHI CHÉP THANH TOÁN */}
        {activeTab === 'debt' && (
          <div className="p-3 overflow-y-auto flex-1 space-y-3">
            {/* Thống kê dư nợ toàn Đại lý */}
            <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between text-xs shadow-2xs">
              <div>
                <span className="font-black text-rose-950 block text-xs">
                  Tổng Nợ Cám Cần Thu:
                </span>
                <span className="text-[11px] text-rose-800 font-semibold">
                  {indebtedCustomerCount} hộ chăn nuôi đang có dư nợ
                </span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-rose-700 block">
                  {formatVND(totalStoreDebt)}
                </span>
              </div>
            </div>

            {/* Ô tìm kiếm khách hàng */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Tìm tên khách hoặc số điện thoại..."
                className="w-full pl-9 pr-3 py-2 bg-white border-2 border-slate-400 rounded-xl text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-agri-600 focus:border-agri-700"
              />
            </div>

            {/* Danh sách từng khách hàng và số nợ */}
            {filteredCustomerSummaries.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-xs">
                <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Chưa có dữ liệu khách hàng</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Khi khách đặt đơn, thông tin và công nợ sẽ tự động tổng hợp vào đây!
                </p>
              </div>
            ) : (
              filteredCustomerSummaries.map((cust) => {
                const hasDebt = cust.currentDebt > 0;

                return (
                  <div
                    key={cust.phone}
                    className={`p-3.5 rounded-2xl border-2 transition-all space-y-2.5 ${hasDebt
                      ? 'border-rose-400 bg-rose-50/30 shadow-2xs'
                      : 'border-slate-300 bg-white'
                      }`}
                  >
                    {/* Thông tin Khách */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-sm text-slate-900">{cust.name}</span>
                          {cust.area && (
                            <span className="bg-emerald-100 text-emerald-900 text-[10px] font-extrabold px-1.5 py-0.2 rounded">
                              📍 {cust.area}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{cust.phone}</p>
                        <p className="text-[11px] text-slate-500">{cust.farmAddress}</p>
                      </div>

                      {/* Trạng thái Nợ */}
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-500 block">Nợ hiện tại:</span>
                        <span
                          className={`text-sm font-black ${hasDebt ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                        >
                          {hasDebt ? formatVND(cust.currentDebt) : 'Hết nợ (0đ)'}
                        </span>
                      </div>
                    </div>

                    {/* Thống kê mua hàng */}
                    <div className="flex justify-between items-center text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-xl">
                      <span>Tổng mua: {cust.totalOrdersCount} đơn ({formatVND(cust.totalPurchased)})</span>
                      <span>Đã trả: {formatVND(cust.totalPaid)}</span>
                    </div>

                    {/* NÚT THAO TÁC: GHI TRẢ NỢ & XUẤT HÓA ĐƠN */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => handleOpenPayModal(cust)}
                        className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-black py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1 shadow-xs active:scale-95"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Ghi Nhận Trả Nợ</span>
                      </button>

                      <button
                        onClick={() => {
                          setHistoryTab('orders');
                          setHistoryCustomer(cust);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-2.5 rounded-xl text-xs flex items-center justify-center gap-1 border-2 border-slate-300"
                        title="Xem lịch sử sổ nợ"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Lịch Sử</span>
                      </button>

                      <a
                        href={`tel:${cust.phone}`}
                        className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0"
                        title="Gọi cho khách"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                      <a
                        href={`https://zalo.me/${cust.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shrink-0"
                        title="Nhắn Zalo cho khách"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 3: SỬA GIÁ CÁM HÀNG NGÀY */}
        {activeTab === 'prices' && (
          <div className="p-3.5 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-agri-700 hover:bg-agri-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm sản phẩm</span>
              </button>
            </div>

            {/* Form Thêm Loại Cám Mới */}
            {showAddForm && (
              <form onSubmit={handleAddNewProduct} className="p-3 rounded-2xl bg-emerald-50 border-2 border-emerald-400 space-y-2 text-xs">
                <h4 className="font-black text-emerald-950">Thêm Bao Cám Mới Vào Đại lý:</h4>
                <input
                  type="text"
                  placeholder="Tên cám (Ví dụ: Cám Heo Đậm Đặc Cargill...)"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="w-full p-2 bg-white rounded-lg border-2 border-slate-300"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Mã cám (VD: D41S)"
                    value={newProd.code}
                    onChange={(e) => setNewProd({ ...newProd, code: e.target.value })}
                    className="p-2 bg-white rounded-lg border-2 border-slate-300"
                  />
                  <input
                    type="number"
                    placeholder="Quy cách kg/bao (25 hoặc 40)"
                    value={newProd.weightPerBag}
                    onChange={(e) => setNewProd({ ...newProd, weightPerBag: parseInt(e.target.value, 10) || 25 })}
                    className="p-2 bg-white rounded-lg border-2 border-slate-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={1000}
                    placeholder="Giá bán 1 bao (VND)"
                    value={newProd.price}
                    onChange={(e) => setNewProd({ ...newProd, price: parseInt(e.target.value, 10) || 0 })}
                    className="flex-1 p-2 bg-white rounded-lg border-2 border-slate-300 font-bold text-agri-800"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-agri-700 text-white font-black px-4 py-2 rounded-lg"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            )}

            {/* Danh Sách Cám & Ô Đổi Giá */}
            <div className="space-y-2">
              {products.map((prod) => {
                const isEditing = editingProductId === prod.id;
                const currentPriceVal = editingPrices[prod.id] !== undefined ? editingPrices[prod.id] : prod.price;
                const isSaved = savedSuccessId === prod.id;

                return (
                  <div
                    key={prod.id}
                    className={`p-3 rounded-2xl border-2 transition-all ${prod.inStock ? 'bg-white border-slate-300 shadow-2xs' : 'bg-slate-100 border-slate-300 opacity-60'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="truncate">
                        <span className="font-black text-slate-900 text-xs">{formatProductName(prod)}</span>
                        <span className="text-[11px] text-slate-500 ml-1">({prod.weightPerBag}kg)</span>
                      </div>

                      <button
                        onClick={() => toggleStock(prod.id)}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${prod.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                      >
                        {prod.inStock ? 'Còn Hàng' : 'Hết Cám'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {isEditing ? (
                        <>
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              autoFocus
                              value={currentPriceVal.toLocaleString('vi-VN')}
                              onChange={(e) => handlePriceChange(prod.id, e.target.value)}
                              className="w-full py-1.5 px-3 bg-white border-2 border-agri-600 rounded-xl font-black text-sm text-agri-900 focus:outline-none"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                              đ/bao
                            </span>
                          </div>

                          <button
                            onClick={() => handleSavePrice(prod.id, prod.price)}
                            className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 bg-agri-700 hover:bg-agri-800 text-white active:scale-95 transition-all"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Lưu</span>
                          </button>

                          <button
                            onClick={() => handleCancelEditPrice(prod.id)}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                            title="Hủy sửa giá"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 py-1.5 px-3 bg-slate-50 border-2 border-slate-300 rounded-xl flex items-center justify-between">
                            <span className="font-black text-sm text-agri-900">
                              {prod.price.toLocaleString('vi-VN')}
                            </span>
                            <span className="text-xs font-bold text-slate-400">đ/bao</span>
                          </div>

                          {isSaved ? (
                            <span className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 bg-emerald-600 text-white">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Đã Lưu!</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStartEditPrice(prod.id, prod.price)}
                              className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shrink-0 bg-agri-100 hover:bg-agri-200 text-agri-900 border-2 border-agri-300 active:scale-95 transition-all"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Sửa</span>
                            </button>
                          )}

                          <button
                            onClick={() =>
                              setPendingDelete({
                                kind: 'product',
                                id: prod.id,
                                label: prod.name,
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                            title="Xóa loại cám này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chân Trang Admin */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="py-3 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 shrink-0"
            title="Xóa dữ liệu đơn hàng & sổ nợ để làm lại từ đầu"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa Data</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl font-black text-xs shadow-md"
          >
            Đóng Quản Trị & Về Đại lý
          </button>
        </div>
      </div>

      {/* MODAL 1: GHI NHẬN THANH TOÁN TRẢ NỢ */}
      {payingCustomer && (() => {
        const preview = getPaymentPreview(payingCustomer.phone, orders);
        const parsedPayAmount = parseInt(paymentAmountInput.replace(/\D/g, ''), 10) || 0;
        const estimatedRemaining = Math.max(0, preview.debtBeforePayment - parsedPayAmount);
        const todayDateLabel = new Date().toLocaleDateString('vi-VN');
        const lastPaymentLabel = preview.lastPaymentDate
          ? ` tính đến ngày ${new Date(preview.lastPaymentDate).toLocaleDateString('vi-VN')}`
          : '';

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 text-xs space-y-3 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-700" />
                  <span>Hóa đơn thanh toán ngày {todayDateLabel}</span>
                </h3>
                <button
                  onClick={() => setPayingCustomer(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Thông tin & Bảng kê nợ trước khi trả */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  <span>{payingCustomer.name}</span>
                  <span className="text-slate-500 font-semibold">{payingCustomer.phone}</span>
                </div>

                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>1. Nợ cũ{lastPaymentLabel}:</span>
                  <span className="font-bold text-slate-900 shrink-0 ml-1">
                    {formatVND(preview.oldDebtFromLastPayment)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-600">
                  <div className="flex justify-between font-semibold">
                    <span>2. Đơn mới ({preview.recentOrders.length} đơn):</span>
                    <span className="font-bold text-slate-900 shrink-0 ml-1">
                      {formatVND(preview.recentOrdersTotal)}
                    </span>
                  </div>
                  <RecentOrdersBreakdown orders={preview.recentOrders} />
                </div>

                <div className="flex justify-between text-rose-700 font-black pt-1 border-t border-slate-200">
                  <span>3. Tổng nợ:</span>
                  <span className="text-sm">{formatVND(preview.debtBeforePayment)}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmPayment} className="space-y-3">
                <div>
                  <label className="block text-slate-800 font-black mb-1">
                    4. Số tiền trả nợ (VND):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        paymentAmountInput
                          ? parseInt(paymentAmountInput.replace(/\D/g, ''), 10).toLocaleString('vi-VN')
                          : ''
                      }
                      onChange={(e) => setPaymentAmountInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Nhập số tiền trả..."
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-sm text-emerald-900 focus:bg-white"
                      required
                    />
                    {preview.debtBeforePayment > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmountInput(preview.debtBeforePayment.toString())}
                        className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-black px-2.5 py-2.5 rounded-xl text-[10px] shrink-0"
                      >
                        Trả Hết
                      </button>
                    )}
                  </div>
                  <div className="flex justify-between text-[11px] mt-1.5 px-1 font-bold">
                    <span className="text-slate-500">5. Nợ còn lại ngày {todayDateLabel}:</span>
                    <span className={estimatedRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      {formatVND(estimatedRemaining)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">Hình thức thanh toán:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethodInput('cash')}
                      className={`py-2 px-3 rounded-xl border font-bold text-xs ${paymentMethodInput === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black'
                        : 'border-slate-200 bg-white text-slate-700'
                        }`}
                    >
                      💵 Tiền mặt
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethodInput('transfer')}
                      className={`py-2 px-3 rounded-xl border font-bold text-xs ${paymentMethodInput === 'transfer'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black'
                        : 'border-slate-200 bg-white text-slate-700'
                        }`}
                    >
                      📱 Chuyển khoản
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-800 font-bold mb-1">Ghi chú (nếu có):</label>
                  <input
                    type="text"
                    value={paymentNoteInput}
                    onChange={(e) => setPaymentNoteInput(e.target.value)}
                    placeholder="Ví dụ: Bác Ba bán lợn trả tiền cám đợt 1..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPayingCustomer(null)}
                    className="flex-1 py-2.5 border border-slate-300 font-bold text-slate-700 rounded-xl"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl shadow-md"
                  >
                    Lưu & Xuất Hóa Đơn
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL 2: HÓA ĐƠN THANH TOÁN & XUẤT ẢNH / GỬI ZALO */}
      {activeReceipt && (() => {
        const receiptDateLabel = new Date(activeReceipt.paidAt).toLocaleDateString('vi-VN');
        const lastPaymentLabel = activeReceipt.lastPaymentDate
          ? ` tính đến ngày ${new Date(activeReceipt.lastPaymentDate).toLocaleDateString('vi-VN')}`
          : '';
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 text-xs space-y-3 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>Hóa đơn thanh toán ngày {receiptDateLabel}</span>
                </h3>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chi tiết hóa đơn thanh toán */}
              <div className="overflow-y-auto flex-1 space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="text-center border-b border-slate-200 pb-2">
                  <span className="font-black text-xs text-slate-900 uppercase block">
                    ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {STORE_INFO.address} • {STORE_INFO.phone}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mã hóa đơn:</span>
                    <span className="font-bold text-slate-900">#{activeReceipt.paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngày lập:</span>
                    <span>{new Date(activeReceipt.paidAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Khách hàng:</span>
                    <span className="font-bold text-slate-900">{activeReceipt.customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Số điện thoại:</span>
                    <span>{activeReceipt.customer.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Khu vực:</span>
                    <span>📍 {activeReceipt.customer.area}</span>
                  </div>
                </div>

                {/* CHI TIẾT CÔNG NỢ */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <h5 className="font-black text-slate-900 border-b border-slate-100 pb-1 text-[11px]">
                    CHI TIẾT CÔNG NỢ:
                  </h5>

                  <div className="flex justify-between text-slate-600">
                    <span>1. Nợ cũ{lastPaymentLabel}:</span>
                    <span className="font-bold text-slate-900 shrink-0 ml-1">
                      {formatVND(activeReceipt.oldDebtFromLastPayment)}
                    </span>
                  </div>

                  <div className="text-slate-600">
                    <div className="flex justify-between font-semibold">
                      <span>2. Đơn mới ({activeReceipt.recentOrders.length} đơn):</span>
                      <span className="font-bold text-slate-900 shrink-0 ml-1">
                        {formatVND(activeReceipt.recentOrdersTotal)}
                      </span>
                    </div>
                    <RecentOrdersBreakdown orders={activeReceipt.recentOrders} />
                  </div>

                  <div className="flex justify-between text-slate-800 pt-1 border-t border-slate-100 font-black">
                    <span>3. Tổng nợ:</span>
                    <span>{formatVND(activeReceipt.debtBeforePayment)}</span>
                  </div>

                  <div className="flex justify-between text-emerald-800 font-black bg-emerald-50 -mx-1.5 px-1.5 py-1.5 rounded-lg text-xs">
                    <span>4. Số tiền trả nợ:</span>
                    <span>-{formatVND(activeReceipt.amount)}</span>
                  </div>

                  <div className="flex justify-between text-rose-700 font-black text-sm pt-1 border-t border-slate-200">
                    <span>5. Nợ còn lại ngày {receiptDateLabel}:</span>
                    <span className="shrink-0 ml-1">{formatVND(activeReceipt.debtRemaining)}</span>
                  </div>
                </div>
              </div>

              {/* Các nút Lưu hình ảnh / In PDF */}
              <div className="shrink-0 pt-1">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleSaveReceiptImage(activeReceipt)}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border border-emerald-300"
                  >
                    {savedReceiptImage ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Đã lưu ảnh!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Lưu hình ảnh</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => printPaymentReceiptPdf(activeReceipt)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border border-slate-300"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>In PDF</span>
                  </button>

                  <button
                    onClick={() => setActiveReceipt(null)}
                    className="py-2 px-3 bg-slate-900 text-white rounded-xl font-bold text-xs"
                  >
                    Xong
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 3: XEM LỊCH SỬ CỦA 1 KHÁCH HÀNG (2 TAB: ĐƠN HÀNG & PHIẾU THANH TOÁN) */}
      {historyCustomer && (() => {
        const cleanPhone = historyCustomer.phone.trim();
        const sortByAsc = <T extends { date: string; id: string }>(a: T, b: T) => {
          const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
          const cmp = diff !== 0 ? diff : a.id.localeCompare(b.id, undefined, { numeric: true });
          return historyAsc ? cmp : -cmp;
        };

        const customerOrders = orders
          .filter((o) => o.customer.phone.trim() === cleanPhone && o.deliveryStatus === 'delivered')
          .slice()
          .sort((a, b) => sortByAsc({ date: a.createdAt, id: a.orderId }, { date: b.createdAt, id: b.orderId }));

        const customerPayments = payments
          .filter((p) => p.customerPhone.trim() === cleanPhone)
          .slice()
          .sort((a, b) => sortByAsc({ date: a.paidAt, id: a.paymentId }, { date: b.paidAt, id: b.paymentId }));

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 text-xs space-y-3 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Lịch Sử: {historyCustomer.name}
                  </h3>
                  <span className="text-[11px] text-slate-500">{historyCustomer.phone}</span>
                </div>
                <button
                  onClick={() => setHistoryCustomer(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Dư nợ hiện tại */}
              <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex justify-between items-center shrink-0">
                <span className="font-bold text-rose-950">Dư nợ hiện tại:</span>
                <span className="text-base font-black text-rose-700">
                  {formatVND(historyCustomer.currentDebt)}
                </span>
              </div>

              {/* 2 Tab tách riêng: Đơn hàng & Phiếu thanh toán */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 font-bold text-[11px]">
                <button
                  onClick={() => setHistoryTab('orders')}
                  className={`py-2 px-2 rounded-lg transition-all ${historyTab === 'orders'
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  📦 Đơn hàng ({customerOrders.length})
                </button>
                <button
                  onClick={() => setHistoryTab('payments')}
                  className={`py-2 px-2 rounded-lg transition-all ${historyTab === 'payments'
                    ? 'bg-white text-emerald-800 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  🧾 Thanh toán ({customerPayments.length})
                </button>
              </div>

              {/* Thanh sắp xếp thứ tự */}
              <div className="flex items-center justify-between text-[11px] px-0.5 shrink-0">
                <span className="font-bold text-slate-600">
                  {historyTab === 'orders' ? 'Danh sách đơn hàng:' : 'Danh sách phiếu thanh toán:'}
                </span>
                <button
                  onClick={() => setHistoryAsc((prev) => !prev)}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200"
                >
                  {historyAsc ? '↑ Thứ tự 1 → N' : '↓ Mới nhất'}
                </button>
              </div>

              {/* Nội dung theo từng tab */}
              <div className="overflow-y-auto flex-1 space-y-2">
                {historyTab === 'orders' ? (
                  customerOrders.length === 0 ? (
                    <p className="text-center py-6 text-slate-400 italic">Khách chưa có đơn hàng nào</p>
                  ) : (
                    customerOrders.map((ord) => (
                      <div
                        key={ord.orderId}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-900">Đơn #{ord.orderId}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(ord.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-600 pt-0.5">
                          <span>
                            {ord.items.length} loại • {ord.totalBags} bao •{' '}
                            {ord.deliveryStatus === 'delivered' ? '🚚 Đã giao' : '⏳ Chờ giao'}
                          </span>
                          <span className="font-black text-slate-900">{formatVND(ord.totalAmount)}</span>
                        </div>
                        <button
                          onClick={() => setActiveOrder(ord)}
                          className="w-full py-1.5 mt-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Xem / Xuất Lại Đơn Hàng</span>
                        </button>
                      </div>
                    ))
                  )
                ) : customerPayments.length === 0 ? (
                  <p className="text-center py-6 text-slate-400 italic">Khách chưa có phiếu thanh toán nào</p>
                ) : (
                  customerPayments.map((pm) => (
                    <div
                      key={pm.paymentId}
                      className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-emerald-950">
                        <span className="font-black">Hóa đơn #{pm.paymentId}</span>
                        <span className="text-[10px] text-emerald-700">
                          {new Date(pm.paidAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-emerald-800">
                        <span>{pm.paymentMethod === 'cash' ? '💵 Tiền mặt' : '📱 Chuyển khoản'}</span>
                        <span className="font-black text-emerald-900">
                          -{formatVND(pm.amount)}
                        </span>
                      </div>
                      {pm.note && (
                        <p className="text-[10px] text-emerald-700 italic">{pm.note}</p>
                      )}
                      <button
                        onClick={() => {
                          const rec = generatePaymentReceipt(pm.paymentId, orders);
                          if (rec) setActiveReceipt(rec);
                        }}
                        className="w-full py-1.5 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Xem / Xuất Lại Hóa Đơn</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="shrink-0 pt-1">
                <button
                  onClick={() => setHistoryCustomer(null)}
                  className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold text-xs"
                >
                  Đóng Sổ Nợ
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 4: XÁC NHẬN XÓA TOÀN BỘ DỮ LIỆU ĐƠN HÀNG & SỔ NỢ */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-black text-sm text-slate-900">Xóa Dữ Liệu Làm Lại Từ Đầu?</h3>
            <div className="text-xs text-slate-600 space-y-1 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
              <p>• Xóa toàn bộ đơn hàng ({orders.length} đơn), phiếu giao ({deliverySlips.length} phiếu) và phiếu thanh toán ({payments.length} phiếu).</p>
              <p>• Mã đơn mới sẽ bắt đầu lại từ <strong className="text-slate-900">#{`SH${String(new Date().getFullYear()).slice(-2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-001`}</strong> và phiếu thanh toán từ <strong className="text-slate-900">#PT-001</strong>.</p>
              <p className="text-emerald-700 font-semibold">• Giá cám và danh sách khu vực vẫn được giữ nguyên.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmResetData}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs shadow-md"
              >
                Xóa Dữ Liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: XEM CHI TIẾT & XUẤT LẠI ĐƠN HÀNG CŨ */}
      {activeOrder && (() => {
        const orderDateLabel = new Date(activeOrder.createdAt).toLocaleDateString('vi-VN');
        const oldDebtAtOrder = getCustomerDebtAt(
          activeOrder.customer.phone,
          orders,
          activeOrder.createdAt
        );
        const totalDebtAfterOrder = oldDebtAtOrder + activeOrder.totalAmount;

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 text-xs space-y-3 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
                <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-agri-700" />
                  <span>Đơn hàng #{activeOrder.orderId} ({orderDateLabel})</span>
                </h3>
                <button
                  onClick={() => setActiveOrder(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="text-center border-b border-slate-200 pb-2">
                  <span className="font-black text-xs text-slate-900 uppercase block">
                    ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {STORE_INFO.address} • {STORE_INFO.phone}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mã đơn:</span>
                    <span className="font-bold text-slate-900">#{activeOrder.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngày đặt:</span>
                    <span>{new Date(activeOrder.createdAt).toLocaleString('vi-VN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Khách hàng:</span>
                    <span className="font-bold text-slate-900">{activeOrder.customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Số điện thoại:</span>
                    <span>{activeOrder.customer.phone}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Địa chỉ:</span>
                    <span className="text-right">
                      {activeOrder.customer.farmAddress} ({activeOrder.customer.area})
                    </span>
                  </div>
                  {activeOrder.customer.deliveryNote && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500 shrink-0">Hẹn giao:</span>
                      <span className="text-right italic">{activeOrder.customer.deliveryNote}</span>
                    </div>
                  )}
                </div>

                {/* Chi tiết từng sản phẩm */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <h5 className="font-black text-slate-900 pb-1 text-[11px]">
                    CHI TIẾT ĐƠN HÀNG ({activeOrder.totalBags} bao • {formatWeight(activeOrder.totalWeightKg)}):
                  </h5>
                  <OrderItemsTable items={activeOrder.items} />

                  <div className="pt-1.5 border-t border-slate-100 space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>1. Nợ cũ trước đơn này:</span>
                      <span className="font-bold text-slate-900">{formatVND(oldDebtAtOrder)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>2. Tiền đơn #{activeOrder.orderId}:</span>
                      <span className="font-bold text-slate-900">{formatVND(activeOrder.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-black text-xs pt-1 border-t border-slate-100">
                      <span>3. Tổng cần trả / nợ:</span>
                      <span>{formatVND(totalDebtAfterOrder)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-1">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleSaveOrderImage(activeOrder, oldDebtAtOrder)}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border border-emerald-300"
                  >
                    {savedOrderImage ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Đã lưu ảnh!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Lưu hình ảnh</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveOrder(null)}
                    className="py-2 px-4 bg-slate-900 text-white rounded-xl font-bold text-xs"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 6: PHIẾU GIAO HÀNG CHO LÁI XE (VỪA KHÍT ĐIỆN THOẠI, CHỈ XUẤT PDF) */}
      {deliverySlipOrders && deliverySlipOrders.length > 0 && (() => {
        const slipProductTotals = summarizeDeliverySlipProducts(deliverySlipOrders);
        const slipTotalBags = deliverySlipOrders.reduce((s, o) => s + o.totalBags, 0);
        const activeSlipRecord = activeHistorySlipId
          ? deliverySlips.find((s) => s.slipId === activeHistorySlipId)
          : null;

        return (
          <div className="fixed inset-0 z-[75] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[92vh]">
              <div className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 font-bold text-sm min-w-0">
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {activeSlipRecord ? `Phiếu #${activeSlipRecord.slipId}` : 'Phiếu Giao Hàng'} ({deliverySlipOrders.length} đơn)
                  </span>
                </div>
                <button
                  onClick={() => setDeliverySlipOrders(null)}
                  className="p-1 hover:bg-white/20 rounded-full shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 overflow-y-auto overflow-x-hidden space-y-2.5 flex-1 bg-slate-50 min-w-0">
                {/* Ghi chú xe / lái xe */}
                <div className="bg-white p-2.5 rounded-2xl border-2 border-slate-300 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Lái xe / Biển số (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={driverNoteInput}
                    readOnly={Boolean(activeSlipRecord)}
                    onChange={(e) => setDriverNoteInput(e.target.value)}
                    placeholder="VD: Anh Hùng - Xe 36C-123.45"
                    className={`w-full min-w-0 px-3 py-1.5 rounded-xl border-2 border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-600 ${activeSlipRecord ? 'bg-slate-100 text-slate-700' : 'bg-white'
                      }`}
                  />
                </div>

                {/* Khung xem trước Phiếu Giao vừa khung điện thoại */}
                <div className="bg-white border-2 border-slate-300 rounded-2xl p-3 shadow-2xs space-y-2.5 text-xs min-w-0">
                  <div className="border-b border-slate-200 pb-2 space-y-1">
                    <p className="font-black text-emerald-900 text-xs uppercase break-words">
                      {STORE_INFO.name}
                    </p>
                    <p className="text-[11px] text-slate-500 break-words">
                      ĐT: {STORE_INFO.phone} • {STORE_INFO.shortAddress}
                    </p>
                    <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-700 font-bold">
                      <span>PHIẾU GIAO HÀNG</span>
                      <span>
                        {new Date(activeSlipRecord?.createdAt || Date.now()).toLocaleDateString('vi-VN')} • {deliverySlipOrders.length} khách
                      </span>
                    </div>
                  </div>

                  {/* Tổng hợp hàng bốc xe (khung bo tròn) */}
                  <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950 gap-2">
                      <span>Tổng số đơn: {deliverySlipOrders.length} đơn</span>
                      <span>Tổng số lượng: {slipTotalBags} bao</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {slipProductTotals.map((p) => (
                        <span
                          key={p.code}
                          className="bg-white border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded-lg text-[11px] font-bold"
                        >
                          {p.code}: <strong>{p.totalBags} bao</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Danh sách khách giao dạng thẻ dọc tối ưu cho điện thoại */}
                  <div className="space-y-2">
                    {deliverySlipOrders.map((ord) => (
                      <div
                        key={ord.orderId}
                        className="border-2 border-slate-300 rounded-xl p-2.5 bg-slate-50/70 space-y-1.5 text-[11px] min-w-0"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                          <span className="font-bold text-slate-900">#{ord.orderId}</span>
                          <span className="text-[10px] font-semibold text-slate-500 truncate">
                            KV: {ord.customer.area}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 text-xs break-words">{ord.customer.name}</p>
                          <p className="text-slate-600 font-semibold">{ord.customer.phone}</p>
                          <p className="text-slate-700 mt-0.5 break-words">{ord.customer.farmAddress}</p>
                          {ord.customer.deliveryNote && (
                            <p className="text-amber-800 italic mt-0.5 break-words">
                              Ghi chú: {ord.customer.deliveryNote}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                          <div className="flex flex-wrap gap-1">
                            {ord.items.map((it) => (
                              <span
                                key={it.product.id}
                                className="bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-800"
                              >
                                {it.product.code}: {it.quantity} bao
                              </span>
                            ))}
                          </div>
                          <span className="font-black text-emerald-800">
                            Tổng: {ord.totalBags} bao
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white border-t border-slate-200 flex gap-2 shrink-0">
                {activeSlipRecord ? (
                  <button
                    onClick={() =>
                      setPendingDelete({
                        kind: 'slip',
                        id: activeSlipRecord.slipId,
                        label: `Phiếu #${activeSlipRecord.slipId} (${activeSlipRecord.orders.length} đơn • ${activeSlipRecord.totalBags} bao)`,
                      })
                    }
                    className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1 shrink-0"
                    title="Xóa phiếu giao nhầm để tạo lại"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa phiếu</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDeliverySlipOrders(null);
                      setActiveHistorySlipId(null);
                    }}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-300 rounded-xl font-bold text-xs shrink-0"
                  >
                    Hủy bỏ
                  </button>
                )}
                <button
                  onClick={handlePrintDeliverySlipPdf}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {exportedSlipPdf ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã mở trang in!</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4" />
                      <span>In phiếu</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleSaveDeliverySlip}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shrink-0"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 7: LỊCH SỬ PHIẾU GIAO HÀNG / KHÁCH ĐẾN LẤY */}
      {slipHistoryMode && (() => {
        const isPickupHistory = slipHistoryMode === 'pickup';
        const sourceSlips = isPickupHistory ? pickupSlips : truckDeliverySlips;

        const availableSlipYears = Array.from(
          new Set([
            String(new Date().getFullYear()),
            ...sourceSlips.map((s) => String(new Date(s.createdAt).getFullYear())),
          ])
        ).sort((a, b) => Number(b) - Number(a));

        const filteredDeliverySlips = sourceSlips
          .filter((slip) => {
            const dt = new Date(slip.createdAt);
            const matchMonth =
              slipFilterMonth === 'all' || dt.getMonth() + 1 === Number(slipFilterMonth);
            const matchYear =
              slipFilterYear === 'all' || dt.getFullYear() === Number(slipFilterYear);
            return matchMonth && matchYear;
          })
          .slice()
          .sort((a, b) => {
            const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            const cmp = diff !== 0 ? diff : a.slipId.localeCompare(b.slipId, undefined, { numeric: true });
            return slipHistoryAsc ? cmp : -cmp;
          });

        return (
          <div className="fixed inset-0 z-[72] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border-2 border-agri-200 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="bg-agri-800 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {isPickupHistory ? (
                    <UserCheck className="w-4 h-4 text-agri-200 shrink-0" />
                  ) : (
                    <History className="w-4 h-4 text-agri-200 shrink-0" />
                  )}
                  <span>
                    {isPickupHistory ? 'Lịch Sử Khách Đến Lấy' : 'Lịch Sử Phiếu Giao Hàng'} ({filteredDeliverySlips.length}/{sourceSlips.length})
                  </span>
                </div>
                <button
                  onClick={() => setSlipHistoryMode(null)}
                  className="p-1 hover:bg-white/20 rounded-full shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Bộ lọc Tháng / Năm / Sắp xếp theo */}
              <div className="p-2.5 bg-white border-b border-slate-200 shrink-0 text-xs">
                <div className="grid grid-cols-3 gap-1.5">
                  <select
                    value={slipFilterMonth}
                    onChange={(e) => setSlipFilterMonth(e.target.value)}
                    aria-label="Lọc theo tháng"
                    className="w-full py-2 px-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-800 text-[11px] focus:outline-hidden focus:ring-2 focus:ring-agri-600"
                  >
                    <option value="all">Tất cả tháng</option>
                    {Array.from({ length: 12 }, (_, idx) => (
                      <option key={idx + 1} value={String(idx + 1)}>
                        Tháng {idx + 1}
                      </option>
                    ))}
                  </select>

                  <select
                    value={slipFilterYear}
                    onChange={(e) => setSlipFilterYear(e.target.value)}
                    aria-label="Lọc theo năm"
                    className="w-full py-2 px-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-800 text-[11px] focus:outline-hidden focus:ring-2 focus:ring-agri-600"
                  >
                    <option value="all">Tất cả năm</option>
                    {availableSlipYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Năm {yr}
                      </option>
                    ))}
                  </select>

                  <select
                    value={slipHistoryAsc ? 'asc' : 'desc'}
                    onChange={(e) => setSlipHistoryAsc(e.target.value === 'asc')}
                    aria-label="Sắp xếp theo"
                    className="w-full py-2 px-2 bg-slate-50 border-2 border-slate-300 rounded-xl font-bold text-slate-800 text-[11px] focus:outline-hidden focus:ring-2 focus:ring-agri-600"
                  >
                    <option value="desc">Mới nhất</option>
                    <option value="asc">Cũ nhất</option>
                  </select>
                </div>
              </div>

              <div className="p-3 overflow-y-auto overflow-x-hidden flex-1 space-y-2.5 bg-[#F6F8F5]">
                {sourceSlips.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-300 px-4">
                    {isPickupHistory ? (
                      <UserCheck className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    ) : (
                      <History className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    )}
                    <p className="font-bold text-slate-700 text-xs">
                      {isPickupHistory
                        ? 'Chưa có đơn khách đến lấy nào được lưu'
                        : 'Chưa có phiếu giao hàng nào được lưu'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isPickupHistory
                        ? 'Khi bạn tích chọn đơn chưa giao rồi bấm "Khách đến lấy", đơn sẽ được lưu tại đây và chuyển thành đã giao.'
                        : 'Khi bạn bấm "Tạo Phiếu Giao" rồi chọn "Lưu" hoặc "In PDF", phiếu sẽ tự động lưu tại đây và chuyển các đơn thành đã giao.'}
                    </p>
                  </div>
                ) : filteredDeliverySlips.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-300 px-4 space-y-2">
                    <History className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700 text-xs">Không có phiếu giao nào trong thời gian đã chọn</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSlipFilterMonth('all');
                        setSlipFilterYear('all');
                      }}
                      className="px-3 py-1.5 bg-agri-50 text-agri-700 rounded-lg font-bold text-[11px]"
                    >
                      Xem tất cả phiếu
                    </button>
                  </div>
                ) : (
                  filteredDeliverySlips.map((slip) => {
                    const slipProducts = summarizeDeliverySlipProducts(slip.orders);
                    return (
                      <div
                        key={slip.slipId}
                        className="bg-white rounded-2xl border-2 border-slate-300 p-3 space-y-2 shadow-2xs text-xs"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1.5">
                          <div className="min-w-0">
                            <span className="font-black text-slate-900 block">#{slip.slipId}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(slip.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <span className="bg-emerald-100 text-emerald-900 font-black text-[10px] px-2 py-0.5 rounded-full shrink-0">
                            {slip.orders.length} đơn • {slip.totalBags} bao
                          </span>
                        </div>

                        {slip.driverNote && (
                          <p className="text-[11px] text-slate-700 font-semibold break-words">
                            🚚 Lái xe: {slip.driverNote}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {slipProducts.map((p) => (
                            <span
                              key={p.code}
                              className="bg-slate-100 border border-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-bold"
                            >
                              {p.code}: {p.totalBags} bao
                            </span>
                          ))}
                        </div>

                        {isPickupHistory && (
                          <div className="space-y-1 bg-amber-50/60 border border-amber-200 rounded-xl p-2 text-[11px]">
                            {slip.orders.map((ord) => (
                              <div key={ord.orderId} className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-800 truncate">
                                  #{ord.orderId} • {ord.customer.name}
                                </span>
                                <span className="font-black text-amber-900 shrink-0">
                                  {ord.totalBags} bao ({formatVND(ord.totalAmount)})
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          {!isPickupHistory && (
                            <button
                              onClick={() => handleOpenHistorySlip(slip)}
                              className="flex-1 py-2 px-3 bg-agri-100 hover:bg-agri-200 text-agri-900 border border-agri-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Xem &amp; In phiếu</span>
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setPendingDelete({
                                kind: 'slip',
                                id: slip.slipId,
                                label: `${isPickupHistory ? 'Đơn khách đến lấy' : 'Phiếu'} #${slip.slipId} (${slip.orders.length} đơn • ${slip.totalBags} bao)`,
                              })
                            }
                            className={`${isPickupHistory ? 'w-full justify-center flex items-center gap-1.5 py-1.5 px-3 text-rose-600 hover:bg-rose-50' : 'p-2 text-slate-400 hover:text-rose-600'} rounded-xl border border-slate-200 text-xs font-bold`}
                            title={isPickupHistory ? 'Xóa & hoàn lại chưa giao' : 'Xóa phiếu này'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {isPickupHistory && <span>Xóa &amp; hoàn lại chưa giao</span>}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <button
                  onClick={() => setSlipHistoryMode(null)}
                  className="w-full py-2.5 bg-agri-800 hover:bg-agri-900 text-white rounded-xl font-bold text-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL 8: SỬA SỐ LƯỢNG SẢN PHẨM TRONG ĐƠN HÀNG (TỰ ĐỘNG CẬP NHẬT GIÁ & SỔ NỢ) */}
      {editingOrder && (() => {
        const editTotalBags = editingOrderItems.reduce((sum, it) => sum + it.quantity, 0);
        const editTotalKg = editingOrderItems.reduce(
          (sum, it) => sum + it.quantity * it.product.weightPerBag,
          0
        );
        const editTotalAmount = editingOrderItems.reduce(
          (sum, it) => sum + it.quantity * it.product.price,
          0
        );
        const amountDiff = editTotalAmount - editingOrder.totalAmount;
        const addableProducts = products.filter(
          (p) => !editingOrderItems.some((it) => it.product.id === p.id)
        );

        return (
          <div className="fixed inset-0 z-[78] flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border-2 border-agri-200 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="bg-agri-800 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-black text-sm">
                    <Pencil className="w-4 h-4 text-agri-200 shrink-0" />
                    <span className="truncate">Sửa Đơn #{editingOrder.orderId}</span>
                  </div>
                  <p className="text-[11px] text-agri-100 truncate">
                    {editingOrder.customer.name} • {editingOrder.customer.phone}
                  </p>
                </div>
                <button
                  onClick={() => setEditingOrder(null)}
                  className="p-1 hover:bg-white/20 rounded-full shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 overflow-y-auto flex-1 space-y-2.5 bg-[#F6F8F5] text-xs">
                {editingOrderItems.map((it) => (
                  <div
                    key={it.product.id}
                    className="bg-white p-2.5 rounded-2xl border-2 border-slate-300 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-slate-900 leading-tight">
                        {formatProductName(it.product)}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formatVND(it.product.price)}/bao ({it.product.weightPerBag}kg) • Thành tiền:{' '}
                        <strong className="text-slate-900">
                          {formatVND(it.quantity * it.product.price)}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleChangeEditOrderQty(it.product.id, it.quantity - 1)}
                        disabled={it.quantity === 0}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center disabled:opacity-40"
                        aria-label="Giảm 1 bao"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={it.quantity}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const val = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                          handleChangeEditOrderQty(it.product.id, val);
                        }}
                        className="w-12 text-center text-xs font-black text-slate-900 bg-white border border-slate-300 rounded py-1 focus:outline-hidden focus:ring-2 focus:ring-agri-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleChangeEditOrderQty(it.product.id, it.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-agri-700 text-white flex items-center justify-center"
                        aria-label="Tăng 1 bao"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {addableProducts.length > 0 && (
                  <div className="bg-white p-2.5 rounded-2xl border border-dashed border-slate-300 flex items-center gap-2">
                    <select
                      value={editAddProductId}
                      onChange={(e) => handleAddProductToEditOrder(e.target.value)}
                      className="flex-1 py-2 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="">+ Thêm loại cám khác vào đơn...</option>
                      {addableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatProductName(p)} ({formatVND(p.price)}/bao)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-white p-3 rounded-2xl border-2 border-agri-300 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Đơn ban đầu ({editingOrder.totalBags} bao):</span>
                    <span className="font-bold">{formatVND(editingOrder.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm">
                    <span>Sau khi sửa ({editTotalBags} bao • {formatWeight(editTotalKg)}):</span>
                    <span className="text-agri-800">{formatVND(editTotalAmount)}</span>
                  </div>
                  {amountDiff !== 0 && (
                    <div className="flex justify-between text-[11px] pt-1 border-t border-slate-100">
                      <span className="text-slate-600">Chênh lệch giá đơn:</span>
                      <span className={`font-black ${amountDiff > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {amountDiff > 0 ? `+${formatVND(amountDiff)}` : `-${formatVND(Math.abs(amountDiff))}`}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] font-semibold text-agri-800 bg-agri-50 px-2.5 py-1.5 rounded-xl">
                    {editingOrder.paymentStatus === 'paid'
                      ? 'Lưu ý: Đơn này đang đánh dấu Đã thu tiền.'
                      : 'Công nợ của khách hàng trong Sổ Nợ sẽ tự động cập nhật theo giá đơn mới.'}
                  </p>
                </div>

                {editTotalBags === 0 && (
                  <p className="text-[11px] font-bold text-rose-600 text-center">
                    Đơn hàng phải có ít nhất 1 bao (hoặc dùng nút &ldquo;Xóa bỏ đơn này&rdquo; ngoài danh sách).
                  </p>
                )}
              </div>

              <div className="p-3 bg-white border-t border-slate-200 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={editTotalBags <= 0}
                  onClick={handleSaveEditedOrder}
                  className="flex-1 py-2.5 bg-agri-700 hover:bg-agri-800 text-white font-black rounded-xl text-xs shadow-sm disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL XÁC NHẬN XÓA ĐƠN HÀNG / SẢN PHẨM / PHIẾU GIAO */}
      <ConfirmDeleteModal
        isOpen={pendingDelete !== null}
        title="Bạn chắc chắn muốn xóa?"
        message={
          pendingDelete?.kind === 'order'
            ? `Xóa vĩnh viễn ${pendingDelete.label}? Hành động này sẽ cập nhật lại sổ nợ và không thể hoàn tác.`
            : pendingDelete?.kind === 'product'
              ? `Xóa sản phẩm "${pendingDelete.label}" khỏi bảng giá Đại lý?`
              : pendingDelete?.kind === 'slip'
                ? `Xóa ${pendingDelete.label} khỏi lịch sử? Các đơn trong phiếu này sẽ quay lại trạng thái "Chưa giao" để bạn có thể sửa hoặc tạo lại phiếu giao mới.`
                : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmAdminDelete}
      />
    </div>
  );
};
