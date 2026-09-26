import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from 'fontkit';
import { OPENRUNDE_REGULAR_B64, OPENRUNDE_BOLD_B64, QUADRANT_B64, STICKER_PNG_B64 } from './assets/invoice-assets';

/**
 * Materio invoice PDF — clean receipt layout (Perplexity-style structure,
 * Materio brand): title + logo header, invoice meta rows, from/bill-to
 * columns, due headline, item table, right-aligned totals.
 * No address / GST block (unregistered business).
 */

export interface InvoicePdfData {
  number: string;
  dateISO: string | null;
  status: string;
  billedToName: string;
  billedToEmail: string;
  billedToUsername: string;
  planLabel: string;
  planShort: string;
  periodLabel: string;
  amountPaise: number;
  /** Gift receipts: show unit price, deduct it, total 0. */
  isGift?: boolean;
  unitPaise?: number;
  /** Transaction trail for real purchases (omitted when absent). */
  paymentId?: string | null;
  subscriptionId?: string | null;
  orderId?: string | null;
}

const INK = rgb(0.102, 0.09, 0.082);
const MUTED = rgb(0.42, 0.42, 0.42);
const FAINT = rgb(0.62, 0.62, 0.62);
const HAIRLINE = rgb(0.82, 0.82, 0.82);
const DARKLINE = rgb(0.25, 0.25, 0.25);
const ACCENT = rgb(0.922, 0.369, 0.157); // materio orange #EB5E28

