/**
 * توليد السندات على الخادم (PDF / HTML) من القالب الموحد shared/voucherTemplate.ts
 * - الشعار والتوقيعات والختم والخط تُضمَّن كـ data URI مقروءة من client/public
 *   (أو dist/public في الإنتاج) حتى يعمل PDF بدون اتصال بالشبكة
 * - إذا لم يوجد ملف صورة يُتجاهل بهدوء ولا يفشل التوليد
 */

import fs from 'node:fs';
import path from 'node:path';
import { GROUP_ESTABLISHMENT, SIGNATURES, getEstablishmentForBranch, type Establishment } from '../shared/branding';
import { PRINT_FONT_PATH, renderVoucherHtml, type VoucherTemplateAssets, type VoucherTemplateData } from '../shared/voucherTemplate';

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

const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** ذاكرة مؤقتة لكل ملف عام (data URI أو null إن لم يوجد) */
const assetCache = new Map<string, string | null>();
const warnedMissing = new Set<string>();

function cachedAsset(assetPath: string, refresh: boolean): string | undefined {
  if (refresh || !assetCache.has(assetPath)) {
    assetCache.set(assetPath, readPublicAssetAsDataUri(assetPath) ?? null);
  }
  return assetCache.get(assetPath) ?? undefined;
}

/**
 * صور المستند كـ data URIs حسب مؤسسته (الشعار والختم)، مع تخزين مؤقت لكل ملف
 * - مؤسسة بدون شعار: logo = '' (ترويسة نصية بدون صورة)
 * - الصور غير الموجودة تُستبدل بصورة شفافة صغيرة حتى لا تظهر أيقونة صورة مكسورة
 */
export function loadVoucherAssets(
  options: { includeFont?: boolean; refresh?: boolean; establishment?: Pick<Establishment, 'logo' | 'stamp'> | null } = {}
): VoucherTemplateAssets {
  const refresh = options.refresh === true;
  const establishment = options.establishment ?? GROUP_ESTABLISHMENT;
  const missing: string[] = [];
  const pick = (p: string) => {
    const uri = cachedAsset(p, refresh);
    if (!uri) missing.push(p);
    return uri ?? BLANK_IMAGE;
  };
  const images: VoucherTemplateAssets = {
    logo: establishment.logo ? pick(establishment.logo) : '',
    supervisorSignature: pick(SIGNATURES.supervisor.image),
    managerSignature: pick(SIGNATURES.manager.image),
    stamp: pick(establishment.stamp || SIGNATURES.stamp.image),
  };
  const newlyMissing = missing.filter(p => !warnedMissing.has(p));
  if (newlyMissing.length > 0) {
    newlyMissing.forEach(p => warnedMissing.add(p));
    console.warn('[Documents] ملفات صور غير موجودة، سيُطبع المستند بدونها:', newlyMissing.join(', '));
  }
  if (options.includeFont === false) return images;
  return { ...images, font: cachedAsset(PRINT_FONT_PATH, refresh) };
}

/** صور مستند فرع معيّن (شعار وختم مؤسسة الفرع) */
export function loadDocumentAssetsForBranch(
  branchName: string | null | undefined,
  options: { includeFont?: boolean } = {}
): VoucherTemplateAssets {
  return loadVoucherAssets({ ...options, establishment: getEstablishmentForBranch(branchName) });
}

/** HTML السند الكامل بصور مضمّنة (للـ PDF والمرفقات) */
export function renderVoucherHtmlEmbedded(voucher: VoucherTemplateData, options: { includeFont?: boolean } = {}): string {
  return renderVoucherHtml(voucher, { assets: loadDocumentAssetsForBranch(voucher.branchName, options) });
}

/** توليد PDF للسند عبر puppeteer */
export async function generateVoucherPDF(voucher: VoucherTemplateData): Promise<Buffer> {
  return renderHtmlToPdf(renderVoucherHtmlEmbedded(voucher));
}

/**
 * تحويل صفحة HTML مستقلة (صور وخطوط مضمّنة) إلى PDF عبر puppeteer
 * - حجم الصفحة وهوامشها من @page في القالب (preferCSSPageSize)
 * - ينتظر تحميل الخطوط حتى لا يُطبع النص العربي بخط بديل
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
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
