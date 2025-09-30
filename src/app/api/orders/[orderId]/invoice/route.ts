import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import { getPayload } from 'payload';
import config from '@/payload.config';
import { ShippingAddress } from '@/modules/orders/types';
import { OrderItemDoc } from './types';
import { formatCurrency } from '@/lib/utils';

export const runtime = 'nodejs';

// --------------------- Types ---------------------

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

function cityLine(addr?: ShippingAddress | null): string {
  if (!addr) return '';
  const city = addr.city || '';
  const state = addr.state || '';
  const postal = addr.postalCode || '';
  const left = [city, state].filter(Boolean).join(', ');
  return left ? `${left}${postal ? ` ${postal}` : ''}` : postal;
}

function textOrDash(value?: string | null): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : '—';
}

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

// --------------------- Route ---------------------
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

  // Right column: Sold by (use brand for now)
  // const sellerLabel = BRAND.name;
  const sellerLabel = seller?.name ?? 'Seller';
  const sellerEmail = seller?.notificationEmail;
  doc.x = rightX;
  doc.y = columnsStartY; // align top with left column
  keyVal(doc, 'Sold by', sellerLabel, colW);
  keyVal(doc, 'Email: ', sellerEmail ?? '');
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

  // ---------- Items ----------
  sectionTitle(doc, 'Items');
  const items: OrderItemDoc[] = Array.isArray(order.items) ? order.items : [];
  const rows: ItemRow[] = items.map((li): ItemRow => {
    const qty =
      typeof li.quantity === 'number' && li.quantity > 0 ? li.quantity : 1;
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
    order.currency
  );
  y = afterTableY + 16;
  doc.x = innerX;
  doc.y = y;

  // ---------- Totals card ----------
  const totalsCardW = 280;
  const totalsX = innerX + innerW - totalsCardW;
  const totalsY = y;

  // Card background + border
  doc
    .save()
    .rect(totalsX, totalsY, totalsCardW, 88)
    .fill(BRAND.muted)
    .restore();
  doc
    .lineWidth(0.5)
    .strokeColor(TABLE.border)
    .rect(totalsX, totalsY, totalsCardW, 88)
    .stroke();

  // Totals text
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(BRAND.subtext)
    .text('Total', totalsX + 16, totalsY + 14);
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(BRAND.text)
    .text(
      formatCurrency(order.total / 100, order.currency),
      totalsX + 16,
      totalsY + 30
    );

  if (order.returnsAcceptedThrough) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(BRAND.subtext)
      .text(
        `Returns accepted through ${new Date(order.returnsAcceptedThrough).toLocaleDateString()}`,
        totalsX + 16,
        totalsY + 56,
        { width: totalsCardW - 32 }
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
