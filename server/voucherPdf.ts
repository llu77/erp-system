/**
 * توليد السندات على الخادم (PDF / HTML) من القالب الموحد shared/voucherTemplate.ts
 * - الشعار والتوقيعات والختم والخط تُضمَّن كـ data URI مقروءة من client/public
 *   (أو dist/public في الإنتاج) حتى يعمل PDF بدون اتصال بالشبكة
 * - إذا لم يوجد ملف صورة يُتجاهل بهدوء ولا يفشل التوليد
 */

import fs from 'node:fs';
import path from 'node:path';
import { COMPANY_INFO, SIGNATURES } from '../shared/branding';
import { renderVoucherHtml, type VoucherTemplateAssets, type VoucherTemplateData } from '../shared/voucherTemplate';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const FONT_PATH = '/fonts/NotoSansArabic-Regular.ttf';

/** مجلدات محتملة للملفات العامة (تطوير / إنتاج) */
function publicDirCandidates(): string[] {
  const here = typeof import.meta !== 'undefined' && import.meta.dirname ? import.meta.dirname : process.cwd();
  return Array.from(new Set([
    path.resolve(process.cwd(), 'client', 'public'),
    path.resolve(process.cwd(), 'dist', 'public'),
    path.resolve(here, 'public'),
    path.resolve(here, '..', 'client', 'public'),
    path.resolve(here, '..', '..', 'client', 'public'),
    path.resolve(here, '..', 'dist', 'public'),
  ]));
}

/** قراءة ملف عام كـ data URI (أو undefined إن لم يوجد) */
export function readPublicAssetAsDataUri(assetPath: string, dirs: string[] = publicDirCandidates()): string | undefined {
  const relative = assetPath.replace(/^\/+/, '');
  if (!relative || relative.includes('..')) return undefined;
  const mime = MIME_BY_EXT[path.extname(relative).toLowerCase()];
  if (!mime) return undefined;
  for (const dir of dirs) {
    const full = path.join(dir, relative);
    try {
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        return `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
      }
    } catch {
      // نتجاهل أخطاء القراءة ونجرب المجلد التالي
    }
  }
  return undefined;
}

let cachedAssets: VoucherTemplateAssets | null = null;

/**
 * صور السند كـ data URIs (مع تخزين مؤقت)
 * الصور غير الموجودة تُستبدل بصورة شفافة صغيرة حتى لا تظهر أيقونة صورة مكسورة
 */
export function loadVoucherAssets(options: { includeFont?: boolean; refresh?: boolean } = {}): VoucherTemplateAssets {
  if (!cachedAssets || options.refresh) {
    const blank = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const read = (p: string) => readPublicAssetAsDataUri(p);
    const missing: string[] = [];
    const pick = (p: string) => {
      const uri = read(p);
      if (!uri) missing.push(p);
      return uri ?? blank;
    };
    cachedAssets = {
      logo: pick(COMPANY_INFO.logo),
      supervisorSignature: pick(SIGNATURES.supervisor.image),
      managerSignature: pick(SIGNATURES.manager.image),
      stamp: pick(SIGNATURES.stamp.image),
      font: read(FONT_PATH),
    };
    if (missing.length > 0) {
      console.warn('[Vouchers] ملفات صور غير موجودة، سيُطبع السند بدونها:', missing.join(', '));
    }
  }
  const { font, ...images } = cachedAssets;
  return options.includeFont === false ? images : { ...images, font };
}

/** HTML السند الكامل بصور مضمّنة (للـ PDF والمرفقات) */
export function renderVoucherHtmlEmbedded(voucher: VoucherTemplateData, options: { includeFont?: boolean } = {}): string {
  return renderVoucherHtml(voucher, { assets: loadVoucherAssets({ includeFont: options.includeFont }) });
}

/** توليد PDF للسند عبر puppeteer */
export async function generateVoucherPDF(voucher: VoucherTemplateData): Promise<Buffer> {
  const html = renderVoucherHtmlEmbedded(voucher);
  const { default: puppeteer } = await import('puppeteer');
  // نفس متصفح باقي تقارير PDF، مع الرجوع لمتصفح puppeteer المثبت إن لم يوجد
  const systemChromium = '/usr/bin/chromium-browser';
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || (fs.existsSync(systemChromium) ? systemChromium : undefined),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(async () => {
      const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
      if (fonts) await fonts.ready;
    });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** اسم ملف السند */
export function voucherFileName(voucher: Pick<VoucherTemplateData, 'voucherId' | 'voucherType'>, ext: 'pdf' | 'html'): string {
  const kind = voucher.voucherType === 'payment' ? 'payment-voucher' : 'receipt-voucher';
  const safeId = String(voucher.voucherId).replace(/[^A-Za-z0-9_-]/g, '_');
  return `${kind}-${safeId}.${ext}`;
}
