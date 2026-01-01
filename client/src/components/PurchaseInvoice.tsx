import { forwardRef } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PurchaseItem {
  id?: number;
  productName: string;
  productSku?: string;
  quantity: number;
  unitCost: string;
  total: string;
}

interface PurchaseOrderData {
  id: number;
  orderNumber: string;
  supplierName?: string;
  orderDate: Date | string;
  expectedDate?: Date | string;
  subtotal: string;
  taxRate?: string;
  taxAmount?: string;
  shippingCost?: string;
  total: string;
  status: string;
  notes?: string;
  items: PurchaseItem[];
}

interface CompanyInfo {
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxNumber?: string;
}

interface PurchaseInvoiceProps {
  order: PurchaseOrderData;
  companyInfo?: CompanyInfo;
}

const statusLabels: Record<string, string> = {
  draft: 'مسودة',
  pending: 'قيد الانتظار',
  approved: 'موافق عليه',
  received: 'مستلم',
  partial: 'مستلم جزئياً',
  cancelled: 'ملغى',
};

const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
  }).format(num);
};

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'dd MMMM yyyy', { locale: ar });
};

const PurchaseInvoice = forwardRef<HTMLDivElement, PurchaseInvoiceProps>(
  ({ order, companyInfo }, ref) => {
    const defaultCompany: CompanyInfo = {
      name: 'Symbol AI',
      address: 'المملكة العربية السعودية',
      phone: '+966 XX XXX XXXX',
      email: 'info@symbolai.com',
      taxNumber: '300XXXXXXXXX',
    };

    const company = { ...defaultCompany, ...companyInfo };

    return (
      <div
        ref={ref}
        className="bg-white text-black p-8 min-h-[297mm] w-[210mm] mx-auto"
        style={{ fontFamily: 'Arial, sans-serif' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-4 border-indigo-600">
          <div className="flex items-center gap-4">
            {company.logo ? (
              <img src={company.logo} alt="Logo" className="h-16 w-16 object-contain" />
            ) : (
              <div className="h-16 w-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-indigo-600">{company.name}</h1>
              <p className="text-gray-500 text-sm">{company.address}</p>
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">أمر شراء</h2>
            <p className="text-lg font-mono bg-indigo-50 px-4 py-2 rounded-lg text-indigo-700">
              {order.orderNumber}
            </p>
          </div>
        </div>

        {/* Order Info & Supplier Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Order Details */}
          <div className="bg-gray-50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              تفاصيل الطلب
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">تاريخ الطلب:</span>
                <span className="font-medium">{formatDate(order.orderDate)}</span>
              </div>
              {order.expectedDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">تاريخ التوريد المتوقع:</span>
                  <span className="font-medium">{formatDate(order.expectedDate)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">الحالة:</span>
                <span className="font-medium px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Info */}
          <div className="bg-indigo-50 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-4">
              معلومات المورد
            </h3>
            <div className="space-y-2">
              <p className="text-lg font-bold text-gray-800">
                {order.supplierName || 'مورد غير محدد'}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <th className="py-4 px-4 text-right rounded-tr-lg">#</th>
                <th className="py-4 px-4 text-right">المنتج</th>
                <th className="py-4 px-4 text-center">الكمية</th>
                <th className="py-4 px-4 text-left">سعر الوحدة</th>
                <th className="py-4 px-4 text-left rounded-tl-lg">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={`border-b border-gray-100 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className="py-4 px-4 text-gray-500">{index + 1}</td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-800">{item.productName}</p>
                      {item.productSku && (
                        <p className="text-xs text-gray-400 font-mono">{item.productSku}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center font-medium">{item.quantity}</td>
                  <td className="py-4 px-4 text-left font-mono text-gray-600">
                    {formatCurrency(item.unitCost)}
                  </td>
                  <td className="py-4 px-4 text-left font-bold text-gray-800">
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80 bg-gray-50 rounded-xl p-5 space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>المجموع الفرعي:</span>
              <span className="font-mono">{formatCurrency(order.subtotal)}</span>
            </div>
            {order.taxRate && parseFloat(order.taxRate) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>الضريبة ({order.taxRate}%):</span>
                <span className="font-mono">{formatCurrency(order.taxAmount || '0')}</span>
              </div>
            )}
            {order.shippingCost && parseFloat(order.shippingCost) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>تكلفة الشحن:</span>
                <span className="font-mono">{formatCurrency(order.shippingCost)}</span>
              </div>
            )}
            <div className="border-t-2 border-indigo-200 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-800">الإجمالي:</span>
                <span className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mb-8 bg-yellow-50 border-r-4 border-yellow-400 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">ملاحظات:</h4>
            <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t-2 border-gray-200 pt-6 mt-auto">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              <p>{company.phone}</p>
              <p>{company.email}</p>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-700">شكراً لتعاملكم معنا</p>
              <p className="text-xs mt-1">تم إنشاء هذا المستند إلكترونياً</p>
            </div>
            <div className="text-left">
              {company.taxNumber && (
                <p>الرقم الضريبي: {company.taxNumber}</p>
              )}
            </div>
          </div>
        </div>

        {/* Watermark for draft */}
        {order.status === 'draft' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <span className="text-9xl font-bold text-gray-500 rotate-[-30deg]">
              مسودة
            </span>
          </div>
        )}
      </div>
    );
  }
);

PurchaseInvoice.displayName = 'PurchaseInvoice';

export default PurchaseInvoice;
