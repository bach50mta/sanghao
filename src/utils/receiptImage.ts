import { saveImageToGallery } from 'zmp-sdk';
import { PaymentReceipt } from '../types';
import { ManagedOrder } from '../stores/orderStore';
import { STORE_INFO } from '../data/mockProducts';
import { formatVND, formatWeight, formatProductName } from './format';

const CARD_WIDTH = 420;
const OUTER_PAD = 16;
const INNER_PAD = 18;
const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

interface TextRow {
  left: string;
  right?: string;
  leftColor?: string;
  rightColor?: string;
  font?: string;
  rightFont?: string;
  height?: number;
  bgColor?: string;
  strikeRight?: boolean;
}

/** Wraps text into lines that fit within maxWidth on the given 2D canvas context. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font;
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/** Draws a rounded rectangle path. */
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a PaymentReceipt into a crisp 2x-DPI PNG data URL so store owners
 * can save it locally or send it to customers later.
 */
export function renderReceiptToPngDataUrl(receipt: PaymentReceipt): string {
  const receiptDateLabel = new Date(receipt.paidAt).toLocaleDateString('vi-VN');
  const lastDateSuffix = receipt.lastPaymentDate
    ? ` tính đến ngày ${new Date(receipt.lastPaymentDate).toLocaleDateString('vi-VN')}`
    : '';

  const contentLeft = OUTER_PAD + INNER_PAD;
  const contentRight = CARD_WIDTH - OUTER_PAD - INNER_PAD;
  const contentWidth = contentRight - contentLeft;

  // Measure canvas first to wrap multi-line strings accurately
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    throw new Error('Trình duyệt không hỗ trợ tạo ảnh Canvas.');
  }

  const metaRows: TextRow[] = [
    { left: 'Mã hóa đơn:', right: `#${receipt.paymentId}` },
    { left: 'Ngày lập:', right: new Date(receipt.paidAt).toLocaleString('vi-VN') },
    { left: 'Khách hàng:', right: receipt.customer.name, rightFont: `700 13px ${FONT_FAMILY}` },
    { left: 'Số điện thoại:', right: receipt.customer.phone },
    { left: 'Khu vực:', right: receipt.customer.area },
    {
      left: 'Hình thức:',
      right: receipt.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản',
    },
  ];

  const noteLines = receipt.note
    ? wrapText(mCtx, `Ghi chú: ${receipt.note}`, contentWidth, `italic 11px ${FONT_FAMILY}`)
    : [];

  const orderLines: TextRow[] =
    receipt.recentOrders.length === 0
      ? [{ left: '(Không có đơn mới)', leftColor: '#94a3b8', font: `italic 11px ${FONT_FAMILY}`, height: 18 }]
      : receipt.recentOrders.map((o) => ({
        left: `• #${o.orderId} (${new Date(o.createdAt).toLocaleDateString('vi-VN')} • ${o.totalBags}b)${o.isPaidDirect ? ' [Đã trả ngay]' : ''
          }`,
        right: formatVND(o.totalAmount),
        leftColor: '#334155',
        rightColor: o.isPaidDirect ? '#94a3b8' : '#0f172a',
        font: `500 11px ${FONT_FAMILY}`,
        rightFont: `700 11px ${FONT_FAMILY}`,
        strikeRight: o.isPaidDirect,
        height: 20,
      }));

  // Compute dynamic height
  const headerHeight = 90;
  const metaHeight = metaRows.length * 22 + (noteLines.length > 0 ? noteLines.length * 16 + 6 : 0) + 16;
  const breakdownHeaderHeight = 32;
  const row1Height = 26;
  const row2TitleHeight = 24;
  const ordersHeight = orderLines.reduce((sum, r) => sum + (r.height || 20), 0) + 8;
  const row3Height = 30;
  const row4Height = 34;
  const row5Height = 36;
  const boxPadBottom = 14;
  const footerHeight = 42;

  const totalHeight =
    OUTER_PAD * 2 +
    headerHeight +
    metaHeight +
    breakdownHeaderHeight +
    row1Height +
    row2TitleHeight +
    ordersHeight +
    row3Height +
    row4Height +
    row5Height +
    boxPadBottom +
    footerHeight;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo ngữ cảnh vẽ ảnh.');
  }
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, CARD_WIDTH, totalHeight);

  // Main white card
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, OUTER_PAD, OUTER_PAD, CARD_WIDTH - OUTER_PAD * 2, totalHeight - OUTER_PAD * 2, 18);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  let y = OUTER_PAD + 24;

  // Store Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#065f46';
  ctx.font = `800 13px ${FONT_FAMILY}`;
  ctx.fillText(`HÓA ĐƠN THANH TOÁN NGÀY ${receiptDateLabel}`, CARD_WIDTH / 2, y);

  y += 22;
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 15px ${FONT_FAMILY}`;
  ctx.fillText('ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO', CARD_WIDTH / 2, y);

  y += 17;
  ctx.fillStyle = '#64748b';
  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillText(`${STORE_INFO.shortAddress} • ${STORE_INFO.phone}`, CARD_WIDTH / 2, y);

  y += 16;
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(contentLeft, y);
  ctx.lineTo(contentRight, y);
  ctx.stroke();

  // Metadata rows
  y += 20;
  for (const row of metaRows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 12px ${FONT_FAMILY}`;
    ctx.fillText(row.left, contentLeft, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = row.rightFont || `600 12px ${FONT_FAMILY}`;
    ctx.fillText(row.right || '', contentRight, y);
    y += 22;
  }

  if (noteLines.length > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = `italic 11px ${FONT_FAMILY}`;
    for (const line of noteLines) {
      ctx.fillText(line, contentLeft, y);
      y += 16;
    }
    y += 4;
  }

  // Breakdown box
  const boxTop = y;
  const boxHeight =
    breakdownHeaderHeight + row1Height + row2TitleHeight + ordersHeight + row3Height + row4Height + row5Height + boxPadBottom;

  ctx.fillStyle = '#f8fafc';
  roundRectPath(ctx, contentLeft, boxTop, contentWidth, boxHeight, 12);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  const boxL = contentLeft + 12;
  const boxR = contentRight - 12;
  y += 22;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 12px ${FONT_FAMILY}`;
  ctx.fillText('CHI TIẾT CÔNG NỢ:', boxL, y);

  y += 26;
  // 1. Nợ cũ
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `500 12px ${FONT_FAMILY}`;
  ctx.fillText(`1. Nợ cũ${lastDateSuffix}:`, boxL, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 12px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(receipt.oldDebtFromLastPayment), boxR, y);

  y += 25;
  // 2. Đơn mới
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `600 12px ${FONT_FAMILY}`;
  ctx.fillText(`2. Đơn mới (${receipt.recentOrders.length} đơn):`, boxL, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 12px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(receipt.recentOrdersTotal), boxR, y);

  y += 19;
  for (const ord of orderLines) {
    ctx.textAlign = 'left';
    ctx.fillStyle = ord.leftColor || '#334155';
    ctx.font = ord.font || `500 11px ${FONT_FAMILY}`;
    ctx.fillText(ord.left, boxL + 8, y);

    if (ord.right) {
      ctx.textAlign = 'right';
      ctx.fillStyle = ord.rightColor || '#0f172a';
      ctx.font = ord.rightFont || `700 11px ${FONT_FAMILY}`;
      ctx.fillText(ord.right, boxR, y);
      if (ord.strikeRight) {
        const w = ctx.measureText(ord.right).width;
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(boxR - w, y - 3.5);
        ctx.lineTo(boxR, y - 3.5);
        ctx.stroke();
      }
    }
    y += ord.height || 20;
  }

  y += 4;
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(boxL, y);
  ctx.lineTo(boxR, y);
  ctx.stroke();

  y += 22;
  // 3. Tổng nợ
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  ctx.font = `800 12px ${FONT_FAMILY}`;
  ctx.fillText('3. Tổng nợ:', boxL, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatVND(receipt.debtBeforePayment), boxR, y);

  y += 12;
  // 4. Số tiền trả nợ (green pill)
  ctx.fillStyle = '#ecfdf5';
  roundRectPath(ctx, boxL - 4, y, boxR - boxL + 8, 28, 8);
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#065f46';
  ctx.font = `800 12px ${FONT_FAMILY}`;
  ctx.fillText('4. Số tiền trả nợ:', boxL + 2, y + 18);
  ctx.textAlign = 'right';
  ctx.fillText(`-${formatVND(receipt.amount)}`, boxR - 2, y + 18);

  y += 46;
  // 5. Nợ còn lại
  ctx.textAlign = 'left';
  ctx.fillStyle = receipt.debtRemaining > 0 ? '#be123c' : '#047857';
  ctx.font = `800 13px ${FONT_FAMILY}`;
  ctx.fillText(`5. Nợ còn lại ngày ${receiptDateLabel}:`, boxL, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatVND(receipt.debtRemaining), boxR, y);

  // Footer
  y = boxTop + boxHeight + 24;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillText('Đại lý Thức ăn chăn nuôi Sáng Hào xin trân trọng cảm ơn!', CARD_WIDTH / 2, y);

  return canvas.toDataURL('image/png');
}

/**
 * Saves a PNG data URL to device gallery inside Zalo or falls back to file download in browsers.
 */
export async function saveCanvasDataUrl(dataUrl: string, filename: string): Promise<'gallery' | 'download'> {
  try {
    await saveImageToGallery({ imageBase64Data: dataUrl });
    return 'gallery';
  } catch {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return 'download';
  }
}

/**
 * Saves the payment receipt as a PNG image. Inside Zalo mobile, saves directly to
 * the device gallery; in local/web browsers, falls back to downloading a .png file.
 */
export async function saveReceiptAsImage(receipt: PaymentReceipt): Promise<'gallery' | 'download'> {
  const dataUrl = renderReceiptToPngDataUrl(receipt);
  return saveCanvasDataUrl(dataUrl, `hoa-don-${receipt.paymentId}.png`);
}

/**
 * Renders an order invoice (items + old/new debt) into a crisp 2x-DPI PNG data URL.
 */
export function renderOrderToPngDataUrl(order: ManagedOrder, oldDebt: number = 0): string {
  const orderDateLabel = new Date(order.createdAt).toLocaleDateString('vi-VN');
  const totalDebtAfter = oldDebt + order.totalAmount;

  const contentLeft = OUTER_PAD + INNER_PAD;
  const contentRight = CARD_WIDTH - OUTER_PAD - INNER_PAD;
  const contentWidth = contentRight - contentLeft;

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    throw new Error('Trình duyệt không hỗ trợ tạo ảnh Canvas.');
  }

  const metaRows: TextRow[] = [
    { left: 'Mã đơn hàng:', right: `#${order.orderId}` },
    { left: 'Ngày đặt:', right: new Date(order.createdAt).toLocaleString('vi-VN') },
    { left: 'Khách hàng:', right: order.customer.name, rightFont: `700 13px ${FONT_FAMILY}` },
    { left: 'Số điện thoại:', right: order.customer.phone },
    { left: 'Khu vực:', right: order.customer.area || 'Chưa chọn' },
  ];

  const addressLines = wrapText(
    mCtx,
    `Địa chỉ: ${order.customer.farmAddress}`,
    contentWidth,
    `500 11px ${FONT_FAMILY}`
  );
  const noteLines = order.customer.deliveryNote
    ? wrapText(mCtx, `Hẹn giao: ${order.customer.deliveryNote}`, contentWidth, `italic 11px ${FONT_FAMILY}`)
    : [];

  const nameColWidth = 142;
  const wrappedItems = order.items.map((item) => {
    const nameLines = wrapText(
      mCtx,
      formatProductName(item.product),
      nameColWidth,
      `600 10.5px ${FONT_FAMILY}`
    );
    const rowHeight = Math.max(24, nameLines.length * 14 + 10);
    return { item, nameLines, rowHeight };
  });

  const itemBlockHeight = wrappedItems.reduce((sum, r) => sum + r.rowHeight, 0);
  const headerHeight = 90;
  const metaHeight =
    metaRows.length * 22 + addressLines.length * 16 + noteLines.length * 16 + 18;
  const itemsHeaderHeight = 52; // Title + 4-column table header row
  const itemsFooterHeight = 16;
  const debtSummaryHeight = 96;
  const footerHeight = 40;

  const totalHeight =
    OUTER_PAD * 2 +
    headerHeight +
    metaHeight +
    itemsHeaderHeight +
    itemBlockHeight +
    itemsFooterHeight +
    debtSummaryHeight +
    footerHeight;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH * scale;
  canvas.height = totalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Không thể khởi tạo ngữ cảnh vẽ ảnh.');
  }
  ctx.scale(scale, scale);

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, CARD_WIDTH, totalHeight);

  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, OUTER_PAD, OUTER_PAD, CARD_WIDTH - OUTER_PAD * 2, totalHeight - OUTER_PAD * 2, 18);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.stroke();

  let y = OUTER_PAD + 24;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#065f46';
  ctx.font = `800 13px ${FONT_FAMILY}`;
  ctx.fillText(`HÓA ĐƠN ĐƠN HÀNG NGÀY ${orderDateLabel}`, CARD_WIDTH / 2, y);

  y += 22;
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 15px ${FONT_FAMILY}`;
  ctx.fillText('ĐẠI LÝ THỨC ĂN CHĂN NUÔI SÁNG HÀO', CARD_WIDTH / 2, y);

  y += 17;
  ctx.fillStyle = '#64748b';
  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillText(`${STORE_INFO.shortAddress} • ${STORE_INFO.phone}`, CARD_WIDTH / 2, y);

  y += 16;
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(contentLeft, y);
  ctx.lineTo(contentRight, y);
  ctx.stroke();

  y += 20;
  for (const row of metaRows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = `500 12px ${FONT_FAMILY}`;
    ctx.fillText(row.left, contentLeft, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = row.rightFont || `600 12px ${FONT_FAMILY}`;
    ctx.fillText(row.right || '', contentRight, y);
    y += 22;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `500 11px ${FONT_FAMILY}`;
  for (const line of addressLines) {
    ctx.fillText(line, contentLeft, y);
    y += 16;
  }
  ctx.font = `italic 11px ${FONT_FAMILY}`;
  for (const line of noteLines) {
    ctx.fillText(line, contentLeft, y);
    y += 16;
  }
  y += 6;

  // Items & debt box
  const boxTop = y;
  const boxHeight = itemsHeaderHeight + itemBlockHeight + itemsFooterHeight + debtSummaryHeight;
  ctx.fillStyle = '#f8fafc';
  roundRectPath(ctx, contentLeft, boxTop, contentWidth, boxHeight, 12);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  const boxL = contentLeft + 12;
  const boxR = contentRight - 12;
  const colSL = boxL + 178;
  const colPrice = boxL + 246;
  y += 22;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 12px ${FONT_FAMILY}`;
  ctx.fillText(`CHI TIẾT ĐƠN HÀNG (${order.totalBags} bao • ${formatWeight(order.totalWeightKg)}):`, boxL, y);

  // 4-column table header: Tên hàng | SL | Đơn giá | Thành tiền
  y += 10;
  ctx.fillStyle = '#e2e8f0';
  roundRectPath(ctx, boxL - 2, y, boxR - boxL + 4, 20, 6);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = `700 10px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.fillText('Tên hàng', boxL + 2, y + 13);
  ctx.textAlign = 'right';
  ctx.fillText('SL', colSL, y + 13);
  ctx.fillText('Đơn giá', colPrice, y + 13);
  ctx.fillText('Thành tiền', boxR - 2, y + 13);

  y += 32;
  for (const { item, nameLines, rowHeight } of wrappedItems) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = `600 10.5px ${FONT_FAMILY}`;
    nameLines.forEach((line, idx) => {
      ctx.fillText(line, boxL + 2, y + idx * 14);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = `700 10.5px ${FONT_FAMILY}`;
    ctx.fillText(`${item.quantity}b`, colSL, y);

    ctx.fillStyle = '#475569';
    ctx.font = `500 10.5px ${FONT_FAMILY}`;
    ctx.fillText(formatVND(item.product.price), colPrice, y);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 10.5px ${FONT_FAMILY}`;
    ctx.fillText(formatVND(item.quantity * item.product.price), boxR - 2, y);

    y += rowHeight;
  }

  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(boxL, y - 4);
  ctx.lineTo(boxR, y - 4);
  ctx.stroke();

  y += 22;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `500 12px ${FONT_FAMILY}`;
  ctx.fillText('1. Nợ cũ trước đơn này:', boxL, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 12px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(oldDebt), boxR, y);

  y += 22;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `500 12px ${FONT_FAMILY}`;
  ctx.fillText(`2. Tiền đơn #${order.orderId}:`, boxL, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 12px ${FONT_FAMILY}`;
  ctx.fillText(formatVND(order.totalAmount), boxR, y);

  y += 26;
  ctx.textAlign = 'left';
  ctx.fillStyle = totalDebtAfter > 0 ? '#be123c' : '#047857';
  ctx.font = `800 13px ${FONT_FAMILY}`;
  ctx.fillText('3. Tổng cần trả / nợ:', boxL, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatVND(totalDebtAfter), boxR, y);

  y = boxTop + boxHeight + 24;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillText('Đại lý Thức ăn chăn nuôi Sáng Hào xin trân trọng cảm ơn!', CARD_WIDTH / 2, y);

  return canvas.toDataURL('image/png');
}

/** Saves an order invoice PNG image to gallery inside Zalo or downloads it in browsers. */
export async function saveOrderAsImage(
  order: ManagedOrder,
  oldDebt: number = 0
): Promise<'gallery' | 'download'> {
  const dataUrl = renderOrderToPngDataUrl(order, oldDebt);
  return saveCanvasDataUrl(dataUrl, `don-hang-${order.orderId}.png`);
}

