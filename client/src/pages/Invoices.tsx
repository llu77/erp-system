import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/useMobile";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  FileText,
  Search,
  Printer,
  Eye,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import InvoicePrint from "@/components/InvoicePrint";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(num);
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "مسودة", variant: "secondary" },
  pending: { label: "قيد الانتظار", variant: "outline" },
  paid: { label: "مدفوعة", variant: "default" },
  partial: { label: "مدفوعة جزئياً", variant: "outline" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

type InvoiceItem = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  total: string;
};

// إعدادات الشركة الافتراضية
const defaultCompanySettings = {
  name: "شركة ERP للتجارة",
  address: "الرياض، المملكة العربية السعودية",
  phone: "+966 11 123 4567",
  email: "info@erp-company.com",
  taxNumber: "300000000000003",
};

export default function InvoicesPage() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [printingInvoice, setPrintingInvoice] = useState<any>(null);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Create invoice state
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  const utils = trpc.useUtils();
  const { data: invoices = [], isLoading } = trpc.invoices.list.useQuery();
  const { data: customers = [] } = trpc.customers.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الفاتورة بنجاح");
      utils.invoices.list.invalidate();
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الإنشاء");
    },
  });

  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفاتورة بنجاح");
      utils.invoices.list.invalidate();
      setDeleteInvoiceId(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetCreateForm = () => {
    setSelectedCustomer("");
    setInvoiceItems([]);
    setSelectedProduct("");
    setItemQuantity(1);
  };

  const addItem = () => {
    if (!selectedProduct) return;
    const product = products.find((p) => p.id.toString() === selectedProduct);
    if (!product) return;

    const existingIndex = invoiceItems.findIndex(
      (item) => item.productId === product.id
    );

    if (existingIndex >= 0) {
      const updated = [...invoiceItems];
      updated[existingIndex].quantity += itemQuantity;
      updated[existingIndex].total = (
        parseFloat(updated[existingIndex].unitPrice) *
        updated[existingIndex].quantity
      ).toFixed(2);
      setInvoiceItems(updated);
    } else {
      const newItem: InvoiceItem = {
        productId: product.id,
        productName: product.name,
        quantity: itemQuantity,
        unitPrice: product.sellingPrice,
        total: (parseFloat(product.sellingPrice) * itemQuantity).toFixed(2),
      };
      setInvoiceItems([...invoiceItems, newItem]);
    }

    setSelectedProduct("");
    setItemQuantity(1);
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return invoiceItems.reduce((sum, item) => sum + parseFloat(item.total), 0);
  };

  const handleCreate = () => {
    if (invoiceItems.length === 0) {
      toast.error("يجب إضافة منتج واحد على الأقل");
      return;
    }

    createMutation.mutate({
      customerId: selectedCustomer ? parseInt(selectedCustomer) : undefined,
      items: invoiceItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: "0",
      })),
    });
  };

  const handlePrint = (invoice: any) => {
    // تحضير بيانات الفاتورة للطباعة
    const customer = customers.find(c => c.id === invoice.customerId);
    const printData = {
      ...invoice,
      customerPhone: customer?.phone,
      customerAddress: customer?.address,
      items: invoice.items || [
        {
          id: 1,
          productName: "منتج",
          quantity: 1,
          unitPrice: invoice.subtotal,
          total: invoice.subtotal,
        }
      ],
    };
    setPrintingInvoice(printData);
  };

  const executePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <title>فاتورة ${printingInvoice?.invoiceNumber}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: 'Cairo', sans-serif; }
              @media print {
                body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>${printContent}</body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    }
    setPrintingInvoice(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>إدارة الفواتير</CardTitle>
              <Badge variant="secondary">{invoices.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث برقم الفاتورة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 ml-2" />
                فاتورة جديدة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>العميل</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-[120px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا يوجد فواتير
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const status = statusLabels[invoice.status] || statusLabels.draft;
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.customerName || "عميل نقدي"}</TableCell>
                          <TableCell>
                            {format(new Date(invoice.invoiceDate), "dd MMM yyyy", {
                              locale: ar,
                            })}
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">
                            {formatCurrency(invoice.total)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingInvoice(invoice)}
                                title="عرض التفاصيل"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handlePrint(invoice)}
                                title="طباعة الفاتورة"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteInvoiceId(invoice.id)}
                                title="حذف"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
            <DialogDescription>أضف المنتجات لإنشاء فاتورة جديدة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العميل (اختياري)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">عميل نقدي</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id.toString()}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label>المنتج</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المنتج" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name} - {formatCurrency(product.sellingPrice)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-2">
                  <Label>الكمية</Label>
                  <Input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <Button type="button" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {invoiceItems.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المنتج</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>السعر</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell>{formatCurrency(item.total)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-semibold text-lg">الإجمالي:</span>
                <span className="font-bold text-xl text-green-600">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الفاتورة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={() => setViewingInvoice(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>تفاصيل الفاتورة</DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">رقم الفاتورة</p>
                  <p className="font-mono font-medium">{viewingInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">التاريخ</p>
                  <p className="font-medium">
                    {format(new Date(viewingInvoice.invoiceDate), "dd MMM yyyy", {
                      locale: ar,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">العميل</p>
                  <p className="font-medium">{viewingInvoice.customerName || "عميل نقدي"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الحالة</p>
                  <Badge variant={statusLabels[viewingInvoice.status]?.variant || "secondary"}>
                    {statusLabels[viewingInvoice.status]?.label || viewingInvoice.status}
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg">الإجمالي الفرعي:</span>
                  <span>{formatCurrency(viewingInvoice.subtotal)}</span>
                </div>
                {viewingInvoice.taxAmount && parseFloat(viewingInvoice.taxAmount) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-lg">الضريبة:</span>
                    <span>{formatCurrency(viewingInvoice.taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xl font-bold border-t pt-2 mt-2">
                  <span>الإجمالي:</span>
                  <span className="text-green-600">{formatCurrency(viewingInvoice.total)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingInvoice(null)}>
              إغلاق
            </Button>
            <Button onClick={() => {
              handlePrint(viewingInvoice);
              setViewingInvoice(null);
            }}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Preview Dialog */}
      <Dialog open={!!printingInvoice} onOpenChange={() => setPrintingInvoice(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>معاينة الطباعة</DialogTitle>
          </DialogHeader>
          {printingInvoice && (
            <div className="border rounded-lg overflow-hidden">
              <div ref={printRef}>
                <InvoicePrint
                  invoice={printingInvoice}
                  company={defaultCompanySettings}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintingInvoice(null)}>
              إلغاء
            </Button>
            <Button onClick={executePrint}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteInvoiceId} onOpenChange={() => setDeleteInvoiceId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteInvoiceId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteInvoiceId && deleteMutation.mutate({ id: deleteInvoiceId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
