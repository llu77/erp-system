/**
 * ThermalReceiptPrinter - مكون طباعة الفواتير الحرارية
 * 
 * يدعم:
 * - طباعة حرارية مباشرة (80mm)
 * - طباعة تلقائية بعد إنشاء الفاتورة
 * - QR Code للتحقق
 * - دعم RTL للعربية
 * - تصميم احترافي أبيض وأسود
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

// Types
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
  customMessage?: string;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  autoPrint: true,
  showQRCode: true,
  paperWidth: '80mm',
  fontSize: 'medium',
  showLogo: true,
  customMessage: 'شكراً لزيارتكم ❤',
};

// Helper functions
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
  return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(jsonData)}`;
};

// Generate receipt HTML
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
  const baseFontSize = settings.fontSize === 'small' ? '10px' : settings.fontSize === 'large' ? '13px' : '11px';
  
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>فاتورة - ${data.invoiceNumber}</title>
      <style>
        /* إعدادات الطباعة الحرارية */
        @page {
          size: ${paperWidth} auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: ${paperWidth};
            margin: 0;
            padding: 0;
          }
          .no-print { display: none !important; }
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', 'Lucida Console', monospace;
          width: ${paperWidth};
          max-width: ${paperWidth};
          margin: 0 auto;
          padding: 3mm;
          font-size: ${baseFontSize};
          line-height: 1.4;
          direction: rtl;
          background: #fff;
          color: #000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt {
          width: 100%;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           الهيدر والشعار
           ═══════════════════════════════════════════════════════════════ */
        .header {
          text-align: center;
          padding-bottom: 8px;
          border-bottom: 3px double #000;
          margin-bottom: 8px;
        }
        .logo {
          width: 55px;
          height: 55px;
          margin: 0 auto 6px;
          border: 3px solid #000;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          background: #000;
          color: #fff;
        }
        .header h1 {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 4px;
          letter-spacing: 3px;
        }
        .header .branch {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 3px;
        }
        .header .phone {
          font-size: 11px;
          margin-bottom: 6px;
        }
        .header .invoice-num {
          font-size: 12px;
          font-weight: bold;
          background: #000;
          color: #fff;
          padding: 4px 12px;
          display: inline-block;
          margin-top: 4px;
          letter-spacing: 1px;
          border-radius: 3px;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           قسم المعلومات
           ═══════════════════════════════════════════════════════════════ */
        .info-section {
          padding: 8px 0;
          border-bottom: 1px dashed #000;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
          font-size: 11px;
        }
        .info-row span:first-child {
          font-weight: bold;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           قسم الخدمات
           ═══════════════════════════════════════════════════════════════ */
        .items-section {
          padding: 8px 0;
          border-bottom: 2px solid #000;
        }
        .items-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          font-size: 11px;
          background: #000;
          color: #fff;
          padding: 5px 4px;
          margin-bottom: 6px;
        }
        .item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 6px 0;
          font-size: 11px;
          padding: 3px 0;
          border-bottom: 1px dotted #999;
        }
        .item:last-child {
          border-bottom: none;
        }
        .item-name {
          flex: 1;
          text-align: right;
          font-weight: 500;
          padding-left: 5px;
        }
        .item-qty {
          width: 35px;
          text-align: center;
          font-weight: bold;
          background: #f0f0f0;
          padding: 2px;
          border-radius: 3px;
        }
        .item-price {
          width: 60px;
          text-align: left;
          font-weight: bold;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           قسم المجاميع
           ═══════════════════════════════════════════════════════════════ */
        .totals-section {
          padding: 10px 0;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 5px 0;
          font-size: 12px;
        }
        .total-row.discount {
          color: #000;
          font-style: italic;
        }
        .total-row.grand-total {
          font-size: 18px;
          font-weight: bold;
          border: 3px solid #000;
          padding: 10px 8px;
          margin-top: 8px;
          background: #f5f5f5;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           طريقة الدفع
           ═══════════════════════════════════════════════════════════════ */
        .payment-method {
          text-align: center;
          margin: 10px 0;
          padding: 8px;
          border: 2px solid #000;
          font-size: 13px;
          font-weight: bold;
          background: #f9f9f9;
        }
        .payment-details {
          font-size: 10px;
          margin-top: 4px;
          font-weight: normal;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           عميل الولاء
           ═══════════════════════════════════════════════════════════════ */
        .loyalty-section {
          text-align: center;
          margin: 8px 0;
          padding: 6px;
          border: 2px dashed #000;
          font-size: 11px;
          background: #fffef0;
        }
        .loyalty-section .title {
          font-weight: bold;
          margin-bottom: 3px;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           QR Code
           ═══════════════════════════════════════════════════════════════ */
        .qr-section {
          text-align: center;
          padding: 10px 0;
          border-top: 1px dashed #000;
          margin-top: 8px;
        }
        .qr-section img {
          width: 80px;
          height: 80px;
          margin: 6px auto;
          border: 1px solid #000;
        }
        .qr-section p {
          font-size: 9px;
          color: #666;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           الفوتر
           ═══════════════════════════════════════════════════════════════ */
        .footer {
          text-align: center;
          padding-top: 10px;
          border-top: 3px double #000;
          font-size: 10px;
        }
        .footer .thanks {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 6px;
        }
        .footer .welcome {
          font-size: 12px;
          margin: 4px 0;
          font-style: italic;
        }
        .footer .brand {
          font-size: 9px;
          margin-top: 8px;
          padding-top: 6px;
          border-top: 1px dashed #000;
          color: #666;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           الملاحظات
           ═══════════════════════════════════════════════════════════════ */
        .notes-section {
          margin: 8px 0;
          padding: 6px;
          border: 1px solid #000;
          font-size: 10px;
          background: #fafafa;
        }
        .notes-section .title {
          font-weight: bold;
          margin-bottom: 3px;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           أزرار التحكم (لا تظهر في الطباعة)
           ═══════════════════════════════════════════════════════════════ */
        .print-controls {
          position: fixed;
          bottom: 15px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 12px;
          z-index: 1000;
        }
        .print-btn {
          padding: 14px 28px;
          font-size: 15px;
          font-weight: bold;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
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
        
        /* ═══════════════════════════════════════════════════════════════
           خط فاصل مزخرف
           ═══════════════════════════════════════════════════════════════ */
        .separator {
          text-align: center;
          margin: 8px 0;
          font-size: 10px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <!-- ═══════════════════════════════════════════════════════════════
             Header مع الشعار
             ═══════════════════════════════════════════════════════════════ -->
        <div class="header">
          ${settings.showLogo ? '<div class="logo">✂</div>' : ''}
          <h1>Symbol AI</h1>
          <div class="branch">${data.branchName}</div>
          ${data.branchPhone ? `<div class="phone">هاتف: ${data.branchPhone}</div>` : ''}
          <div class="invoice-num"># ${data.invoiceNumber}</div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             معلومات الفاتورة
             ═══════════════════════════════════════════════════════════════ -->
        <div class="info-section">
          <div class="info-row">
            <span>التاريخ:</span>
            <span>${dateStr}</span>
          </div>
          <div class="info-row">
            <span>الوقت:</span>
            <span>${timeStr}</span>
          </div>
          <div class="info-row">
            <span>الموظف:</span>
            <span>${data.employeeName}</span>
          </div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             الخدمات
             ═══════════════════════════════════════════════════════════════ -->
        <div class="items-section">
          <div class="items-header">
            <span style="flex:1;text-align:right;">الخدمة</span>
            <span style="width:35px;text-align:center;">الكمية</span>
            <span style="width:60px;text-align:left;">السعر</span>
          </div>
          ${data.items.map(item => `
            <div class="item">
              <span class="item-name">${item.serviceNameAr || item.serviceName}</span>
              <span class="item-qty">${item.quantity}</span>
              <span class="item-price">${item.total.toFixed(0)} ر.س</span>
            </div>
          `).join('')}
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             المجاميع
             ═══════════════════════════════════════════════════════════════ -->
        <div class="totals-section">
          <div class="total-row">
            <span>المجموع الفرعي:</span>
            <span>${data.subtotal.toFixed(2)} ر.س</span>
          </div>
          ${data.discountAmount > 0 ? `
            <div class="total-row discount">
              <span>الخصم${data.loyaltyCustomer ? ' (ولاء)' : ''}:</span>
              <span>- ${data.discountAmount.toFixed(2)} ر.س</span>
            </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>الإجمالي:</span>
            <span>${data.total.toFixed(2)} ر.س</span>
          </div>
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             طريقة الدفع
             ═══════════════════════════════════════════════════════════════ -->
        <div class="payment-method">
          طريقة الدفع: ${getPaymentMethodAr(data.paymentMethod)}
          ${data.paymentMethod === 'split' && data.cashAmount && data.cardAmount ? `
            <div class="payment-details">
              كاش: ${data.cashAmount.toFixed(2)} ر.س | شبكة: ${data.cardAmount.toFixed(2)} ر.س
            </div>
          ` : ''}
        </div>
        
        <!-- ═══════════════════════════════════════════════════════════════
             عميل الولاء
             ═══════════════════════════════════════════════════════════════ -->
        ${data.loyaltyCustomer ? `
          <div class="loyalty-section">
            <div class="title">🎁 عميل برنامج الولاء</div>
            <div>${data.loyaltyCustomer.name}</div>
            <div>هاتف: ${data.loyaltyCustomer.phone}</div>
          </div>
        ` : ''}
        
        <!-- ═══════════════════════════════════════════════════════════════
             الملاحظات
             ═══════════════════════════════════════════════════════════════ -->
        ${data.notes ? `
          <div class="notes-section">
            <div class="title">ملاحظات:</div>
            <div>${data.notes}</div>
          </div>
        ` : ''}
        
        <!-- ═══════════════════════════════════════════════════════════════
             QR Code للتحقق
             ═══════════════════════════════════════════════════════════════ -->
        ${settings.showQRCode ? `
          <div class="qr-section">
            <img src="${qrCodeUrl}" alt="QR Code" />
            <p>امسح للتحقق من الفاتورة</p>
          </div>
        ` : ''}
        
        <!-- ═══════════════════════════════════════════════════════════════
             الفوتر
             ═══════════════════════════════════════════════════════════════ -->
        <div class="footer">
          <p class="thanks">${settings.customMessage || 'شكراً لزيارتكم ❤'}</p>
          <p class="welcome">نتشرف بخدمتكم دائماً</p>
          <p class="welcome">نتمنى لكم يوماً سعيداً</p>
          <p class="brand">Symbol AI - نظام نقاط البيع الذكي</p>
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
            }, 500);
          ` : ''}
        };
        
        // إغلاق النافذة بعد الطباعة
        window.onafterprint = function() {
          setTimeout(function() {
            window.close();
          }, 100);
        };
      </script>
    </body>
    </html>
  `;
};

// Custom hook for thermal printing
export function useThermalPrinter(settings: PrinterSettings = DEFAULT_SETTINGS) {
  const printWindowRef = useRef<Window | null>(null);
  
  const printReceipt = useCallback((data: ReceiptData) => {
    const receiptHTML = generateReceiptHTML(data, settings);
    
    // Close any existing print window
    if (printWindowRef.current && !printWindowRef.current.closed) {
      printWindowRef.current.close();
    }
    
    // Open new print window
    const printWindow = window.open(
      '', 
      '_blank', 
      `width=${settings.paperWidth === '58mm' ? 280 : 320},height=700,scrollbars=yes`
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

// Export utilities
export { generateReceiptHTML, DEFAULT_SETTINGS };
