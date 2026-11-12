import { Product } from '../types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-d11',
    code: 'D11',
    name: 'D11 - Cám Heo Con Tập Ăn',
    brand: '',
    stage: 'Heo con tập ăn (5kg - 15kg)',
    weightPerBag: 25,
    price: 420000,
    tonPrice: 16800000,
    crudeProtein: '21.0% Đạm thô min',
    description: 'Viên cám nhỏ mịn, thơm sữa, dễ tiêu hóa, giúp heo con làm quen thức ăn sớm và giảm tiêu chảy khi cai sữa.',
    usageGuide: 'Cho ăn tự do nhiều bữa nhỏ trong ngày, luôn đảm bảo đủ nước sạch.',
    inStock: true,
    badge: 'Tập ăn chuẩn'
  },
  {
    id: 'prod-d21',
    code: 'D21',
    name: 'D21 - Cám Heo Con Sau Cai Sữa',
    brand: '',
    stage: 'Heo con cai sữa (15kg - 30kg)',
    weightPerBag: 25,
    price: 385000,
    tonPrice: 15400000,
    crudeProtein: '19.5% Đạm thô min',
    description: 'Cân bằng axit amin và men vi sinh đường ruột, giúp heo con bung khung nhanh, lông da hồng mượt sau cai sữa.',
    usageGuide: 'Cho ăn tự do hoặc chia 3 - 4 bữa/ngày tùy theo sức ăn của đàn.',
    inStock: true,
    badge: 'Bán chạy'
  },
  {
    id: 'prod-d41',
    code: 'D41',
    name: 'D41 - Cám Heo Choai Tăng Tốc',
    brand: '',
    stage: 'Heo choai (30kg - 60kg)',
    weightPerBag: 25,
    price: 350000,
    tonPrice: 14000000,
    crudeProtein: '17.0% Đạm thô min',
    description: 'Tăng khung xương khỏe, phát triển cơ bắp đồng đều, tối ưu FCR giúp giảm chi phí thức ăn giai đoạn tăng trưởng.',
    usageGuide: 'Cho ăn theo khẩu phần tăng dần từ 1.5 - 2.4 kg/con/ngày.',
    inStock: true
  },
  {
    id: 'prod-d41s',
    code: 'D41S',
    name: 'D41S - Cám Heo Choai Siêu Nạc',
    brand: '',
    stage: 'Heo choai siêu nạc (30kg - 60kg)',
    weightPerBag: 25,
    price: 365000,
    tonPrice: 14600000,
    crudeProtein: '18.0% Đạm thô min',
    description: 'Dòng đặc biệt giàu đạm dễ hấp thu cho đàn heo hướng nạc cao, giúp nở vai, dày lườn, phát triển khung vững chắc.',
    usageGuide: 'Cho ăn 1.6 - 2.5 kg/con/ngày, kết hợp bổ sung nước uống mát sạch.',
    inStock: true,
    badge: 'Siêu nạc'
  },
  {
    id: 'prod-d51',
    code: 'D51',
    name: 'D51 - Cám Heo Thịt Vỗ Béo',
    brand: '',
    stage: 'Heo thịt vỗ béo (60kg - xuất chuồng)',
    weightPerBag: 25,
    price: 340000,
    tonPrice: 13600000,
    crudeProtein: '15.5% Đạm thô min',
    description: 'Công thức vỗ béo chắc thịt, nặng cân, nở mông đùi, hạn chế tích mỡ, cho chất lượng thịt đỏ đẹp khi xuất bán.',
    usageGuide: 'Cho ăn 2.5 - 3.2 kg/con/ngày cho đến khi đạt trọng lượng xuất chuồng.',
    inStock: true,
    badge: 'Vỗ béo nặng cân'
  },
  {
    id: 'prod-d71',
    code: 'D71',
    name: 'D71 - Cám Heo Nái Mang Thai',
    brand: '',
    stage: 'Heo nái hậu bị & nái mang thai',
    weightPerBag: 25,
    price: 335000,
    tonPrice: 13400000,
    crudeProtein: '14.5% Đạm & Xơ cân đối',
    description: 'Giàu xơ tiêu hóa và khoáng hữu cơ giúp nái không táo bón, giữ thể trạng chuẩn, nuôi thai khỏe và đẻ sai con đồng đều.',
    usageGuide: 'Cho ăn 2.0 - 2.5 kg/con/ngày trong 84 ngày đầu, tăng lên 2.8 - 3.2 kg ở 3 tuần cuối thai kỳ.',
    inStock: true
  },
  {
    id: 'prod-d81',
    code: 'D81',
    name: 'D81 - Cám Heo Nái Nuôi Con',
    brand: '',
    stage: 'Heo nái đẻ & nuôi con',
    weightPerBag: 25,
    price: 375000,
    tonPrice: 15000000,
    crudeProtein: '17.5% Đạm sữa & Năng lượng cao',
    description: 'Kích thích tiết sữa dồi dào, sữa đặc giàu dưỡng chất giúp heo con bú khỏe mau lớn, giữ sức nái nhanh lên giống lại.',
    usageGuide: 'Cho ăn tăng dần sau đẻ, đạt 4.5 - 6.5 kg/con/ngày tùy số lượng con theo mẹ.',
    inStock: true,
    badge: 'Nhiều sữa bền nái'
  }
];

export const STORE_INFO = {
  name: 'Đại lý Thức ăn chăn nuôi SÁNG HÀO',
  businessType: 'Hộ Kinh Doanh',
  owner: 'Khương Văn Sáng',
  phone: '0982912678', // Zalo nhận đơn chính của chủ đại lý
  zaloId: '0982912678',
  address: '495 Lê Thái Tổ, Phường Tân Dân, Tỉnh Thanh Hóa',
  shortAddress: 'Tân Dân, Thanh Hóa',
  workingHours: '07:30 - 20:30 (Cả Thứ 7, CN)',
  shippingPolicy: 'Miễn phí giao hàng tận trại nội khu. Đơn hàng cự ly xa chủ đại lý sẽ trực tiếp gọi điện/nhắn Zalo để hỗ trợ sắp xếp xe giao phù hợp.'
};

