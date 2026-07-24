# 🚗 Nhận Diện Biển Số Xe Tự Động (Auto ALPR)

Ứng dụng web thông minh sử dụng sức mạnh của mô hình **Google Gemini AI** để tự động nhận diện, trích xuất và thống kê thông tin biển số xe từ hình ảnh.

## ✨ Tính năng nổi bật
- **Trích xuất AI tự động:** Chỉ cần kéo thả hoặc tải lên hàng loạt ảnh, AI sẽ tự động đọc biển số, nhận diện thời gian (giờ/ngày) và ghi nhận vị trí phương tiện.
- **Cảnh báo thiếu ảnh:** Ứng dụng tự động nhóm các ảnh có cùng chung một biển số lại với nhau. Cung cấp tính năng đếm tổng số lượng ảnh của mỗi phương tiện và tự động đánh dấu cảnh báo màu đỏ nếu số lượng ảnh chưa đạt chỉ tiêu cấu hình trước (ví dụ: cần tối thiểu 4 ảnh/xe).
- **Xuất báo cáo Excel chuyên nghiệp:** Dữ liệu có thể được xuất trực tiếp ra file Excel (.xlsx). Đặc biệt, hệ thống tự động **nhúng hình thu nhỏ (thumbnail) của ảnh gốc** thẳng vào trong từng ô báo cáo của file Excel để tiện lợi cho quá trình đối soát dữ liệu.
- **Quản lý đa luồng & Chống giới hạn (Failover):** Tự động điều tiết tải và tự động luân chuyển sử dụng luân phiên nhiều API Key cùng lúc để xử lý số lượng lớn ảnh mà không gặp tình trạng bị từ chối dịch vụ.
- **Bảng điều khiển Analytics:** Cung cấp biểu đồ trực quan tóm tắt toàn bộ tổng quan về tỷ lệ đạt chuẩn, cảnh báo và độ tin cậy AI.

## 🛠️ Công nghệ sử dụng
- **Giao diện (Frontend):** React 19 (Vite), TypeScript, Tailwind CSS, Lucide Icons, Recharts.
- **Máy chủ (Backend):** Node.js, Express, @google/genai SDK.
- **Tiện ích Xử lý Data:** ExcelJS, file-saver.

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

1. **Cài đặt thư viện (Dependencies):**
   Đảm bảo bạn đã cài đặt Node.js. Mở Terminal ở thư mục mã nguồn và chạy lệnh:
   ```bash
   npm install
   ```

2. **Cấu hình Gemini API Key:**
   Tạo hoặc mở file `.env` (hoặc `.env.local`) ở thư mục gốc và nhập các Gemini API Key của bạn (nếu có nhiều key, hãy phân cách chúng bằng dấu phẩy để hệ thống tự động chạy vòng lặp):
   ```
   GEMINI_API_KEY=AIzaSyA_key_thu_nhat_xxxx,AIzaSyB_key_thu_hai_yyyy
   ```

3. **Khởi chạy ứng dụng:**
   ```bash
   npm run dev
   ```
   Sau đó mở trình duyệt và truy cập vào địa chỉ hiển thị trên terminal (thường là `http://localhost:3000`).

---
*(Dự án được xây dựng nhằm mục đích tối ưu hóa quá trình kiểm duyệt và thu thập dữ liệu phương tiện giao thông tự động)*
