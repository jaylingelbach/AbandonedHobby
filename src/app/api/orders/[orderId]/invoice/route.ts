import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { ShippingAddress } from '@/modules/orders/types';
import { OrderItem } from './types';
import { formatCurrency } from '@/lib/utils';
import type { PublicAmountsDTO } from '@/modules/orders/types';
import { readQuantityOrDefault } from '@/lib/validation/quantity';

export const runtime = 'nodejs';

// --------------------- Styling ---------------------
const BRAND = {
  name: 'Abandoned Hobby',
  primary: '#111111',
  muted: '#f2f2f2',
  border: '#e5e5e5',
  text: '#111111',
  subtext: '#6b7280',
  accent: '#1f2937'
};

const PAGE = {
  size: 'LETTER' as const,
  margin: 48,
  colGap: 24
};

const TABLE = {
  headerFill: '#f8f8f8',
  rowAltFill: '#fbfbfb',
  border: '#e6e6e6',
  text: BRAND.text,
  subtext: BRAND.subtext
};

// --------------------- Helpers ---------------------

const isNum = (x: unknown): x is number =>
  typeof x === 'number' && Number.isFinite(x);

const isStr = (x: unknown): x is string =>
  typeof x === 'string' && x.length > 0;

function cityLine(addr?: ShippingAddress | null): string {
  if (!addr) return '';
  const city = addr.city || '';
  const state = addr.state || '';
  const postal = addr.postalCode || '';
  const left = [city, state].filter(Boolean).join(', ');
  return left ? `${left}${postal ? ` ${postal}` : ''}` : postal;
}

/**
 * Return the input string or an em dash when the input is missing or only whitespace.
 *
 * @param value - The string to check; may be `undefined` or `null`
 * @returns `value` if it contains any non-whitespace characters, `'—'` otherwise
 */
function textOrDash(value?: string | null): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : '—';
}

/**
 * Convert a string into a filesystem-safe filename.
 *
 * @param name - The input string to sanitize
 * @returns The input with characters other than ASCII letters, digits, dash, underscore, dot, or space replaced by `_`, and all consecutive whitespace collapsed into a single `_`
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_. ]/g, '_').replace(/\s+/g, '_');
}

// draw a labeled value pair
function keyVal(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  maxWidth?: number
): void {
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(BRAND.subtext)
    .text(label, { width: maxWidth });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(BRAND.text)
    .text(value, { width: maxWidth });
}

// section title
function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  doc
    .moveDown(0.8)
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(BRAND.accent)
    .text(title.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.3);
}

type ItemRow = {
  name: string;
  qty: number;
  unitCents: number;
  totalCents: number;
};

/**
 * Renders an items table (header plus rows) into the PDF and returns the vertical position after the table.
 *
 * Renders columns for item name, quantity, unit price, and line total using the provided currency code for formatting.
 *
 * @param doc - PDFKit document to draw into
 * @param x - Left X coordinate where the table should start
 * @param y - Top Y coordinate where the table should start
 * @param width - Total width available for the table
 * @param rows - Array of item rows containing name, qty, unitCents, and totalCents
 * @param currencyCode - ISO currency code used to format unit and total values
 * @returns The Y coordinate immediately below the rendered table content
 */
