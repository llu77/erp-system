import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, X } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import jsPDF from "jspdf";
import "jspdf-autotable";

// تعريف النوع لـ jspdf-autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface PurchaseOrderItem {
  id: number;
  productId: number | null;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitCost: string;
  total: string;
}

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplierId: number | null;
  supplierName: string | null;
  orderDate: string | Date;
  expectedDate: string | Date | null;
  status: string;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  shippingCost: string | null;
  total: string;
  notes: string | null;
  branchId: number | null;
  branchName: string | null;
  createdBy: number | null;
  createdByName: string | null;
}

interface PurchaseOrderPdfProps {
  order: PurchaseOrder;
  items: PurchaseOrderItem[];
  onClose: () => void;
}

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(num);
};

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "#6b7280" },
  pending: { label: "قيد الانتظار", color: "#f59e0b" },
  approved: { label: "موافق عليه", color: "#10b981" },
  received: { label: "مستلم", color: "#3b82f6" },
  partial: { label: "مستلم جزئياً", color: "#8b5cf6" },
  cancelled: { label: "ملغى", color: "#ef4444" },
};

export default function PurchaseOrderPdf({ order, items, onClose }: PurchaseOrderPdfProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="google" content="notranslate">
          <title>أمر شراء ${order.orderNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, sans-serif; 
              direction: rtl; 
              padding: 20px;
              background: white;
              color: #1f2937;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px;
              border-bottom: 2px solid #3b82f6;
              padding-bottom: 20px;
            }
            .header h1 { 
              font-size: 24px; 
              color: #1f2937;
              margin-bottom: 5px;
            }
            .header p { color: #6b7280; }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .info-box {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
            }
            .info-box h3 {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            .info-box p {
              font-size: 16px;
              font-weight: 600;
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              padding: 12px;
              text-align: right;
              border: 1px solid #e5e7eb;
            }
            th {
              background: #3b82f6;
              color: white;
              font-weight: 600;
            }
            tr:nth-child(even) { background: #f9fafb; }
            .totals {
              margin-top: 20px;
              text-align: left;
              padding: 20px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .totals p {
              margin: 8px 0;
              font-size: 14px;
            }
            .totals .grand-total {
              font-size: 18px;
              font-weight: bold;
              color: #3b82f6;
              border-top: 2px solid #e5e7eb;
              padding-top: 10px;
              margin-top: 10px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              color: white;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
              border-top: 1px solid #e5e7eb;
              padding-top: 20px;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // إضافة خط عربي
    doc.setFont("helvetica");
    
    // العنوان
    doc.setFontSize(20);
    doc.text("Purchase Order", 105, 20, { align: "center" });
    doc.setFontSize(14);
    doc.text(order.orderNumber, 105, 30, { align: "center" });

    // معلومات الطلب
    doc.setFontSize(10);
    const startY = 45;
    doc.text(`Supplier: ${order.supplierName || "-"}`, 20, startY);
    doc.text(`Date: ${format(new Date(order.orderDate), "yyyy-MM-dd")}`, 20, startY + 7);
    doc.text(`Status: ${statusLabels[order.status]?.label || order.status}`, 20, startY + 14);
    if (order.branchName) {
      doc.text(`Branch: ${order.branchName}`, 20, startY + 21);
    }

    // جدول المنتجات
    const tableData = items.map((item, index) => [
      (index + 1).toString(),
      item.productName,
      item.quantity.toString(),
      parseFloat(item.unitCost).toFixed(2),
      parseFloat(item.total).toFixed(2),
    ]);

    doc.autoTable({
      startY: startY + 30,
      head: [["#", "Product", "Qty", "Unit Price", "Total"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], halign: "center" },
      styles: { halign: "center", fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 70, halign: "left" },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 35 },
      },
    });

    // المجاميع
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Subtotal: ${parseFloat(order.subtotal).toFixed(2)} SAR`, 150, finalY, { align: "right" });
    if (order.taxAmount && parseFloat(order.taxAmount) > 0) {
      doc.text(`Tax (${order.taxRate}%): ${parseFloat(order.taxAmount).toFixed(2)} SAR`, 150, finalY + 7, { align: "right" });
    }
    if (order.shippingCost && parseFloat(order.shippingCost) > 0) {
      doc.text(`Shipping: ${parseFloat(order.shippingCost).toFixed(2)} SAR`, 150, finalY + 14, { align: "right" });
    }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${parseFloat(order.total).toFixed(2)} SAR`, 150, finalY + 25, { align: "right" });

    // تحميل الملف
    doc.save(`PO-${order.orderNumber}.pdf`);
  };

  const status = statusLabels[order.status] || statusLabels.draft;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 border-b">
          <CardTitle className="text-lg">معاينة أمر الشراء</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-1" />
              طباعة
            </Button>
            <Button variant="default" size="sm" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 ml-1" />
              تحميل PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div ref={printRef} className="bg-white text-gray-900">
            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-blue-500 pb-6">
              <h1 className="text-2xl font-bold text-gray-900">أمر شراء</h1>
              <p className="text-lg font-mono text-gray-600">{order.orderNumber}</p>
              <Badge 
                className="mt-2"
                style={{ backgroundColor: status.color }}
              >
                {status.label}
              </Badge>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="text-sm text-gray-500 mb-1">المورد</h3>
                <p className="font-semibold">{order.supplierName || "غير محدد"}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h3 className="text-sm text-gray-500 mb-1">تاريخ الطلب</h3>
                <p className="font-semibold">
                  {format(new Date(order.orderDate), "dd MMMM yyyy", { locale: ar })}
                </p>
              </div>
              {order.expectedDate && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h3 className="text-sm text-gray-500 mb-1">تاريخ التسليم المتوقع</h3>
                  <p className="font-semibold">
                    {format(new Date(order.expectedDate), "dd MMMM yyyy", { locale: ar })}
                  </p>
                </div>
              )}
              {order.branchName && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h3 className="text-sm text-gray-500 mb-1">الفرع</h3>
                  <p className="font-semibold">{order.branchName}</p>
                </div>
              )}
              {order.createdByName && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h3 className="text-sm text-gray-500 mb-1">أنشئ بواسطة</h3>
                  <p className="font-semibold">{order.createdByName}</p>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4">المنتجات</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-500">
                    <TableHead className="text-white text-right">#</TableHead>
                    <TableHead className="text-white text-right">المنتج</TableHead>
                    <TableHead className="text-white text-center">الكمية</TableHead>
                    <TableHead className="text-white text-left">سعر الوحدة</TableHead>
                    <TableHead className="text-white text-left">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <TableCell className="text-right">{index + 1}</TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          {item.productSku && (
                            <p className="text-xs text-gray-500">{item.productSku}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-left">{formatCurrency(item.unitCost)}</TableCell>
                      <TableCell className="text-left font-semibold">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="space-y-2 text-left">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.taxAmount && parseFloat(order.taxAmount) > 0 && (
                  <div className="flex justify-between">
                    <span>الضريبة ({order.taxRate}%):</span>
                    <span>{formatCurrency(order.taxAmount)}</span>
                  </div>
                )}
                {order.shippingCost && parseFloat(order.shippingCost) > 0 && (
                  <div className="flex justify-between">
                    <span>تكلفة الشحن:</span>
                    <span>{formatCurrency(order.shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-blue-600 border-t pt-3 mt-3">
                  <span>الإجمالي:</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="text-sm font-semibold text-yellow-800 mb-2">ملاحظات</h3>
                <p className="text-yellow-700">{order.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-10 text-center text-gray-400 text-sm border-t pt-6">
              <p>تم إنشاء هذا التقرير بواسطة نظام Symbol AI</p>
              <p>{format(new Date(), "dd MMMM yyyy - HH:mm", { locale: ar })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
