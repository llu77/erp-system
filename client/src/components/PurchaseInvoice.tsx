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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num) + ' ر.س';
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
        dir="rtl"
        style={{
          fontFamily: 'Arial, Tahoma, sans-serif',
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
          padding: '40px',
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          position: 'relative',
          fontSize: '14px',
          lineHeight: '1.6',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '30px',
          paddingBottom: '20px',
          borderBottom: '3px solid #2563eb',
        }}>
          {/* Company Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
              width: '70px',
              height: '70px',
              backgroundColor: '#2563eb',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: 'bold',
            }}>
              S
            </div>
            <div>
              <h1 style={{
                margin: '0 0 5px 0',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#2563eb',
              }}>
                {company.name}
              </h1>
              <p style={{ margin: 0, color: '#666666', fontSize: '13px' }}>
                {company.address}
              </p>
            </div>
          </div>

          {/* Invoice Title */}
          <div style={{ textAlign: 'left' }}>
            <h2 style={{
              margin: '0 0 10px 0',
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#1a1a1a',
            }}>
              أمر شراء
            </h2>
            <div style={{
              backgroundColor: '#f0f7ff',
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #2563eb',
            }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#2563eb',
              }}>
                {order.orderNumber}
              </span>
            </div>
          </div>
        </div>

        {/* Order & Supplier Info */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '30px',
        }}>
          {/* Order Details */}
          <div style={{
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            padding: '20px',
            border: '1px solid #e2e8f0',
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              تفاصيل الطلب
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', color: '#64748b', fontSize: '14px' }}>تاريخ الطلب:</td>
                  <td style={{ padding: '8px 0', fontWeight: '600', fontSize: '14px', textAlign: 'left' }}>
                    {formatDate(order.orderDate)}
                  </td>
                </tr>
                {order.expectedDate && (
                  <tr>
                    <td style={{ padding: '8px 0', color: '#64748b', fontSize: '14px' }}>تاريخ التوريد:</td>
                    <td style={{ padding: '8px 0', fontWeight: '600', fontSize: '14px', textAlign: 'left' }}>
                      {formatDate(order.expectedDate)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '8px 0', color: '#64748b', fontSize: '14px' }}>الحالة:</td>
                  <td style={{ padding: '8px 0', textAlign: 'left' }}>
                    <span style={{
                      backgroundColor: order.status === 'received' ? '#dcfce7' : 
                                      order.status === 'approved' ? '#dbeafe' :
                                      order.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                      color: order.status === 'received' ? '#166534' : 
                             order.status === 'approved' ? '#1e40af' :
                             order.status === 'cancelled' ? '#991b1b' : '#92400e',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Supplier Info */}
          <div style={{
            backgroundColor: '#eff6ff',
            borderRadius: '10px',
            padding: '20px',
            border: '1px solid #bfdbfe',
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#2563eb',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              معلومات المورد
            </h3>
            <p style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#1e3a5f',
            }}>
              {order.supplierName || 'مورد غير محدد'}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <div style={{ marginBottom: '30px' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <thead>
              <tr style={{ backgroundColor: '#2563eb' }}>
                <th style={{
                  padding: '15px 12px',
                  textAlign: 'right',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px',
                  width: '50px',
                }}>
                  #
                </th>
                <th style={{
                  padding: '15px 12px',
                  textAlign: 'right',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px',
                }}>
                  المنتج
                </th>
                <th style={{
                  padding: '15px 12px',
                  textAlign: 'center',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px',
                  width: '100px',
                }}>
                  الكمية
                </th>
                <th style={{
                  padding: '15px 12px',
                  textAlign: 'left',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px',
                  width: '130px',
                }}>
                  سعر الوحدة
                </th>
                <th style={{
                  padding: '15px 12px',
                  textAlign: 'left',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px',
                  width: '130px',
                }}>
                  الإجمالي
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr
                  key={item.id || index}
                  style={{
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <td style={{
                    padding: '14px 12px',
                    color: '#64748b',
                    fontSize: '14px',
                    textAlign: 'center',
                  }}>
                    {index + 1}
                  </td>
                  <td style={{ padding: '14px 12px' }}>
                    <div style={{ fontWeight: '600', color: '#1a1a1a', fontSize: '14px' }}>
                      {item.productName}
                    </div>
                    {item.productSku && (
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontFamily: 'monospace',
                        marginTop: '3px',
                      }}>
                        {item.productSku}
                      </div>
                    )}
                  </td>
                  <td style={{
                    padding: '14px 12px',
                    textAlign: 'center',
                    fontWeight: '600',
                    fontSize: '14px',
                  }}>
                    {item.quantity}
                  </td>
                  <td style={{
                    padding: '14px 12px',
                    textAlign: 'left',
                    fontFamily: 'monospace',
                    color: '#64748b',
                    fontSize: '14px',
                  }}>
                    {formatCurrency(item.unitCost)}
                  </td>
                  <td style={{
                    padding: '14px 12px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#1a1a1a',
                    fontSize: '14px',
                  }}>
                    {formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '30px',
        }}>
          <div style={{
            width: '320px',
            backgroundColor: '#f8fafc',
            borderRadius: '10px',
            padding: '20px',
            border: '1px solid #e2e8f0',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '10px 0', color: '#64748b', fontSize: '14px' }}>المجموع الفرعي:</td>
                  <td style={{
                    padding: '10px 0',
                    textAlign: 'left',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                  }}>
                    {formatCurrency(order.subtotal)}
                  </td>
                </tr>
                {order.taxRate && parseFloat(order.taxRate) > 0 && (
                  <tr>
                    <td style={{ padding: '10px 0', color: '#64748b', fontSize: '14px' }}>
                      الضريبة ({order.taxRate}%):
                    </td>
                    <td style={{
                      padding: '10px 0',
                      textAlign: 'left',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                    }}>
                      {formatCurrency(order.taxAmount || '0')}
                    </td>
                  </tr>
                )}
                {order.shippingCost && parseFloat(order.shippingCost) > 0 && (
                  <tr>
                    <td style={{ padding: '10px 0', color: '#64748b', fontSize: '14px' }}>تكلفة الشحن:</td>
                    <td style={{
                      padding: '10px 0',
                      textAlign: 'left',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                    }}>
                      {formatCurrency(order.shippingCost)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2}>
                    <div style={{
                      borderTop: '2px solid #2563eb',
                      marginTop: '10px',
                      paddingTop: '15px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#1a1a1a',
                      }}>
                        الإجمالي:
                      </span>
                      <span style={{
                        fontSize: '22px',
                        fontWeight: 'bold',
                        color: '#2563eb',
                      }}>
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        {order.notes && (
          <div style={{
            marginBottom: '30px',
            backgroundColor: '#fefce8',
            borderRight: '4px solid #eab308',
            borderRadius: '8px',
            padding: '15px 20px',
          }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontWeight: '600',
              color: '#854d0e',
              fontSize: '14px',
            }}>
              ملاحظات:
            </h4>
            <p style={{
              margin: 0,
              color: '#1a1a1a',
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
            }}>
              {order.notes}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={{
          borderTop: '2px solid #e2e8f0',
          paddingTop: '20px',
          marginTop: 'auto',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
          }}>
            <div>
              <p style={{ margin: '0 0 3px 0' }}>{company.phone}</p>
              <p style={{ margin: 0 }}>{company.email}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{
                margin: '0 0 3px 0',
                fontWeight: '600',
                color: '#1a1a1a',
                fontSize: '13px',
              }}>
                شكراً لتعاملكم معنا
              </p>
              <p style={{ margin: 0, fontSize: '11px' }}>
                تم إنشاء هذا المستند إلكترونياً
              </p>
            </div>
            <div style={{ textAlign: 'left' }}>
              {company.taxNumber && (
                <p style={{ margin: 0 }}>الرقم الضريبي: {company.taxNumber}</p>
              )}
            </div>
          </div>
        </div>

        {/* Watermark for draft */}
        {order.status === 'draft' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: '120px',
            fontWeight: 'bold',
            color: 'rgba(0, 0, 0, 0.06)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            مسودة
          </div>
        )}
      </div>
    );
  }
);

PurchaseInvoice.displayName = 'PurchaseInvoice';

export default PurchaseInvoice;
