import { PaymentReceipt } from '../types';
import { STORE_INFO } from '../data/mockProducts';
import { formatVND } from './format';
import { escapeHtml, printHtmlDocument } from './deliverySlip';

function buildPaymentReceiptHtml(receipt: PaymentReceipt): string {
  const receiptDateLabel = new Date(receipt.paidAt).toLocaleDateString('vi-VN');
  const paidAtFull = new Date(receipt.paidAt).toLocaleString('vi-VN');
  const lastPaymentLabel = receipt.lastPaymentDate
    ? ` tính đến ngày ${new Date(receipt.lastPaymentDate).toLocaleDateString('vi-VN')}`
    : '';
  const paymentMethodLabel = receipt.paymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt';
  const locationText = [receipt.customer.farmAddress, receipt.customer.area].filter(Boolean).join(' • ');

  const recentOrdersHtml =
    receipt.recentOrders.length === 0
      ? '<div class="empty-orders">Không có đơn phát sinh mới</div>'
      : `<table class="orders-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Mã đơn</th>
              <th class="right">SL</th>
              <th class="right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.recentOrders
              .map((ord) => {
                const dateStr = new Date(ord.createdAt).toLocaleDateString('vi-VN');
                const amountText = escapeHtml(formatVND(ord.totalAmount));
                const amountCell = ord.isPaidDirect
                  ? `<span class="strike">${amountText}</span> <span class="badge-paid">Đã trả ngay</span>`
                  : amountText;
                return `<tr>
                  <td>${escapeHtml(dateStr)}</td>
                  <td>#${escapeHtml(ord.orderId)}</td>
                  <td class="right">${ord.totalBags} bao</td>
                  <td class="right">${amountCell}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Hóa đơn thanh toán #${escapeHtml(receipt.paymentId)}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 14mm;
      font-size: 13px;
      line-height: 1.45;
    }
    .sheet {
      max-width: 176mm;
      margin: 0 auto;
    }
    .store-header {
      text-align: center;
      border-bottom: 2px solid #166534;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .store-name {
      font-size: 18px;
      font-weight: 800;
      text-transform: uppercase;
      color: #166534;
      margin: 0 0 4px;
    }
    .store-sub {
      font-size: 12px;
      color: #475569;
    }
    .doc-title {
      text-align: center;
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 14px;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
      background: #f8fafc;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 3px 0;
    }
    .meta-label { color: #475569; }
    .meta-val { font-weight: 700; text-align: right; }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      margin: 0 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #cbd5e1;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
    }
    .summary-row.bold { font-weight: 700; }
    .summary-row.paid {
      background: #ecfdf5;
      color: #065f46;
      font-weight: 800;
      padding: 7px 10px;
      border-radius: 6px;
      margin: 6px -10px;
    }
    .summary-row.remaining {
      font-size: 15px;
      font-weight: 800;
      color: #be123c;
      border-top: 2px solid #cbd5e1;
      padding-top: 8px;
      margin-top: 4px;
    }
    .orders-table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0 10px;
      font-size: 12px;
    }
    .orders-table th, .orders-table td {
      border: 1px solid #e2e8f0;
      padding: 5px 8px;
      text-align: left;
    }
    .orders-table th {
      background: #f1f5f9;
      font-weight: 700;
    }
    .right { text-align: right !important; }
    .strike { text-decoration: line-through; color: #64748b; }
    .badge-paid {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      color: #065f46;
      background: #d1fae5;
      padding: 1px 5px;
      border-radius: 4px;
      margin-left: 4px;
    }
    .empty-orders {
      font-size: 12px;
      color: #64748b;
      font-style: italic;
      padding: 4px 0 8px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-top: 28px;
      page-break-inside: avoid;
    }
    .sig-col {
      flex: 1;
      text-align: center;
    }
    .sig-title {
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .sig-note {
      font-size: 11px;
      color: #64748b;
      font-style: italic;
    }
    .sig-space {
      height: 68px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="store-header">
      <div class="store-name">ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO</div>
      <div class="store-sub">${escapeHtml(STORE_INFO.address)} • ${escapeHtml(STORE_INFO.phone)}</div>
    </div>

    <h1 class="doc-title">Hóa đơn thanh toán ngày ${escapeHtml(receiptDateLabel)}</h1>

    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">Mã hóa đơn:</span><span class="meta-val">#${escapeHtml(receipt.paymentId)}</span></div>
      <div class="meta-row"><span class="meta-label">Ngày lập:</span><span class="meta-val">${escapeHtml(paidAtFull)}</span></div>
      <div class="meta-row"><span class="meta-label">Khách hàng:</span><span class="meta-val">${escapeHtml(receipt.customer.name)}</span></div>
      <div class="meta-row"><span class="meta-label">Số điện thoại:</span><span class="meta-val">${escapeHtml(receipt.customer.phone)}</span></div>
      <div class="meta-row"><span class="meta-label">Địa chỉ / Khu vực:</span><span class="meta-val">${escapeHtml(locationText)}</span></div>
      <div class="meta-row"><span class="meta-label">Hình thức thanh toán:</span><span class="meta-val">${escapeHtml(paymentMethodLabel)}</span></div>
      ${receipt.note ? `<div class="meta-row"><span class="meta-label">Ghi chú:</span><span class="meta-val">${escapeHtml(receipt.note)}</span></div>` : ''}
    </div>

    <h2 class="section-title">Chi tiết công nợ</h2>

    <div class="summary-row">
      <span>1. Nợ cũ${escapeHtml(lastPaymentLabel)}:</span>
      <strong>${escapeHtml(formatVND(receipt.oldDebtFromLastPayment))}</strong>
    </div>

    <div class="summary-row bold">
      <span>2. Đơn mới (${receipt.recentOrders.length} đơn):</span>
      <span>${escapeHtml(formatVND(receipt.recentOrdersTotal))}</span>
    </div>
    ${recentOrdersHtml}

    <div class="summary-row bold" style="border-top: 1px solid #e2e8f0; padding-top: 8px;">
      <span>3. Tổng nợ:</span>
      <span>${escapeHtml(formatVND(receipt.debtBeforePayment))}</span>
    </div>

    <div class="summary-row paid">
      <span>4. Số tiền trả nợ:</span>
      <span>-${escapeHtml(formatVND(receipt.amount))}</span>
    </div>

    <div class="summary-row remaining">
      <span>5. Nợ còn lại ngày ${escapeHtml(receiptDateLabel)}:</span>
      <span>${escapeHtml(formatVND(receipt.debtRemaining))}</span>
    </div>

    <div class="signatures">
      <div class="sig-col">
        <div class="sig-title">Đại diện cửa hàng</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-space"></div>
      </div>
      <div class="sig-col">
        <div class="sig-title">Khách hàng</div>
        <div class="sig-note">(Ký, ghi rõ họ tên)</div>
        <div class="sig-space"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Opens the browser Print / Save-as-PDF dialog for a payment receipt synchronously
 * inside the click gesture using a hidden iframe.
 */
export function printPaymentReceiptPdf(receipt: PaymentReceipt): void {
  printHtmlDocument(buildPaymentReceiptHtml(receipt));
}

