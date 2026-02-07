/**
 * ThermalReceiptPrinter - مكون طباعة الفواتير الحرارية المتقدم
 * 
 * المميزات:
 * - تصميم احترافي أبيض وأسود متقدم
 * - دعم طابعات 80mm و 58mm
 * - إظهار الشعار والخدمات والأسعار بوضوح
 * - QR Code للتحقق
 * - دعم RTL للعربية
 * - طباعة تلقائية
 * - إعدادات قابلة للتخصيص
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

export interface ReceiptItem {
  serviceName: string;
  serviceNameAr: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  invoiceNumber: string;
  branchName: string;
  branchPhone?: string;
  employeeName: string;
  date: Date;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount: number;
  discountReason?: string;
  total: number;
  paymentMethod: 'cash' | 'card' | 'split' | 'loyalty';
  cashAmount?: number;
  cardAmount?: number;
  loyaltyCustomer?: {
    name: string;
    phone: string;
  };
  notes?: string;
}

export interface PrinterSettings {
  autoPrint: boolean;
  showQRCode: boolean;
  paperWidth: '58mm' | '80mm';
  fontSize: 'small' | 'medium' | 'large';
  showLogo: boolean;
  showBranchPhone: boolean;
  showEmployeeName: boolean;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  headerMessage?: string;
  footerMessage: string;
  welcomeMessage: string;
  logoUrl?: string | null;
  printCopies: number;
}

export const DEFAULT_SETTINGS: PrinterSettings = {
  autoPrint: true,
  showQRCode: true,
  paperWidth: '80mm',
  fontSize: 'medium',
  showLogo: true,
  showBranchPhone: true,
  showEmployeeName: true,
  storeName: 'Symbol AI',
  storePhone: '',
  storeAddress: '',
  headerMessage: '',
  footerMessage: 'شكراً لزيارتكم ❤',
  welcomeMessage: 'نتشرف بخدمتكم دائماً',
  logoUrl: null,
  printCopies: 1,
};

// ============================================
// Helper Functions
// ============================================

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-GB', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

const getPaymentMethodAr = (method: string): string => {
  const methods: Record<string, string> = {
    cash: 'نقدي (كاش)',
    card: 'شبكة (Card)',
    split: 'تقسيم (كاش + شبكة)',
    loyalty: 'برنامج الولاء',
  };
  return methods[method] || method;
};

const generateQRCodeUrl = (data: object): string => {
  const jsonData = JSON.stringify(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(jsonData)}&bgcolor=ffffff&color=000000`;
};

// ============================================
// Generate Receipt HTML - تصميم احترافي متقدم
// ============================================

const generateReceiptHTML = (
  data: ReceiptData, 
  settings: PrinterSettings = DEFAULT_SETTINGS
): string => {
  const dateStr = formatDate(data.date);
  const timeStr = formatTime(data.date);
  
  const qrData = {
    inv: data.invoiceNumber,
    total: data.total,
    date: dateStr,
    branch: data.branchName,
  };
  const qrCodeUrl = generateQRCodeUrl(qrData);
  
  const paperWidth = settings.paperWidth === '58mm' ? '58mm' : '80mm';
  const contentWidth = settings.paperWidth === '58mm' ? '54mm' : '76mm';
  
  // أحجام الخطوط حسب الإعداد
  const fontSizes = {
    small: { base: '9px', title: '14px', total: '16px', header: '11px' },
    medium: { base: '10px', title: '16px', total: '18px', header: '12px' },
    large: { base: '11px', title: '18px', total: '20px', header: '13px' },
  };
  const fonts = fontSizes[settings.fontSize];
  
  // الشعار - إما URL مخصص أو شعار افتراضي
  const logoHTML = settings.showLogo ? (
    settings.logoUrl 
      ? `<img src="${settings.logoUrl}" alt="Logo" class="logo-img" />`
      : `<div class="logo-default">
           <svg viewBox="0 0 100 100" width="50" height="50">
             <circle cx="50" cy="50" r="45" fill="none" stroke="#000" stroke-width="4"/>
             <circle cx="50" cy="50" r="35" fill="none" stroke="#000" stroke-width="2"/>
             <text x="50" y="58" text-anchor="middle" font-size="24" font-weight="bold" fill="#000">S</text>
           </svg>
         </div>`
  ) : '';
  
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>فاتورة - ${data.invoiceNumber}</title>
      <style>
        /* ═══════════════════════════════════════════════════════════════
           إعدادات الطباعة الحرارية
           ═══════════════════════════════════════════════════════════════ */
        @page {
          size: ${paperWidth} auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: ${paperWidth};
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
        }
        
        /* ═══════════════════════════════════════════════════════════════
           الأساسيات
           ═══════════════════════════════════════════════════════════════ */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', 'Lucida Console', 'Monaco', monospace;
          width: ${paperWidth};
          max-width: ${paperWidth};
          margin: 0 auto;
          padding: 2mm;
          font-size: ${fonts.base};
          line-height: 1.5;
          direction: rtl;
          background: #fff;
          color: #000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt {
          width: ${contentWidth};
          margin: 0 auto;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           الهيدر والشعار - تصميم احترافي
           ═══════════════════════════════════════════════════════════════ */
        .header {
          text-align: center;
          padding-bottom: 4px;
          border-bottom: 2px solid #000;
          margin-bottom: 4px;
        }
        .logo-img {
          width: 40px;
          height: 40px;
          margin: 0 auto 3px;
          display: block;
          object-fit: contain;
        }
        .logo-default {
          margin: 0 auto 3px;
          display: flex;
          justify-content: center;
        }
        .store-name {
          font-size: ${fonts.header};
          font-weight: bold;
          margin-bottom: 2px;
          letter-spacing: 1px;
        }
        .branch-name {
          font-size: ${fonts.base};
          font-weight: bold;
          margin-bottom: 2px;
          padding: 2px 6px;
          background: #000;
          color: #fff;
          display: inline-block;
        }
        .branch-phone {
          font-size: ${fonts.base};
          margin-bottom: 6px;
        }
        .store-address {
          font-size: 9px;
          color: #333;
          margin-bottom: 6px;
        }
        .header-message {
          font-size: 9px;
          font-style: italic;
          margin-bottom: 6px;
        }
        .invoice-box {
          margin-top: 3px;
          padding: 2px 8px;
          border: 1px solid #000;
          display: inline-block;
        }
        .invoice-label {
          font-size: 9px;
          margin-bottom: 2px;
        }
        .invoice-number {
          font-size: 14px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           معلومات الفاتورة
           ═══════════════════════════════════════════════════════════════ */
        .info-section {
          padding: 3px 0;
          border-bottom: 1px dashed #000;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          font-size: ${fonts.base};
        }
        .info-item.full {
          grid-column: 1 / -1;
        }
        .info-label {
          font-weight: bold;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           جدول الخدمات - تصميم واضح ومحترف
           ═══════════════════════════════════════════════════════════════ */
        .services-section {
          padding: 3px 0;
          border-bottom: 1px solid #000;
        }
        .services-title {
          text-align: center;
          font-weight: bold;
          font-size: ${fonts.base};
          margin-bottom: 3px;
          padding: 2px;
          border-bottom: 1px dashed #000;
        }
        .services-header {
          display: flex;
          font-weight: bold;
          font-size: 9px;
          background: #000;
          color: #fff;
          padding: 3px 4px;
          margin-bottom: 3px;
        }
        .services-header .col-name { flex: 1; text-align: right; }
        .services-header .col-qty { width: 30px; text-align: center; }
        .services-header .col-price { width: 45px; text-align: center; }
        .services-header .col-total { width: 55px; text-align: left; }
        
        .service-item {
          display: flex;
          align-items: center;
          padding: 2px 2px;
          border-bottom: 1px dotted #ccc;
          font-size: ${fonts.base};
        }
        .service-item:last-child {
          border-bottom: none;
        }
        .service-item:nth-child(even) {
          background: #fafafa;
        }
        .service-name {
          flex: 1;
          text-align: right;
          font-weight: 500;
          padding-left: 4px;
        }
        .service-qty {
          width: 25px;
          text-align: center;
          font-weight: bold;
          margin: 0 2px;
        }
        .service-price {
          width: 45px;
          text-align: center;
          font-size: 9px;
          color: #555;
        }
        .service-total {
          width: 55px;
          text-align: left;
          font-weight: bold;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           المجاميع - تصميم بارز
           ═══════════════════════════════════════════════════════════════ */
        .totals-section {
          padding: 3px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          font-size: ${fonts.base};
        }
        .total-row.subtotal {
          border-bottom: 1px dashed #999;
          padding-bottom: 3px;
          margin-bottom: 2px;
        }
        .total-row.discount {
          color: #000;
          font-style: italic;
        }
        .total-row.discount .amount {
          font-weight: bold;
        }
        .total-row.grand-total {
          font-size: ${fonts.header};
          font-weight: bold;
          border: 2px solid #000;
          padding: 4px;
          margin-top: 3px;
        }
        .total-row.grand-total .currency {
          font-size: 12px;
          vertical-align: middle;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           طريقة الدفع
           ═══════════════════════════════════════════════════════════════ */
        .payment-section {
          text-align: center;
          margin: 3px 0;
          padding: 4px;
          border: 1px solid #000;
        }
        .payment-title {
          font-size: 9px;
          margin-bottom: 4px;
        }
        .payment-method {
          font-size: ${fonts.header};
          font-weight: bold;
        }
        .payment-details {
          font-size: 9px;
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px dashed #999;
        }
        .payment-split {
          display: flex;
          justify-content: center;
          gap: 15px;
        }
        .payment-split-item {
          text-align: center;
        }
        .payment-split-label {
          font-size: 8px;
          color: #666;
        }
        .payment-split-amount {
          font-weight: bold;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           عميل الولاء
           ═══════════════════════════════════════════════════════════════ */
        .loyalty-section {
          text-align: center;
          margin: 3px 0;
          padding: 3px;
          border: 1px dashed #000;
        }
        .loyalty-icon {
          display: none;
        }
        .loyalty-title {
          font-weight: bold;
          font-size: ${fonts.base};
          margin-bottom: 4px;
        }
        .loyalty-info {
          font-size: 9px;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           الملاحظات
           ═══════════════════════════════════════════════════════════════ */
        .notes-section {
          margin: 3px 0;
          padding: 3px;
          border: 1px dashed #000;
        }
        .notes-title {
          font-weight: bold;
          font-size: 9px;
          margin-bottom: 4px;
        }
        .notes-content {
          font-size: 9px;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           QR Code
           ═══════════════════════════════════════════════════════════════ */
        .qr-section {
          text-align: center;
          padding: 3px 0;
          border-top: 1px dashed #000;
          margin-top: 3px;
        }
        .qr-code {
          width: 60px;
          height: 60px;
          margin: 3px auto;
          border: 1px solid #000;
          padding: 2px;
          background: #fff;
        }
        .qr-text {
          font-size: 8px;
          color: #666;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           الفوتر
           ═══════════════════════════════════════════════════════════════ */
        .footer {
          text-align: center;
          padding-top: 4px;
          border-top: 1px solid #000;
        }
        .footer-message {
          font-size: 10px;
          font-weight: bold;
          margin-bottom: 2px;
        }
        .footer-welcome {
          font-size: 9px;
          margin: 2px 0;
          font-style: italic;
        }
        .footer-separator {
          display: none;
        }
        .footer-brand {
          font-size: 7px;
          color: #999;
          margin-top: 2px;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           أزرار التحكم (لا تظهر في الطباعة)
           ═══════════════════════════════════════════════════════════════ */
        .print-controls {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 15px;
          z-index: 1000;
          background: #fff;
          padding: 15px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        }
        .print-btn {
          padding: 14px 28px;
          font-size: 14px;
          font-weight: bold;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .print-btn:hover {
          transform: scale(1.05);
        }
        .print-btn.primary {
          background: #000;
          color: #fff;
        }
        .print-btn.secondary {
          background: #f0f0f0;
          color: #000;
          border: 2px solid #000;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <!-- ═══════════════════════════════════════════════════════════════
             الهيدر مع الشعار
             ═══════════════════════════════════════════════════════════════ -->
        <div class="header">
          ${logoHTML}
          <div class="store-name">${settings.storeName || 'Symbol AI'}</div>
          <div class="branch-name">${data.branchName}</div>
          ${settings.showBranchPhone && (data.branchPhone || settings.storePhone) ? 
            `<div class="branch-phone">📞 ${data.branchPhone || settings.storePhone}</div>` : ''}
          ${settings.storeAddress ? `<div class="store-address">📍 ${settings.storeAddress}</div>` : ''}
          ${settings.headerMessage ? `<div class="header-message">${settings.headerMessage}</div>` : ''}
          <div class="invoice-box">
            <div class="invoice-label">رقم الفاتورة</div>
            <div class="invoice-number">${data.invoiceNumber}</div>
          </div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             معلومات الفاتورة
             ═══════════════════════════════════════════════════════════════ -->
        <div class="info-section">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">التاريخ:</span>
              <span>${dateStr}</span>
            </div>
            <div class="info-item">
              <span class="info-label">الوقت:</span>
              <span>${timeStr}</span>
            </div>
            ${settings.showEmployeeName ? `
              <div class="info-item full">
                <span class="info-label">الموظف:</span>
                <span>${data.employeeName}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             جدول الخدمات
             ═══════════════════════════════════════════════════════════════ -->
        <div class="services-section">
          <div class="services-title">═══ الخدمات ═══</div>
          <div class="services-header">
            <span class="col-name">الخدمة</span>
            <span class="col-qty">الكمية</span>
            <span class="col-price">السعر</span>
            <span class="col-total">المجموع</span>
          </div>
          ${data.items.map((item, index) => `
            <div class="service-item" style="${index % 2 === 1 ? 'background: #fafafa;' : ''}">
              <span class="service-name">${item.serviceNameAr || item.serviceName}</span>
              <span class="service-qty">${item.quantity}</span>
              <span class="service-price">${item.price.toFixed(0)}</span>
              <span class="service-total">${item.total.toFixed(0)} ر.س</span>
            </div>
          `).join('')}
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             المجاميع
             ═══════════════════════════════════════════════════════════════ -->
        <div class="totals-section">
          <div class="total-row subtotal">
            <span>المجموع الفرعي:</span>
            <span>${data.subtotal.toFixed(2)} ر.س</span>
          </div>
          ${data.discountAmount > 0 ? `
            <div class="total-row discount">
              <span>الخصم${data.loyaltyCustomer ? ' (برنامج الولاء)' : ''}:</span>
              <span class="amount">- ${data.discountAmount.toFixed(2)} ر.س</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>الإجمالي المستحق:</span>
            <span>${data.total.toFixed(2)} <span class="currency">ر.س</span></span>
          </div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             طريقة الدفع
             ═══════════════════════════════════════════════════════════════ -->
        <div class="payment-section">
          <div class="payment-title">طريقة الدفع</div>
          <div class="payment-method">${getPaymentMethodAr(data.paymentMethod)}</div>
          ${data.paymentMethod === 'split' && data.cashAmount !== undefined && data.cardAmount !== undefined ? `
            <div class="payment-details">
              <div class="payment-split">
                <div class="payment-split-item">
                  <div class="payment-split-label">نقدي</div>
                  <div class="payment-split-amount">${data.cashAmount.toFixed(2)} ر.س</div>
                </div>
                <div class="payment-split-item">
                  <div class="payment-split-label">شبكة</div>
                  <div class="payment-split-amount">${data.cardAmount.toFixed(2)} ر.س</div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             عميل الولاء
             ═══════════════════════════════════════════════════════════════ -->
        ${data.loyaltyCustomer ? `
          <div class="loyalty-section">
            <div class="loyalty-icon">🎁</div>
            <div class="loyalty-title">عميل برنامج الولاء</div>
            <div class="loyalty-info">
              <div>${data.loyaltyCustomer.name}</div>
              <div>📱 ${data.loyaltyCustomer.phone}</div>
            </div>
          </div>
        ` : ''}
        
        <!-- ═══════════════════════════════════════════════════════════════
             الملاحظات
             ═══════════════════════════════════════════════════════════════ -->
        ${data.notes ? `
          <div class="notes-section">
            <div class="notes-title">📝 ملاحظات:</div>
            <div class="notes-content">${data.notes}</div>
          </div>
        ` : ''}
        
        <!-- ═══════════════════════════════════════════════════════════════
             QR Code للتحقق
             ═══════════════════════════════════════════════════════════════ -->
        ${settings.showQRCode ? `
          <div class="qr-section">
            <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />
            <div class="qr-text">امسح للتحقق من الفاتورة</div>
          </div>
        ` : ''}
        
        <!-- ═══════════════════════════════════════════════════════════════
             الفوتر
             ═══════════════════════════════════════════════════════════════ -->
        <div class="footer">
          <div class="footer-message">${settings.footerMessage}</div>
          <div class="footer-brand">Powered by Symbol AI</div>
        </div>
      </div>
      
      <!-- ═══════════════════════════════════════════════════════════════
           أزرار التحكم (لا تظهر في الطباعة)
           ═══════════════════════════════════════════════════════════════ -->
      <div class="print-controls no-print">
        <button class="print-btn primary" onclick="window.print();">🖨️ طباعة</button>
        <button class="print-btn secondary" onclick="window.close();">✕ إغلاق</button>
      </div>
      
      <script>
        // الطباعة التلقائية بعد تحميل الصفحة
        window.onload = function() {
          ${settings.autoPrint ? `
            setTimeout(function() {
              window.print();
            }, 600);
          ` : ''}
        };
        
        // إغلاق النافذة بعد الطباعة
        window.onafterprint = function() {
          setTimeout(function() {
            window.close();
          }, 200);
        };
      </script>
    </body>
    </html>
  `;
};

// ============================================
// Custom Hook for Thermal Printing
// ============================================

export function useThermalPrinter(settings: PrinterSettings = DEFAULT_SETTINGS) {
  const printWindowRef = useRef<Window | null>(null);
  
  const printReceipt = useCallback((data: ReceiptData) => {
    const receiptHTML = generateReceiptHTML(data, settings);
    
    // Close any existing print window
    if (printWindowRef.current && !printWindowRef.current.closed) {
      printWindowRef.current.close();
    }
    
    // Open new print window
    const windowWidth = settings.paperWidth === '58mm' ? 280 : 340;
    const printWindow = window.open(
      '', 
      '_blank', 
      `width=${windowWidth},height=800,scrollbars=yes,resizable=yes`
    );
    
    if (printWindow) {
      printWindowRef.current = printWindow;
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      toast.success('تم فتح نافذة الطباعة');
      return true;
    } else {
      toast.error('فشل فتح نافذة الطباعة - تأكد من السماح بالنوافذ المنبثقة');
      return false;
    }
  }, [settings]);
  
  const closePrintWindow = useCallback(() => {
    if (printWindowRef.current && !printWindowRef.current.closed) {
      printWindowRef.current.close();
    }
  }, []);
  
  return {
    printReceipt,
    closePrintWindow,
  };
}

// ============================================
// Exports
// ============================================

export { generateReceiptHTML };