function b64ToBytes(b64: string): Uint8Array {
  // NOTE: keep this a real Buffer (not new Uint8Array(view)) — fontkit
  // rejects plain Uint8Array views as "Unknown font format". Buffer exists
  // in Node, Bun, and Workers via nodejs_compat.
  return Buffer.from(b64, 'base64');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtShort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRs(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAGE_W = 595;
const PAGE_H = 842;
const M = 48;
const RIGHT = PAGE_W - M;

function right(page: PDFPage, font: PDFFont, size: number, text: string, xEnd: number, y: number, color = INK) {
  page.drawText(text, { x: xEnd - font.widthOfTextAtSize(text, size), y, size, font, color });
}

/** Truncate with ellipsis so row text never runs into numeric columns. */
function fit(font: PDFFont, size: number, text: string, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 4 && font.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1);
  return t + '…';
}

export async function buildInvoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit as any);
  const regular = await pdf.embedFont(b64ToBytes(OPENRUNDE_REGULAR_B64), { subset: true });
  const bold = await pdf.embedFont(b64ToBytes(OPENRUNDE_BOLD_B64), { subset: true });
  const quad = await pdf.embedFont(b64ToBytes(QUADRANT_B64), { subset: true });
  const sticker = await pdf.embedPng(b64ToBytes(STICKER_PNG_B64));

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 64;

  // Title + logo
  page.drawText('Invoice', { x: M, y, size: 26, font: bold, color: INK });
  // sticker is 621x149 → 96x23
  page.drawImage(sticker, { x: RIGHT - 96, y: y - 18, width: 96, height: 23 });
  y -= 40;

  // Meta rows: label (muted) + value (bold)
  const metaRow = (label: string, value: string) => {
    page.drawText(label, { x: M, y, size: 10, font: regular, color: MUTED });
    page.drawText(value, { x: M + 108, y, size: 10, font: bold, color: INK });
    y -= 17;
  };
  metaRow('Invoice number', d.number.length > 28 ? d.number.slice(0, 28) + '…' : d.number);
  metaRow('Date of issue', fmtDate(d.dateISO));
  metaRow('Date due', fmtDate(d.dateISO));
  if (d.paymentId) metaRow('Payment ID', d.paymentId);
  if (d.subscriptionId) metaRow('Subscription', d.subscriptionId);
  if (d.orderId) metaRow('Order ID', d.orderId);
  y -= 14;

  // From / Bill to
  page.drawText('Materio', { x: M, y, size: 11, font: bold, color: INK });
  page.drawText('Bill to', { x: M + 260, y, size: 11, font: bold, color: INK });
  y -= 16;
  page.drawText('support@getmaterio.app', { x: M, y, size: 10, font: regular, color: INK });
  if (d.billedToEmail) {
    const mail = d.billedToEmail.length > 40 ? d.billedToEmail.slice(0, 40) + '…' : d.billedToEmail;
    page.drawText(mail, { x: M + 260, y, size: 10, font: regular, color: INK });
  }
  y -= 34;

  // Due headline + handwritten thanks
  page.drawText(`${fmtRs(d.amountPaise)} due ${fmtDate(d.dateISO)}`, { x: M, y, size: 17, font: bold, color: INK });
  y -= 24;
  page.drawText(`Thanks for subscribing to ${d.planShort}!`, { x: M, y, size: 14, font: quad, color: ACCENT });
  y -= 30;

  // Table header: Description | Period | Qty | Unit price | Amount.
  // Numeric columns get 65pt+ clearance (a ₹349.00 value is ~55pt wide).
  const periodX = M + 202;
  const qtyEnd = M + 362;
  const unitEnd = M + 432;
  const amtEnd = RIGHT;
  const descMax = periodX - M - 12;
  page.drawText('Description', { x: M, y, size: 9, font: regular, color: MUTED });
  page.drawText('Period', { x: periodX, y, size: 9, font: regular, color: MUTED });
  right(page, regular, 9, 'Qty', qtyEnd, y, MUTED);
  right(page, regular, 9, 'Unit price', unitEnd, y, MUTED);
  right(page, regular, 9, 'Amount', amtEnd, y, MUTED);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: 1.2, color: DARKLINE });
  y -= 20;

  const periodShort =
    d.periodLabel.length > 32 ? d.periodLabel.slice(0, 32) + '…' : d.periodLabel;

  if (d.isGift) {
    // Gift receipt: full price, then Gift Code deduction, totals 0.
    const unit = d.unitPaise ?? d.amountPaise;
    page.drawText(fit(regular, 10, d.planLabel, descMax), { x: M, y, size: 10, font: regular, color: INK });
    page.drawText(fit(regular, 10, periodShort, 120), { x: periodX, y, size: 10, font: regular, color: INK });
    right(page, regular, 10, '1', qtyEnd, y);
    right(page, regular, 10, fmtRs(unit), unitEnd, y);
    right(page, regular, 10, fmtRs(unit), amtEnd, y);
    y -= 20;
    page.drawText('Gift Code', { x: M, y, size: 10, font: regular, color: INK });
    right(page, regular, 10, '1', qtyEnd, y);
    right(page, regular, 10, '-' + fmtRs(unit), unitEnd, y);
    right(page, regular, 10, '-' + fmtRs(unit), amtEnd, y);
    y -= 26;
  } else {
    // Line item: title + period in its own column.
    page.drawText(fit(regular, 10, d.planLabel, descMax), { x: M, y, size: 10, font: regular, color: INK });
    page.drawText(fit(regular, 10, periodShort, 150), { x: periodX, y, size: 10, font: regular, color: INK });
    right(page, regular, 10, '1', qtyEnd, y);
    right(page, regular, 10, fmtRs(d.amountPaise), unitEnd, y);
    right(page, regular, 10, fmtRs(d.amountPaise), amtEnd, y);
    y -= 26;
  }

  // Totals (right block)
  const totX = M + 260;
  const totRow = (label: string, value: string, boldRow: boolean) => {
    const f = boldRow ? bold : regular;
    page.drawText(label, { x: totX, y, size: 10, font: f, color: INK });
    right(page, f, 10, value, amtEnd, y);
    y -= 17;
  };
  totRow('Subtotal', fmtRs(d.amountPaise), false);
  totRow('Total', fmtRs(d.amountPaise), false);
  totRow('Amount due', fmtRs(d.amountPaise), true);
  y -= 30;

  // Footer
  page.drawText('support@getmaterio.app · getmaterio.app', { x: M, y, size: 9, font: regular, color: FAINT });
  y -= 14;
  page.drawText('This is a computer-generated receipt and needs no signature.', { x: M, y, size: 9, font: regular, color: FAINT });

  return await pdf.save({ useObjectStreams: false });
}
