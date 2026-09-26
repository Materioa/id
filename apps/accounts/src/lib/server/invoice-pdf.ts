import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from 'fontkit';
import { OPENRUNDE_REGULAR_B64, OPENRUNDE_BOLD_B64, QUADRANT_B64, STICKER_PNG_B64 } from './assets/invoice-assets';

/**
 * Materio-branded invoice PDF (no provider chrome involved).
 * OpenRunde for type, Quadrant for the handwritten accent, sticker logo,
 * real ₹ amounts. Fonts are subset-embedded TTFs converted once from the
 * brand WOFFs (pdf-lib + fontkit handle them; jsPDF cannot).
 */

export interface InvoicePdfData {
  number: string;
  dateISO: string | null;
  status: string;
  billedToName: string;
  billedToEmail: string;
  billedToUsername: string;
  planLabel: string;
  periodLabel: string;
  amountPaise: number;
}

const INK = rgb(0.102, 0.09, 0.082); // cream-dark
const MUTED = rgb(0.45, 0.45, 0.45);
const ACCENT = rgb(0.922, 0.369, 0.157); // #EB5E28
const HAIRLINE = rgb(0.898, 0.898, 0.898);
const CREAM = rgb(0.98, 0.976, 0.961); // #FAF9F5
const GREEN = rgb(0.082, 0.502, 0.239);

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
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtRs(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAGE_W = 595;
const PAGE_H = 842;
const M = 56;

function right(page: PDFPage, font: PDFFont, size: number, text: string, y: number, color = INK) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: PAGE_W - M - w, y, size, font, color });
}

export async function buildInvoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit as any);
  const regular = await pdf.embedFont(b64ToBytes(OPENRUNDE_REGULAR_B64), { subset: true });
  const bold = await pdf.embedFont(b64ToBytes(OPENRUNDE_BOLD_B64), { subset: true });
  const quad = await pdf.embedFont(b64ToBytes(QUADRANT_B64), { subset: true });
  const sticker = await pdf.embedPng(b64ToBytes(STICKER_PNG_B64));

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  // Cream header band
  page.drawRectangle({ x: 0, y: PAGE_H - 170, width: PAGE_W, height: 170, color: CREAM });

  // Sticker logo (621x149 → 124x30)
  page.drawImage(sticker, { x: M, y: PAGE_H - 108, width: 124, height: 30 });

  // INVOICE title, right aligned
  page.drawText('INVOICE', {
    x: PAGE_W - M - bold.widthOfTextAtSize('INVOICE', 20),
    y: PAGE_H - 100,
    size: 20,
    font: bold,
    color: INK
  });

  // Orange rule
  page.drawLine({
    start: { x: M, y: PAGE_H - 128 },
    end: { x: PAGE_W - M, y: PAGE_H - 128 },
    thickness: 2.5,
    color: ACCENT
  });

  let y = PAGE_H - 170;

  // Meta row
  const meta = (
    label: string,
    value: string,
    x: number,
    valueColor = INK,
    valueFont: PDFFont = bold
  ) => {
    page.drawText(label, { x, y, size: 9, font: regular, color: MUTED });
    page.drawText(value, { x, y: y - 16, size: 11, font: valueFont, color: valueColor });
  };
  meta('Invoice no.', d.number.length > 24 ? d.number.slice(0, 24) + '…' : d.number, M);
  meta('Date', fmtDate(d.dateISO), M + 200);
  const paidish = /^(paid|success|succeeded)$/i.test(d.status);
  meta(
    'Status',
    d.status ? d.status.replace(/_/g, ' ').toUpperCase() : 'RECORDED',
    M + 380,
    paidish ? GREEN : INK
  );
  y -= 44;

  // Billed to
  page.drawText('Billed to', { x: M, y, size: 9, font: regular, color: MUTED });
  y -= 16;
  page.drawText(d.billedToName || d.billedToUsername || 'Materio user', { x: M, y, size: 12, font: bold, color: INK });
  y -= 16;
  page.drawText(d.billedToEmail, { x: M, y, size: 10, font: regular, color: MUTED });
  y -= 15;
  if (d.billedToUsername) {
    page.drawText('@' + d.billedToUsername, { x: M, y, size: 10, font: regular, color: MUTED });
    y -= 15;
  }
  y -= 14;

  // Table header
  page.drawRectangle({ x: M, y: y - 14, width: PAGE_W - M * 2, height: 26, color: CREAM });
  page.drawText('DESCRIPTION', { x: M + 10, y, size: 9, font: bold, color: MUTED });
  page.drawText('PERIOD', { x: M + 300, y, size: 9, font: bold, color: MUTED });
  right(page, bold, 9, 'AMOUNT', y, MUTED);
  y -= 32;

  // Line item
  page.drawText(d.planLabel, { x: M + 10, y, size: 11, font: bold, color: INK });
  page.drawText(d.periodLabel, { x: M + 300, y, size: 10, font: regular, color: MUTED });
  right(page, bold, 11, fmtRs(d.amountPaise), y);
  y -= 26;

  // Total
  page.drawLine({ start: { x: M, y }, end: { x: PAGE_W - M, y }, thickness: 1, color: HAIRLINE });
  y -= 22;
  page.drawText('Total', { x: M + 300, y, size: 12, font: bold, color: INK });
  right(page, bold, 12, fmtRs(d.amountPaise), y);
  y -= 56;

  // Handwritten accent
  page.drawText('Thanks for learning with us!', { x: M, y, size: 17, font: quad, color: ACCENT });
  y -= 30;

  // Footer
  page.drawText('Thank you for supporting Materio.', { x: M, y, size: 9, font: regular, color: MUTED });
  y -= 14;
  page.drawText('support@getmaterio.app · getmaterio.app', { x: M, y, size: 9, font: regular, color: MUTED });
  y -= 14;
  page.drawText('This is a computer-generated receipt and needs no signature.', { x: M, y, size: 9, font: regular, color: MUTED });

  return await pdf.save({ useObjectStreams: false });
}
