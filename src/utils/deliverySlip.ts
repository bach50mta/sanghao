import { ManagedOrder } from '../stores/orderStore';
import { STORE_INFO } from '../data/mockProducts';
import { formatWeight } from './format';
import { roundRectPath, saveCanvasDataUrl, wrapText } from './receiptImage';

export interface DeliveryProductSummary {
  code: string;
  totalBags: number;
  totalKg: number;
}

/** Aggregates product code quantities across all orders in a delivery slip. */
export function summarizeDeliverySlipProducts(orders: ManagedOrder[]): DeliveryProductSummary[] {
  const byCode = new Map<string, DeliveryProductSummary>();
  for (const ord of orders) {
    for (const item of ord.items) {
      const code = item.product.code;
      const existing = byCode.get(code) || { code, totalBags: 0, totalKg: 0 };
      existing.totalBags += item.quantity;
      existing.totalKg += item.quantity * item.product.weightPerBag;
      byCode.set(code, existing);
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Builds clean shareable plain text of the delivery slip for messaging the driver. */
export function buildDeliverySlipText(orders: ManagedOrder[], driverNote?: string): string {
  const nowStr = new Date().toLocaleString('vi-VN');
  const productSummary = summarizeDeliverySlipProducts(orders);
  const totalBags = orders.reduce((s, o) => s + o.totalBags, 0);
  const totalKg = orders.reduce((s, o) => s + o.totalWeightKg, 0);

  const lines: string[] = [
    `PHIẾU GIAO HÀNG - ${STORE_INFO.name.toUpperCase()}`,
    `Ngày lập: ${nowStr}`,
  ];
  if (driverNote?.trim()) {
    lines.push(`Lái xe / Xe giao: ${driverNote.trim()}`);
  }
  lines.push(
    `Tổng bốc xe: ${orders.length} đơn • ${totalBags} bao (${formatWeight(totalKg)})`,
    `Tổng hợp theo mã: ${productSummary.map((p) => `${p.code}: ${p.totalBags} bao`).join(' | ')}`,
    '----------------------------------------',
    'DANH SÁCH KHÁCH NHẬN HÀNG:',
  );

  orders.forEach((ord, idx) => {
    const itemsText = ord.items.map((it) => `${it.product.code} (${it.quantity} bao)`).join(', ');
    lines.push(
      `${idx + 1}. [${ord.orderId}] ${ord.customer.name} - ${ord.customer.phone}`,
      `   Đ/c: ${ord.customer.farmAddress} (${ord.customer.area})`,
      `   Hàng: ${itemsText} => Tổng ${ord.totalBags} bao (${formatWeight(ord.totalWeightKg)})`,
      ord.customer.deliveryNote ? `   Ghi chú: ${ord.customer.deliveryNote}` : '',
      '   Ký xác nhận nhận đủ hàng: ______________________',
    );
  });

  return lines.filter(Boolean).join('\n');
}

/** Builds complete A4 portrait HTML document for browser printing / saving as PDF. */
function buildDeliverySlipHtml(
  orders: ManagedOrder[],
  _driverNote?: string,
  slipId?: string,
): string {
  const nowStr = new Date().toLocaleDateString('vi-VN');
  const productSummary = summarizeDeliverySlipProducts(orders);
  const totalBags = orders.reduce((s, o) => s + o.totalBags, 0);

  const summaryCells = productSummary
    .map((p) => `<span class="badge">${escapeHtml(p.code)}: ${p.totalBags} bao</span>`)
    .join('');

  const rowsHtml = orders
    .map((ord) => {
      const itemLines = ord.items
        .map(
          (it) =>
            `<div class="item-row"><span>${escapeHtml(it.product.code)}</span><span>${it.quantity} bao</span></div>`,
        )
        .join('');
      const noteLine = ord.customer.deliveryNote
        ? `<div class="sub-line">Ghi chú: ${escapeHtml(ord.customer.deliveryNote)}</div>`
        : '';

      return `
        <tr>
          <td class="center">#${escapeHtml(ord.orderId)}</td>
          <td>
            <div class="cust-name">${escapeHtml(ord.customer.name)}</div>
            <div>${escapeHtml(ord.customer.phone)}</div>
          </td>
          <td>
            <div>${escapeHtml(ord.customer.farmAddress)}</div>
            <div class="sub-line">KV: ${escapeHtml(ord.customer.area)}</div>
            ${noteLine}
          </td>
          <td>
            ${itemLines}
            <div class="row-total">Tổng: ${ord.totalBags} bao</div>
          </td>
          <td class="sign-cell">
            <div class="sign-hint">(ký, ghi rõ họ tên)</div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: "Calibri", "Segoe UI", Arial, sans-serif;
      color: #000;
      margin: 0;
      font-size: 13pt;
      font-weight: 400;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-frame { width: 100%; border-collapse: collapse; }
    .page-frame > thead > tr > td,
    .page-frame > tfoot > tr > td { padding: 0; border: 0; }
    .page-frame > tbody > tr > td { padding: 0 12mm; border: 0; }
    .page-space { height: 12mm; }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .store-block { width: 54%; }
    .store-name { font-weight: 700; }
    .title-block { width: 44%; text-align: right; }
    .doc-title {
      font-size: 16pt;
      font-weight: 700;
      margin: 0 0 4px 0;
    }
    .summary-box {
      border: 1px solid #334155;
      border-radius: 10px;
      background: #f8fafc;
      padding: 8px 12px;
      margin-bottom: 10px;
    }
    .summary-top {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
    }
    .badge { display: inline-block; }
    .slip-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .slip-table th,
    .slip-table td {
      border: 1px solid #334155;
      padding: 6px;
      vertical-align: top;
      word-wrap: break-word;
      font-size: 13px;
    }
    .slip-table th {
      background: #f1f5f9;
      text-align: center;
      font-weight: 700;
    }
    .slip-table td { font-weight: 400; }
    .slip-table tr { break-inside: avoid; page-break-inside: avoid; }
    .center { text-align: center !important; }
    .cust-name { font-weight: 700; }
    .sub-line { margin-top: 2px; }
    .item-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      border-bottom: 1px dashed #94a3b8;
      padding: 2px 0;
    }
    .row-total { margin-top: 4px; }
    .sign-cell { height: 70px; text-align: center; }
    .sign-hint { color: #475569; font-style: italic; font-size: 12px; }
    .footer-sign {
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
      padding: 0 12px;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .footer-col { width: 44%; }
    .footer-role { font-weight: 700; }
    .footer-sub { margin-top: 4px; font-style: italic; font-size: 12px; }
    .footer-name { margin-top: 100px; font-weight: 700; }
    @media screen and (max-width: 600px) {
      .page-frame > tbody > tr > td { padding: 0 12px; }
      .page-space { height: 12px; }
      .doc-header { flex-direction: column; }
      .store-block, .title-block { width: 100%; text-align: left; }
    }
  </style>
</head>
<body>
  <table class="page-frame">
    <thead><tr><td><div class="page-space"></div></td></tr></thead>
    <tbody>
      <tr>
        <td>
          <div class="doc-header">
            <div class="store-block">
              <div class="store-name">${escapeHtml(STORE_INFO.name).toUpperCase()}</div>
              <div>${escapeHtml(STORE_INFO.address)}</div>
              <div>ĐT/Zalo: ${escapeHtml(STORE_INFO.phone)}</div>
            </div>
            <div class="title-block">
              <h1 class="doc-title">PHIẾU GIAO HÀNG</h1>
              <div>Mã phiếu: ${slipId?.trim() ? `#${escapeHtml(slipId.trim())}` : '....................'}</div>
              <div>Ngày lập: ${escapeHtml(nowStr)}</div>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-top">
              <span>Tổng số đơn: ${orders.length} đơn</span>
              <span>Tổng số lượng: ${totalBags} bao</span>
            </div>
            <div class="badges">${summaryCells}</div>
          </div>

          <table class="slip-table">
            <thead>
              <tr>
                <th style="width: 17%;" class="center">Mã đơn</th>
                <th style="width: 21%;">Khách &amp; SĐT</th>
                <th style="width: 23%;">Địa chỉ</th>
                <th style="width: 19%;">Sản phẩm &amp; số lượng</th>
                <th style="width: 20%;" class="center">Ký nhận đủ hàng</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer-sign">
            <div class="footer-col">
              <div class="footer-role">NGƯỜI LẬP PHIẾU</div>
              <div class="footer-sub">(Ký, ghi rõ họ tên)</div>
              <div class="footer-name">${escapeHtml(STORE_INFO.owner).toUpperCase()}</div>
            </div>
            <div class="footer-col">
              <div class="footer-role">LÁI XE</div>
              <div class="footer-sub">(Đã kiểm đủ số bao lên xe)</div>
              <div class="footer-sub">(Ký, ghi rõ họ tên)</div>
            </div>
          </div>
        </td>
      </tr>
    </tbody>
    <tfoot><tr><td><div class="page-space"></div></td></tr></tfoot>
  </table>
</body>
</html>`;
}

/**
 * Prints standalone HTML via a hidden iframe synchronously inside the click gesture
 * so the browser Print / Save-as-PDF preview opens without popup blocking.
 */
export function printHtmlDocument(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  win.onafterprint = cleanup;
  try {
    win.focus();
    win.print();
  } catch {
    cleanup();
    return;
  }
  setTimeout(cleanup, 60000);
}

/**
 * Triggers native browser Print / Save-as-PDF dialog synchronously on click to
 * retain the user gesture, using a hidden iframe to suppress parent UI chrome.
 */
export function printDeliverySlipPdf(
  orders: ManagedOrder[],
  driverNote?: string,
  slipId?: string,
): void {
  if (orders.length === 0) return;
  printHtmlDocument(buildDeliverySlipHtml(orders, driverNote, slipId));
}

// ---------- Mobile-first A4 Canvas Renderer & Binary PDF / PNG Export ----------

const A4_PX_WIDTH = 1240; // ~150 DPI A4 portrait width (210mm)
const A4_PX_HEIGHT = 1754; // ~150 DPI A4 portrait height (297mm)
const PDF_MARGIN = 68;
const PDF_CONTENT_W = A4_PX_WIDTH - PDF_MARGIN * 2; // 1104px
const SLIP_FONT = '"Calibri", "Segoe UI", system-ui, -apple-system, sans-serif';

interface RenderedRowLayout {
  order: ManagedOrder;
  nameLines: string[];
  addressLines: string[];
  rowHeight: number;
}

function createA4PageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = A4_PX_WIDTH;
  canvas.height = A4_PX_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Thiết bị không hỗ trợ tạo file PDF/ảnh.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_PX_WIDTH, A4_PX_HEIGHT);
  return { canvas, ctx };
}

/**
 * Renders the portrait A4 delivery slip onto one or more high-resolution canvases
 * so mobile browsers and Zalo Mini App can export crisp Unicode PDFs or save gallery images.
 */
function renderDeliverySlipCanvases(
  orders: ManagedOrder[],
  driverNote?: string,
): HTMLCanvasElement[] {
  const nowStr = new Date().toLocaleDateString('vi-VN');
  const productSummary = summarizeDeliverySlipProducts(orders);
  const totalBags = orders.reduce((s, o) => s + o.totalBags, 0);

  // Column proportions matching the HTML slip: 17% | 21% | 23% | 19% | 20%
  const colWidths = [188, 232, 254, 210, 220];
  const colX = colWidths.reduce<number[]>((acc, _, idx) => {
    acc.push(idx === 0 ? PDF_MARGIN : acc[idx - 1] + colWidths[idx - 1]);
    return acc;
  }, []);

  const pages: HTMLCanvasElement[] = [];
  let { canvas, ctx } = createA4PageCanvas();
  pages.push(canvas);

  const cellPad = 12;
  const textFont = `400 22px ${SLIP_FONT}`;
  const boldCellFont = `700 22px ${SLIP_FONT}`;
  const headerCellFont = `700 22px ${SLIP_FONT}`;
  const hintFont = `italic 400 19px ${SLIP_FONT}`;
  const lineH = 29;

  // Measure each row upfront for clean pagination
  const rowLayouts: RenderedRowLayout[] = orders.map((ord) => {
    const nameLines = wrapText(ctx, ord.customer.name, colWidths[1] - cellPad * 2, boldCellFont);
    const addrMaxW = colWidths[2] - cellPad * 2;
    const addressLines = [
      ...wrapText(ctx, ord.customer.farmAddress, addrMaxW, textFont),
      ...wrapText(ctx, `KV: ${ord.customer.area}`, addrMaxW, textFont),
      ...(ord.customer.deliveryNote
        ? wrapText(ctx, `Ghi chú: ${ord.customer.deliveryNote}`, addrMaxW, textFont)
        : []),
    ];

    const col1H = 24 + (nameLines.length + 1) * lineH; // Name lines + Phone
    const col2H = 24 + addressLines.length * lineH;
    const col3H = 24 + (ord.items.length + 1) * 34; // items + Total line
    const rowHeight = Math.max(122, col1H, col2H, col3H);
    return { order: ord, nameLines, addressLines, rowHeight };
  });

  // 1. Document Header (Left: Store, Right: PHIẾU GIAO HÀNG + Date + Driver)
  let y = PDF_MARGIN;
  const leftMaxW = Math.floor(PDF_CONTENT_W * 0.54);
  const storeNameLines = wrapText(ctx, STORE_INFO.name.toUpperCase(), leftMaxW, `700 24px ${SLIP_FONT}`);
  const storeAddrLines = wrapText(ctx, STORE_INFO.address, leftMaxW, `400 22px ${SLIP_FONT}`);

  let leftY = y + 24;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = `700 24px ${SLIP_FONT}`;
  for (const l of storeNameLines) {
    ctx.fillText(l, PDF_MARGIN, leftY);
    leftY += 30;
  }
  ctx.font = `400 22px ${SLIP_FONT}`;
  for (const l of storeAddrLines) {
    ctx.fillText(l, PDF_MARGIN, leftY);
    leftY += 28;
  }
  ctx.fillText(`ĐT/Zalo: ${STORE_INFO.phone}`, PDF_MARGIN, leftY);
  leftY += 28;

  let rightY = y + 28;
  ctx.textAlign = 'right';
  ctx.font = `700 32px ${SLIP_FONT}`;
  ctx.fillText('PHIẾU GIAO HÀNG', PDF_MARGIN + PDF_CONTENT_W, rightY);
  rightY += 36;
  ctx.font = `400 22px ${SLIP_FONT}`;
  ctx.fillText(`Ngày lập: ${nowStr}`, PDF_MARGIN + PDF_CONTENT_W, rightY);
  rightY += 30;
  ctx.fillText(
    `Lái xe: ${driverNote?.trim() ? driverNote.trim() : '....................'}`,
    PDF_MARGIN + PDF_CONTENT_W,
    rightY,
  );
  rightY += 24;

  y = Math.max(leftY, rightY) + 8;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(PDF_MARGIN, y);
  ctx.lineTo(PDF_MARGIN + PDF_CONTENT_W, y);
  ctx.stroke();

  // 2. Rounded First Summary Box ("Tổng đơn giao")
  y += 18;
  const badgeText = productSummary.map((p) => `${p.code}: ${p.totalBags} bao`).join('   •   ');
  const badgeLines = wrapText(ctx, badgeText, PDF_CONTENT_W - 36, `400 22px ${SLIP_FONT}`);
  const summaryH = 62 + badgeLines.length * 30;

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  roundRectPath(ctx, PDF_MARGIN, y, PDF_CONTENT_W, summaryH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = `400 23px ${SLIP_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`Tổng số đơn: ${orders.length} đơn`, PDF_MARGIN + 18, y + 34);
  ctx.textAlign = 'right';
  ctx.fillText(`Tổng số lượng: ${totalBags} bao`, PDF_MARGIN + PDF_CONTENT_W - 18, y + 34);

  ctx.textAlign = 'left';
  ctx.font = `400 22px ${SLIP_FONT}`;
  badgeLines.forEach((line, idx) => {
    ctx.fillText(line, PDF_MARGIN + 18, y + 72 + idx * 30);
  });

  y += summaryH + 18;

  // Helper to draw 5-column table header at current y
  const drawTableHeader = (targetCtx: CanvasRenderingContext2D, topY: number): number => {
    const headerH = 54;
    const headers = ['Mã đơn', 'Khách & SĐT', 'Địa chỉ', 'Sản phẩm và số lượng', 'Ký nhận đủ hàng'];
    targetCtx.fillStyle = '#f1f5f9';
    targetCtx.fillRect(PDF_MARGIN, topY, PDF_CONTENT_W, headerH);
    targetCtx.strokeStyle = '#334155';
    targetCtx.lineWidth = 1.5;

    headers.forEach((label, i) => {
      targetCtx.strokeRect(colX[i], topY, colWidths[i], headerH);
      targetCtx.fillStyle = '#000000';
      targetCtx.font = headerCellFont;
      targetCtx.textAlign = 'center';
      targetCtx.fillText(label, colX[i] + colWidths[i] / 2, topY + 34);
    });
    return topY + headerH;
  };

  y = drawTableHeader(ctx, y);

  // 3. Render Order Rows with clean Page Break handling
  const footerHeight = 220;
  for (const row of rowLayouts) {
    if (y + row.rowHeight > A4_PX_HEIGHT - PDF_MARGIN) {
      ({ canvas, ctx } = createA4PageCanvas());
      pages.push(canvas);
      y = drawTableHeader(ctx, PDF_MARGIN);
    }

    const { order: ord, nameLines, addressLines, rowHeight } = row;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    colWidths.forEach((w, i) => {
      ctx.strokeRect(colX[i], y, w, rowHeight);
    });

    // Col 0: Order ID
    ctx.fillStyle = '#000000';
    ctx.font = textFont;
    ctx.textAlign = 'center';
    ctx.fillText(`#${ord.orderId}`, colX[0] + colWidths[0] / 2, y + 36);

    // Col 1: Bold Customer Name + Phone
    ctx.textAlign = 'left';
    ctx.font = boldCellFont;
    nameLines.forEach((line, idx) => {
      ctx.fillText(line, colX[1] + cellPad, y + 36 + idx * lineH);
    });
    ctx.font = textFont;
    ctx.fillText(ord.customer.phone, colX[1] + cellPad, y + 36 + nameLines.length * lineH);

    // Col 2: Address + Area + Delivery Note
    addressLines.forEach((line, idx) => {
      ctx.fillText(line, colX[2] + cellPad, y + 36 + idx * lineH);
    });

    // Col 3: Product Codes & Bag Counts + Row Bag Total
    let itemY = y + 36;
    for (const it of ord.items) {
      ctx.textAlign = 'left';
      ctx.fillText(it.product.code, colX[3] + cellPad, itemY);
      ctx.textAlign = 'right';
      ctx.fillText(`${it.quantity} bao`, colX[3] + colWidths[3] - cellPad, itemY);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(colX[3] + cellPad, itemY + 8);
      ctx.lineTo(colX[3] + colWidths[3] - cellPad, itemY + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      itemY += 34;
    }
    ctx.textAlign = 'left';
    ctx.fillText(`Tổng: ${ord.totalBags} bao`, colX[3] + cellPad, itemY + 2);

    // Col 4: Signature hint
    ctx.fillStyle = '#475569';
    ctx.font = hintFont;
    ctx.textAlign = 'center';
    ctx.fillText('(ký, ghi rõ họ tên)', colX[4] + colWidths[4] / 2, y + 34);

    y += rowHeight;
  }

  // 4. Signature Footer on last page
  if (y + footerHeight > A4_PX_HEIGHT - PDF_MARGIN) {
    ({ canvas, ctx } = createA4PageCanvas());
    pages.push(canvas);
    y = PDF_MARGIN;
  } else {
    y += 36;
  }

  const leftSignCenterX = PDF_MARGIN + Math.floor(PDF_CONTENT_W * 0.24);
  const rightSignCenterX = PDF_MARGIN + Math.floor(PDF_CONTENT_W * 0.76);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = `700 22px ${SLIP_FONT}`;
  ctx.fillText('NGƯỜI LẬP PHIẾU', leftSignCenterX, y);
  ctx.fillText('LÁI XE', rightSignCenterX, y);

  ctx.font = `italic 400 20px ${SLIP_FONT}`;
  ctx.fillText('(Ký, ghi rõ họ tên)', leftSignCenterX, y + 30);
  ctx.fillText('(Đã kiểm đủ số bao lên xe)', rightSignCenterX, y + 30);
  ctx.fillText('(Ký, ghi rõ họ tên)', rightSignCenterX, y + 58);

  ctx.font = `700 22px ${SLIP_FONT}`;
  ctx.fillText(STORE_INFO.owner.toUpperCase(), leftSignCenterX, y + 170);

  return pages;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Packages A4 JPEG canvases into a standard binary PDF 1.4 Blob without external dependencies
 * so Vietnamese diacritics render cleanly on any phone or desktop PDF viewer.
 */
function buildPdfBlobFromJpegPages(canvases: HTMLCanvasElement[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushText = (text: string) => pushBytes(encoder.encode(text));

  pushText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const pageCount = canvases.length;
  const totalObjects = 2 + pageCount * 3;
  const offsets: number[] = new Array(totalObjects + 1).fill(0);

  // Object 1: Catalog
  offsets[1] = offset;
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages tree
  const pageIds = Array.from({ length: pageCount }, (_, i) => `${5 + i * 3} 0 R`).join(' ');
  offsets[2] = offset;
  pushText(`2 0 obj\n<< /Type /Pages /Kids [ ${pageIds} ] /Count ${pageCount} >>\nendobj\n`);

  // A4 Portrait in PDF points: 595.28 x 841.89
  canvases.forEach((canvas, idx) => {
    const imgId = 3 + idx * 3;
    const contentId = 4 + idx * 3;
    const pageId = 5 + idx * 3;
    const jpegBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.92));

    offsets[imgId] = offset;
    pushText(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
    );
    pushBytes(jpegBytes);
    pushText('\nendstream\nendobj\n');

    const streamBody = `q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n`;
    offsets[contentId] = offset;
    pushText(
      `${contentId} 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}endstream\nendobj\n`,
    );

    offsets[pageId] = offset;
    pushText(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
  });

  const xrefOffset = offset;
  pushText(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjects; id++) {
    pushText(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

/**
 * Exports the A4 portrait delivery slip directly as a genuine .pdf file download
 * so the user gets the file immediately for viewing and printing without opening a Share sheet.
 */
export async function exportDeliverySlipPdf(
  orders: ManagedOrder[],
  driverNote?: string,
): Promise<'download'> {
  if (orders.length === 0) {
    throw new Error('Không có đơn hàng để xuất phiếu.');
  }
  const canvases = renderDeliverySlipCanvases(orders, driverNote);
  const pdfBlob = buildPdfBlobFromJpegPages(canvases);
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `phieu-giao-hang-${dateStamp}.pdf`;

  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  return 'download';
}

/**
 * Saves delivery slip page(s) as PNG images directly to the phone gallery inside Zalo Mini App,
 * or downloads PNG files in web browsers.
 */
export async function saveDeliverySlipAsImage(
  orders: ManagedOrder[],
  driverNote?: string,
): Promise<'gallery' | 'download'> {
  if (orders.length === 0) {
    throw new Error('Không có đơn hàng để lưu ảnh.');
  }
  const canvases = renderDeliverySlipCanvases(orders, driverNote);
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let lastResult: 'gallery' | 'download' = 'download';
  for (let i = 0; i < canvases.length; i++) {
    const suffix = canvases.length > 1 ? `-trang-${i + 1}` : '';
    lastResult = await saveCanvasDataUrl(
      canvases[i].toDataURL('image/png'),
      `phieu-giao-hang-${dateStamp}${suffix}.png`,
    );
  }
  return lastResult;
}