function drawItemsTable(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  rows: ItemRow[],
  currencyCode: string
): number {
  const colName = Math.floor(width * 0.5);
  const colQty = Math.floor(width * 0.14);
  const colUnit = Math.floor(width * 0.18);
  const colTot = width - colName - colQty - colUnit;

  const rowH = 24;
  let cursorY = y;

  // Header background
  doc.save().rect(x, cursorY, width, rowH).fill(TABLE.headerFill).restore();

  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.text);
  doc.text('Item', x + 8, cursorY + 6, { width: colName - 16 });
  doc.text('Qty', x + colName + 8, cursorY + 6, {
    width: colQty - 16,
    align: 'right'
  });
  doc.text('Unit', x + colName + colQty + 8, cursorY + 6, {
    width: colUnit - 16,
    align: 'right'
  });
  doc.text('Total', x + colName + colQty + colUnit + 8, cursorY + 6, {
    width: colTot - 16,
    align: 'right'
  });

  cursorY += rowH;

  // Rows — no indexed access, so no undefined
  for (const [index, row] of rows.entries()) {
    const bg = index % 2 === 1 ? TABLE.rowAltFill : undefined;
    if (bg) doc.save().rect(x, cursorY, width, rowH).fill(bg).restore();

    doc.font('Helvetica').fontSize(10).fillColor(BRAND.text);
    doc.text(row.name, x + 8, cursorY + 6, { width: colName - 16 });
    doc.text(String(row.qty), x + colName + 8, cursorY + 6, {
      width: colQty - 16,
      align: 'right'
    });
    doc.text(
      formatCurrency(row.unitCents / 100, currencyCode),
      x + colName + colQty + 8,
      cursorY + 6,
      {
        width: colUnit - 16,
        align: 'right'
      }
    );
    doc.text(
      formatCurrency(row.totalCents / 100, currencyCode),
      x + colName + colQty + colUnit + 8,
      cursorY + 6,
      {
        width: colTot - 16,
        align: 'right'
      }
    );

    cursorY += rowH;
  }

  // Border box
  doc
    .lineWidth(0.5)
    .strokeColor(TABLE.border)
    .rect(x, y, width, rowH + rows.length * rowH)
    .stroke();

  return cursorY;
}

function readPublicAmountsFromOrderDoc(
  order: Record<string, unknown>
): PublicAmountsDTO | undefined {
  const a = order?.amounts as Record<string, unknown> | undefined;
  if (!a) return undefined;
  const getInt = (v: unknown) =>
    Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0;
  return {
    subtotalCents: getInt(a.subtotalCents),
    shippingTotalCents: getInt(a.shippingTotalCents),
    discountTotalCents: getInt(a.discountTotalCents),
    taxTotalCents: getInt(a.taxTotalCents),
    totalCents: getInt((order as { total?: number }).total)
  };
}

// Fallback when order.amounts is missing
function buildPublicAmountsFallbackFromItems(
  order: Record<string, unknown>
): PublicAmountsDTO {
  const items = Array.isArray(order.items) ? order.items : [];
  const toInt = (n: unknown) => (Number.isInteger(n) ? (n as number) : 0);

  const subtotalCents = items.reduce((sum, it) => {
    const qty = readQuantityOrDefault(it?.quantity);
    const unit = toInt(it?.unitAmount);
    const sub = Number.isInteger(it?.amountSubtotal)
      ? it.amountSubtotal
      : unit * qty;
    return sum + Math.max(0, sub);
  }, 0);

  const taxTotalCents = items.reduce(
    (sum, it) => sum + Math.max(0, toInt(it?.amountTax)),
    0
  );

  // Prefer explicit per-line shipping snapshot if you keep it
  const shippingTotalCents = items.reduce(
    (sum, it) => sum + Math.max(0, toInt(it?.shippingSubtotalCents)),
    0
  );

  const discountTotalCents = 0; // unknown without amounts block
  const totalCents = toInt((order as { total?: number }).total);

  return {
    subtotalCents,
    shippingTotalCents,
    discountTotalCents,
    taxTotalCents,
    totalCents
  };
}

