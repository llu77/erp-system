import { forwardRef } from "react";

interface InvoiceItem {
  id: number;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: string;
  discount?: string;
  total: string;
}

interface InvoiceData {
  id: number;
  invoiceNumber: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  invoiceDate: Date | string;
  dueDate?: Date | string;
  subtotal: string;
  taxRate?: string;
  taxAmount?: string;
  discountRate?: string;
  discountAmount?: string;
  total: string;
  paidAmount?: string;
  status: string;
  paymentMethod?: string;
  notes?: string;
  items: InvoiceItem[];
}

interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  logo?: string;
}

interface InvoicePrintProps {
  invoice: InvoiceData;
  company: CompanySettings;
}

const InvoicePrint = forwardRef<HTMLDivElement, InvoicePrintProps>(
  ({ invoice, company }, ref) => {
    const formatDate = (date: Date | string) => {
      const d = new Date(date);
      return d.toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formatCurrency = (amount: string | number) => {
      const num = typeof amount === "string" ? parseFloat(amount) : amount;
      return new Intl.NumberFormat("ar-SA", {
        style: "currency",
        currency: "SAR",
      }).format(num);
    };

    const getStatusName = (status: string) => {
      const statuses: Record<string, string> = {
        draft: "مسودة",
        pending: "قيد الانتظار",
        paid: "مدفوعة",
        partial: "مدفوعة جزئياً",
        cancelled: "ملغاة",
      };
      return statuses[status] || status;
    };

    const getStatusColor = (status: string) => {
      const colors: Record<string, string> = {
        draft: "#6b7280",
        pending: "#f59e0b",
        paid: "#10b981",
        partial: "#3b82f6",
        cancelled: "#ef4444",
      };
      return colors[status] || "#6b7280";
    };

    // حساب المبلغ المتبقي
    const remainingAmount = parseFloat(invoice.total) - parseFloat(invoice.paidAmount || "0");

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "15mm",
          backgroundColor: "white",
          color: "#1f2937",
          fontFamily: "Cairo, Tajawal, sans-serif",
          fontSize: "12px",
          lineHeight: "1.6",
        }}
      >
        {/* رأس الفاتورة */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px", borderBottom: "3px solid #3b82f6", paddingBottom: "20px" }}>
          {/* معلومات الشركة */}
          <div style={{ flex: 1 }}>
            {company.logo && (
              <img src={company.logo} alt="شعار الشركة" style={{ height: "60px", marginBottom: "10px" }} />
            )}
            <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#1e40af", margin: "0 0 10px 0" }}>
              {company.name}
            </h1>
            <p style={{ margin: "5px 0", color: "#4b5563" }}>{company.address}</p>
            <p style={{ margin: "5px 0", color: "#4b5563" }}>هاتف: {company.phone}</p>
            <p style={{ margin: "5px 0", color: "#4b5563" }}>بريد: {company.email}</p>
            {company.taxNumber && (
              <p style={{ margin: "5px 0", color: "#4b5563" }}>الرقم الضريبي: {company.taxNumber}</p>
            )}
          </div>

          {/* معلومات الفاتورة */}
          <div style={{ textAlign: "left", minWidth: "200px" }}>
            <div style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "15px 25px",
              borderRadius: "8px",
              marginBottom: "15px",
            }}>
              <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0" }}>فاتورة ضريبية</h2>
            </div>
            <table style={{ width: "100%", fontSize: "12px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "5px 0", color: "#6b7280" }}>رقم الفاتورة:</td>
                  <td style={{ padding: "5px 0", fontWeight: "bold" }}>{invoice.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style={{ padding: "5px 0", color: "#6b7280" }}>التاريخ:</td>
                  <td style={{ padding: "5px 0" }}>{formatDate(invoice.invoiceDate)}</td>
                </tr>
                {invoice.dueDate && (
                  <tr>
                    <td style={{ padding: "5px 0", color: "#6b7280" }}>تاريخ الاستحقاق:</td>
                    <td style={{ padding: "5px 0" }}>{formatDate(invoice.dueDate)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "5px 0", color: "#6b7280" }}>الحالة:</td>
                  <td style={{ padding: "5px 0" }}>
                    <span style={{
                      backgroundColor: getStatusColor(invoice.status),
                      color: "white",
                      padding: "3px 10px",
                      borderRadius: "4px",
                      fontSize: "11px",
                    }}>
                      {getStatusName(invoice.status)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* معلومات العميل */}
        <div style={{
          backgroundColor: "#f3f4f6",
          padding: "15px",
          borderRadius: "8px",
          marginBottom: "25px",
        }}>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", color: "#374151", margin: "0 0 10px 0" }}>
            معلومات العميل
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <span style={{ color: "#6b7280" }}>الاسم: </span>
              <span style={{ fontWeight: "500" }}>{invoice.customerName || "عميل نقدي"}</span>
            </div>
            {invoice.customerPhone && (
              <div>
                <span style={{ color: "#6b7280" }}>الهاتف: </span>
                <span>{invoice.customerPhone}</span>
              </div>
            )}
            {invoice.customerAddress && (
              <div style={{ gridColumn: "span 2" }}>
                <span style={{ color: "#6b7280" }}>العنوان: </span>
                <span>{invoice.customerAddress}</span>
              </div>
            )}
          </div>
        </div>

        {/* جدول المنتجات */}
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "25px",
        }}>
          <thead>
            <tr style={{ backgroundColor: "#1e40af", color: "white" }}>
              <th style={{ padding: "12px", textAlign: "right", borderRadius: "8px 0 0 0" }}>#</th>
              <th style={{ padding: "12px", textAlign: "right" }}>المنتج</th>
              <th style={{ padding: "12px", textAlign: "right" }}>الكود</th>
              <th style={{ padding: "12px", textAlign: "center" }}>الكمية</th>
              <th style={{ padding: "12px", textAlign: "left" }}>السعر</th>
              <th style={{ padding: "12px", textAlign: "left" }}>الخصم</th>
              <th style={{ padding: "12px", textAlign: "left", borderRadius: "0 8px 0 0" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? "#f9fafb" : "white" }}>
                <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb" }}>{index + 1}</td>
                <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", fontWeight: "500" }}>
                  {item.productName}
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", color: "#6b7280" }}>
                  {item.productSku || "-"}
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
                  {item.quantity}
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                  {formatCurrency(item.unitPrice)}
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
                  {item.discount && parseFloat(item.discount) > 0 ? formatCurrency(item.discount) : "-"}
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", textAlign: "left", fontWeight: "bold" }}>
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ملخص الفاتورة */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "25px" }}>
          <div style={{ width: "300px" }}>
            <table style={{ width: "100%" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "8px 0", color: "#6b7280" }}>المجموع الفرعي:</td>
                  <td style={{ padding: "8px 0", textAlign: "left" }}>{formatCurrency(invoice.subtotal)}</td>
                </tr>
                {invoice.discountAmount && parseFloat(invoice.discountAmount) > 0 && (
                  <tr>
                    <td style={{ padding: "8px 0", color: "#6b7280" }}>
                      الخصم {invoice.discountRate ? `(${invoice.discountRate}%)` : ""}:
                    </td>
                    <td style={{ padding: "8px 0", textAlign: "left", color: "#ef4444" }}>
                      - {formatCurrency(invoice.discountAmount)}
                    </td>
                  </tr>
                )}
                {invoice.taxAmount && parseFloat(invoice.taxAmount) > 0 && (
                  <tr>
                    <td style={{ padding: "8px 0", color: "#6b7280" }}>
                      الضريبة {invoice.taxRate ? `(${invoice.taxRate}%)` : ""}:
                    </td>
                    <td style={{ padding: "8px 0", textAlign: "left" }}>
                      {formatCurrency(invoice.taxAmount)}
                    </td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #1e40af" }}>
                  <td style={{ padding: "12px 0", fontWeight: "bold", fontSize: "16px" }}>الإجمالي:</td>
                  <td style={{ padding: "12px 0", textAlign: "left", fontWeight: "bold", fontSize: "16px", color: "#1e40af" }}>
                    {formatCurrency(invoice.total)}
                  </td>
                </tr>
                {invoice.paidAmount && parseFloat(invoice.paidAmount) > 0 && (
                  <>
                    <tr>
                      <td style={{ padding: "8px 0", color: "#10b981" }}>المدفوع:</td>
                      <td style={{ padding: "8px 0", textAlign: "left", color: "#10b981" }}>
                        {formatCurrency(invoice.paidAmount)}
                      </td>
                    </tr>
                    {remainingAmount > 0 && (
                      <tr>
                        <td style={{ padding: "8px 0", color: "#ef4444", fontWeight: "bold" }}>المتبقي:</td>
                        <td style={{ padding: "8px 0", textAlign: "left", color: "#ef4444", fontWeight: "bold" }}>
                          {formatCurrency(remainingAmount)}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* طريقة الدفع والملاحظات */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "30px" }}>
          {invoice.paymentMethod && (
            <div style={{ backgroundColor: "#f3f4f6", padding: "15px", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#374151", fontWeight: "bold" }}>طريقة الدفع</h4>
              <p style={{ margin: 0 }}>{invoice.paymentMethod}</p>
            </div>
          )}
          {invoice.notes && (
            <div style={{ backgroundColor: "#fef3c7", padding: "15px", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#92400e", fontWeight: "bold" }}>ملاحظات</h4>
              <p style={{ margin: 0, color: "#78350f" }}>{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* QR Code placeholder */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{
            width: "100px",
            height: "100px",
            backgroundColor: "#f3f4f6",
            border: "1px dashed #9ca3af",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            fontSize: "10px",
            textAlign: "center",
          }}>
            QR Code
            <br />
            للفاتورة الإلكترونية
          </div>
        </div>

        {/* تذييل الفاتورة */}
        <div style={{
          borderTop: "2px solid #e5e7eb",
          paddingTop: "20px",
          textAlign: "center",
          color: "#6b7280",
          fontSize: "11px",
        }}>
          <p style={{ margin: "5px 0" }}>شكراً لتعاملكم معنا</p>
          <p style={{ margin: "5px 0" }}>هذه الفاتورة صادرة إلكترونياً ولا تحتاج إلى توقيع أو ختم</p>
          <p style={{ margin: "10px 0 0 0", color: "#9ca3af" }}>
            تم إنشاء هذه الفاتورة بواسطة Symbol AI
          </p>
        </div>
      </div>
    );
  }
);

InvoicePrint.displayName = "InvoicePrint";

export default InvoicePrint;
