# Mini App Zalo - Thức Ăn Gia Súc Sáng Hào 🌾

Ứng dụng Zalo Mini App chuyên biệt cho **Hộ kinh doanh Thức ăn chăn nuôi & Gia súc Sáng Hào**, tối ưu cho trải nghiệm đặt cám nhanh của bà con nông dân và chủ trại.

## 🌟 Tính Năng Nổi Bật

1. **Bảng Giá Cám Trực Tiếp Theo Ngày:**
   - Phân loại trực quan: Cám Heo, Cám Gà/Vịt, Bò Thịt/Sữa, Thủy Sản (Cá, Rô phi), Men vi sinh & Phụ gia chuồng trại.
   - Hiển thị rõ: Hãng (Cargill, CP, De Heus, Guyomarc'h), Hàm lượng đạm (%), Đơn giá bao và Giá sỉ theo tấn.

2. **Giỏ Hàng & Máy Tính Tải Trọng (Kg / Tấn):**
   - Tự động cộng dồn số bao thành khối lượng thực tế (kg / tấn).
   - Đề xuất phương tiện giao hàng hợp lý:
     - Dưới 400kg: Xe máy giao nhanh
     - 400kg - 1.5 tấn (10 - 35 bao): Xe ba gác đại lý
     - Trên 1.5 tấn (trên 40 bao): Xe tải thùng đại lý Sáng Hào

3. **Chính Sách Vận Chuyển:**
   - Miễn phí giao hàng chuồng trại nội khu.
   - Đơn xa: Chủ tiệm chủ động liên hệ qua Zalo / gọi điện để thỏa thuận cách giao tiện nhất.

4. **Tích Hợp Zalo 1-Chạm:**
   - Nút "Lấy từ Zalo": Tự động điền Họ tên và Số điện thoại từ tài khoản Zalo (`zmp-sdk`).
   - Nút "Gửi Đơn Này Qua Zalo Chủ Tiệm": Mở cuộc trò chuyện Zalo với chủ tiệm Sáng Hào kèm nội dung đơn hàng định dạng sẵn đầy đủ chi tiết.

5. **Thanh Toán Linh Hoạt:**
   - **Mã VietQR Động (Napas247):** Sinh mã QR chuẩn Agribank theo từng mã đơn hàng và số tiền chính xác, quét trên bất kỳ App ngân hàng nào cũng tự khớp thông tin.
   - **Tiền mặt khi giao cám (COD):** Kiểm tra đủ bao tại trại rồi thanh toán trực tiếp cho tài xế.

## 🚀 Khởi Chạy Dự Án

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Chạy môi trường phát triển (Dev server):
```bash
npm run dev
```
Truy cập: `http://localhost:3000`

### 3. Đóng gói triển khai (Build):
```bash
npm run build
```
Thư mục xuất ra: `dist/`

## 📱 Triển Khai Lên Zalo Mini App Console

1. Truy cập [Zalo Mini App Console](https://mini.zalo.me).
2. Tạo ứng dụng mới với ID cấu hình trong `app-config.json`.
3. Triển khai bằng ZMP CLI hoặc upload thư mục `dist/` vừa build.