/**
 * Generate a downloadable PDF invoice for the order identified by the route parameter `orderId`.
 *
 * Authenticates the requester, loads the order (and the order's seller/tenant when available),
 * renders a styled invoice PDF (billing, seller, items, totals, footer), and returns it as an
 * attachment. If the requester is not authenticated the route responds with 401; if the order
 * cannot be found the route responds with 404.
 *
 * @param ctx - Route context whose `params` promise resolves to an object containing `orderId`
 * @returns A NextResponse containing the generated PDF invoice as an attachment on success;
 *          a 401 Unauthorized response if the requester is not authenticated; a 404 Order not found
 *          response if the order cannot be located.
 */

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await ctx.params;
  const payload = await getPayload({ config });

  // Verify user is authenticated and authorized to view this order
  const user = await payload.auth({ headers: _req.headers });
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let order;
  try {
    order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      user // pass user for access control
    });
  } catch (error) {
    console.error(error);
    return new NextResponse('Order not found', { status: 404 });
  }

  if (!order) {
    return new NextResponse('Order not found', { status: 404 });
  }

  const currency = String(order.currency || 'USD').toUpperCase();

  const amounts: PublicAmountsDTO =
    readPublicAmountsFromOrderDoc(
      order as unknown as Record<string, unknown>
    ) ??
    buildPublicAmountsFallbackFromItems(
      order as unknown as Record<string, unknown>
    );

  let seller;
  try {
    seller = await payload.findByID({
      collection: 'tenants',
      id: order.sellerTenant.toString(),
      depth: 0
    });
  } catch (error) {
    console.error(error);
    seller = null;
  }

  const doc = new PDFDocument({
    size: PAGE.size,
    margin: PAGE.margin
  });

  // stream → buffer
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  );

  const pageWidth = doc.page.width;
  const innerX = PAGE.margin;
  const innerW = pageWidth - PAGE.margin * 2;

  // ---------- Header bar ----------
  const headerH = 64;
  doc
    .save()
    .rect(innerX, PAGE.margin, innerW, headerH)
    .fill(BRAND.muted)
    .restore();

  // Brand (left)
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(BRAND.primary)
    .text(BRAND.name, innerX + 16, PAGE.margin + 16);

  // Order meta (right)
  const headerRightX = innerX + innerW / 2 + 40;
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(BRAND.primary)
    .text('Invoice', headerRightX, PAGE.margin + 14);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(BRAND.subtext)
    .text(
      `Order # ${textOrDash(order.orderNumber)}`,
      headerRightX,
      PAGE.margin + 36
    );
  doc.text(
    `Date ${new Date(order.createdAt).toLocaleDateString()}`,
    headerRightX,
    PAGE.margin + 50
  );

  // Establish a clean baseline below the header (prevents overlap)
  let y = PAGE.margin + headerH + 18;
  doc.x = innerX;
  doc.y = y;

  // ---------- Address block ----------
  sectionTitle(doc, 'Billing / Seller');
  // capture the Y after drawing the section title; columns start here
  const columnsStartY = doc.y;

  const colW = (innerW - PAGE.colGap) / 2;
  const rightX = innerX + colW + PAGE.colGap;

  // Left column: Billed to
  doc.x = innerX;
  doc.y = columnsStartY;
  if (order.shipping) {
    keyVal(doc, 'Billed to', textOrDash(order.shipping.name), colW);
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.text);
    if (order.shipping.line1) doc.text(order.shipping.line1, { width: colW });
    if (order.shipping.line2) doc.text(order.shipping.line2, { width: colW });
    const cl = cityLine(order.shipping);
    if (cl) doc.text(cl, { width: colW });
    if (order.shipping.country)
      doc.text(order.shipping.country, { width: colW });
  } else {
    keyVal(doc, 'Billed to', '—', colW);
  }
  const leftBottomY = doc.y;

  const sellerLabel = seller?.name ?? 'Seller';
  const sellerEmail = seller?.notificationEmail;
  doc.x = rightX;
  doc.y = columnsStartY; // align top with left column
  keyVal(doc, 'Sold by', sellerLabel, colW);
  keyVal(doc, 'Email', textOrDash(sellerEmail));
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(BRAND.subtext)
    .text('Thank you for your purchase!', {
      width: colW
    });
  const rightBottomY = doc.y;

  // Advance y below the taller column to avoid overlap with the next section
  y = Math.max(leftBottomY, rightBottomY) + 16;
  doc.x = innerX;
  doc.y = y;

  const toOrderItem = (li: unknown): OrderItem => {
    const o = (li ?? {}) as Record<string, unknown>;

    // pick the best available id and force it to a string
    const rawId =
      (o.id as unknown) ??
      (o._id as unknown) ??
      (o.product &&
      typeof o.product === 'object' &&
      o.product !== null &&
      'id' in o.product
        ? (o.product as { id: unknown }).id
        : undefined) ??
      (o.product as unknown);

    const id = String(rawId ?? 'unknown');

    const quantity = readQuantityOrDefault(o.quantity);
    const unitAmount = isNum(o.unitAmount) ? Math.trunc(o.unitAmount) : 0;
    const amountTotal = isNum(o.amountTotal)
      ? Math.trunc(o.amountTotal)
      : unitAmount * quantity;

    return {
      id,
      nameSnapshot: isStr(o.nameSnapshot) ? o.nameSnapshot : null,
      unitAmount,
      quantity,
      amountSubtotal: isNum(o.amountSubtotal)
        ? Math.trunc(o.amountSubtotal)
        : null,
      amountTax: isNum(o.amountTax) ? Math.trunc(o.amountTax) : null,
      amountTotal,
      refundPolicy: isStr(o.refundPolicy) ? o.refundPolicy : null,
      returnsAcceptedThrough: isStr(o.returnsAcceptedThrough)
        ? o.returnsAcceptedThrough
        : null
    };
  };

  // ---------- Items ----------
  sectionTitle(doc, 'Items');
  const items: OrderItem[] = (
    Array.isArray(order.items) ? order.items : []
  ).map(toOrderItem);

  const rows: ItemRow[] = items.map((li): ItemRow => {
    const qty = readQuantityOrDefault(li.quantity);
    const unit = typeof li.unitAmount === 'number' ? li.unitAmount : 0;
    const total =
      typeof li.amountTotal === 'number' ? li.amountTotal : unit * qty;
    return {
      name: li.nameSnapshot ?? 'Item',
      qty,
      unitCents: unit,
      totalCents: total
    };
  });

  const afterTableY = drawItemsTable(
    doc,
    innerX,
    doc.y,
    innerW,
    rows,
    currency
  );
  y = afterTableY + 16;
  doc.x = innerX;
  doc.y = y;

  // ---------- Totals (detailed) ----------
  const cardW = 300;
  const cardX = innerX + innerW - cardW;
  const cardY = y;

  const lineH = 18;
  const needsDiscount = (amounts.discountTotalCents ?? 0) > 0;
  const rowsCount = 4 + (needsDiscount ? 1 : 0) + 1; // Subtotal, Shipping, Tax, [Discount], divider, Total
  const cardH = 16 + rowsCount * lineH + 8;

  // Background + border
  doc.save().rect(cardX, cardY, cardW, cardH).fill(BRAND.muted).restore();
  doc
    .lineWidth(0.5)
    .strokeColor(TABLE.border)
    .rect(cardX, cardY, cardW, cardH)
    .stroke();

  let ty = cardY + 12;
  const labelW = Math.floor(cardW * 0.55);
  const valueW = cardW - labelW - 24;
  const labelX = cardX + 12;
  const valueX = labelX + labelW;

  const rightText = (text: string) =>
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(BRAND.text)
      .text(text, valueX, ty, {
        width: valueW,
        align: 'right'
      });
  const leftMuted = (text: string) =>
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(BRAND.subtext)
      .text(text, labelX, ty, {
        width: labelW
      });

  // Subtotal
  leftMuted('Subtotal');
  rightText(formatCurrency((amounts.subtotalCents ?? 0) / 100, currency));
  ty += lineH;

  // Shipping
  leftMuted('Shipping');
  rightText(formatCurrency((amounts.shippingTotalCents ?? 0) / 100, currency));
  ty += lineH;

  // Tax
  leftMuted('Tax');
  rightText(formatCurrency((amounts.taxTotalCents ?? 0) / 100, currency));
  ty += lineH;

  // Discount (optional, negative)
  if (needsDiscount) {
    leftMuted('Discount');
    rightText(
      formatCurrency(-(amounts.discountTotalCents ?? 0) / 100, currency)
    );
    ty += lineH;
  }

  // Divider
  doc
    .moveTo(cardX + 12, ty + 4)
    .lineTo(cardX + cardW - 12, ty + 4)
    .strokeColor(TABLE.border)
    .lineWidth(0.5)
    .stroke();
  ty += lineH;

  // Total
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(BRAND.text)
    .text('Total', labelX, ty, {
      width: labelW
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(BRAND.text)
    .text(
      formatCurrency((amounts.totalCents ?? 0) / 100, currency),
      valueX,
      ty,
      {
        width: valueW,
        align: 'right'
      }
    );

  if (order.returnsAcceptedThrough) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(BRAND.subtext)
      .text(
        `Returns accepted through ${new Date(order.returnsAcceptedThrough).toLocaleDateString()}`,
        cardX + 12,
        cardY + cardH - 16,
        { width: cardW - 24 }
      );
  }

  // ---------- Footer ----------
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(BRAND.subtext)
    .text(
      `${BRAND.name} • ${new Date().getFullYear()}`,
      innerX,
      doc.page.height - PAGE.margin - 12,
      { width: innerW, align: 'left' }
    );

  doc.end();
  const pdfBuffer = await done;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${sanitizeFilename(order.orderNumber)}.pdf"`,
      'Cache-Control': 'no-store'
    }
  });
}
