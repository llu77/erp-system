import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
import { Plus, Trash2, ShoppingCart, Search, Eye, X, FileText, Printer } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import PurchaseInvoice from "@/components/PurchaseInvoice";

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
  approved: { label: "موافق عليه", variant: "default" },
  received: { label: "مستلم", variant: "default" },
  partial: { label: "مستلم جزئياً", variant: "outline" },
  cancelled: { label: "ملغى", variant: "destructive" },
};

type PurchaseItem = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  total: string;
};

export default function PurchasesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<number | null>(null);
  const [printingOrder, setPrintingOrder] = useState<any>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Create order state
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [orderItems, setOrderItems] = useState<PurchaseItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemPrice, setItemPrice] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: orders = [], isLoading } = trpc.purchaseOrders.list.useQuery();
  const { data: suppliers = [] } = trpc.suppliers.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  
  // جلب تفاصيل الطلب للطباعة
  const { data: orderDetails } = trpc.purchaseOrders.getById.useQuery(
    { id: printingOrder?.id || 0 },
    { enabled: !!printingOrder }
  );

  // تحديث السعر تلقائياً عند اختيار منتج
  useEffect(() => {
    if (selectedProduct) {
      const product = products.find((p) => p.id.toString() === selectedProduct);
      if (product && product.costPrice) {
        setItemPrice(product.costPrice.toString());
      }
    } else {
      setItemPrice("");
    }
  }, [selectedProduct, products]);

  const createMutation = trpc.purchaseOrders.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء أمر الشراء بنجاح");
      utils.purchaseOrders.list.invalidate();
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الإنشاء");
    },
  });

  const updateStatusMutation = trpc.purchaseOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الطلب بنجاح");
      utils.purchaseOrders.list.invalidate();
      utils.products.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء التحديث");
    },
  });

  const deleteMutation = trpc.purchaseOrders.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف أمر الشراء بنجاح");
      utils.purchaseOrders.list.invalidate();
      setDeleteOrderId(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const filteredOrders = orders.filter(
    (order: any) =>
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.supplierName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetCreateForm = () => {
    setSelectedSupplier("");
    setOrderItems([]);
    setSelectedProduct("");
    setItemQuantity(1);
    setItemPrice("");
  };

  const addItem = () => {
    if (!selectedProduct || !itemPrice) {
      toast.error("يرجى اختيار المنتج وإدخال السعر");
      return;
    }
    const product = products.find((p) => p.id.toString() === selectedProduct);
    if (!product) return;

    const existingIndex = orderItems.findIndex(
      (item) => item.productId === product.id
    );

    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += itemQuantity;
      updated[existingIndex].total = (
        parseFloat(updated[existingIndex].unitPrice) *
        updated[existingIndex].quantity
      ).toFixed(2);
      setOrderItems(updated);
    } else {
      const newItem: PurchaseItem = {
        productId: product.id,
        productName: product.name,
        quantity: itemQuantity,
        unitPrice: itemPrice,
        total: (parseFloat(itemPrice) * itemQuantity).toFixed(2),
      };
      setOrderItems([...orderItems, newItem]);
    }

    setSelectedProduct("");
    setItemQuantity(1);
    setItemPrice("");
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + parseFloat(item.total), 0);
  };

  const handleCreate = () => {
    if (!selectedSupplier) {
      toast.error("يجب اختيار المورد");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("يجب إضافة منتج واحد على الأقل");
      return;
    }

    createMutation.mutate({
      supplierId: parseInt(selectedSupplier),
      items: orderItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: item.unitPrice,
      })),
    });
  };

  const handleStatusChange = (orderId: number, newStatus: string) => {
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus as any,
    });
  };

  // طباعة الفاتورة
  const handlePrintInvoice = (order: any) => {
    setPrintingOrder(order);
  };

  // تنفيذ الطباعة بعد تحميل البيانات
  useEffect(() => {
    if (orderDetails && printingOrder && invoiceRef.current) {
      // انتظار قليل لضمان تحميل المحتوى
      setTimeout(() => {
        const printContent = invoiceRef.current?.innerHTML;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
              <meta charset="UTF-8">
              <title>فاتورة مشتريات - ${orderDetails.orderNumber}</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  @page { size: A4; margin: 10mm; }
                }
                body { font-family: 'Arial', sans-serif; }
              </style>
            </head>
            <body>
              ${printContent}
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                    window.close();
                  }, 500);
                }
              </script>
            </body>
            </html>
          `);
          printWindow.document.close();
        }
        setPrintingOrder(null);
      }, 100);
    }
  }, [orderDetails, printingOrder]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">إدارة المشتريات</CardTitle>
              <Badge variant="secondary" className="text-xs">{orders.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-48">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="بحث برقم الطلب..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-7 h-8 text-sm"
                />
              </div>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="h-8">
                <Plus className="h-3.5 w-3.5 ml-1" />
                أمر شراء جديد
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs py-2">رقم الطلب</TableHead>
                    <TableHead className="text-xs py-2">الفرع</TableHead>
                    <TableHead className="text-xs py-2">المورد</TableHead>
                    <TableHead className="text-xs py-2">التاريخ</TableHead>
                    <TableHead className="text-xs py-2">الإجمالي</TableHead>
                    <TableHead className="text-xs py-2">الحالة</TableHead>
                    <TableHead className="text-xs py-2 w-[130px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">
                        لا يوجد أوامر شراء
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order: any) => {
                      const status = statusLabels[order.status] || statusLabels.draft;
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs py-2">{order.orderNumber}</TableCell>
                          <TableCell className="text-xs py-2">
                            <Badge variant="outline" className="text-xs font-normal">
                              {order.branchName || "غير محدد"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs py-2">{order.supplierName || "-"}</TableCell>
                          <TableCell className="text-xs py-2">
                            {format(new Date(order.orderDate), "dd MMM yyyy", {
                              locale: ar,
                            })}
                          </TableCell>
                          <TableCell className="font-semibold text-orange-600 text-xs py-2">
                            {formatCurrency(order.total)}
                          </TableCell>
                          <TableCell className="py-2">
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleStatusChange(order.id, value)}
                            >
                              <SelectTrigger className="w-24 h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft" className="text-xs">مسودة</SelectItem>
                                <SelectItem value="pending" className="text-xs">قيد الانتظار</SelectItem>
                                <SelectItem value="approved" className="text-xs">موافق عليه</SelectItem>
                                <SelectItem value="received" className="text-xs">مستلم</SelectItem>
                                <SelectItem value="cancelled" className="text-xs">ملغى</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewingOrder(order)}
                                title="عرض التفاصيل"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-indigo-600 hover:text-indigo-700"
                                onClick={() => handlePrintInvoice(order)}
                                title="طباعة الفاتورة"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteOrderId(order.id)}
                                  title="حذف"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
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

      {/* Create Order Dialog - Compact Layout with Scroll */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="p-4 pb-2 shrink-0">
            <DialogTitle className="text-base">إنشاء أمر شراء جديد</DialogTitle>
            <DialogDescription className="text-xs">أضف المنتجات لإنشاء أمر شراء جديد</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 space-y-3">
            {/* Supplier Selection */}
            <div className="space-y-1">
              <Label className="text-xs">المورد *</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="اختر المورد" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()} className="text-sm">
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Product Section */}
            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              {/* صف المنتج */}
              <div className="space-y-1">
                <Label className="text-xs">المنتج</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="اختر المنتج" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()} className="text-sm">
                        <span className="truncate max-w-[280px] block">{product.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* صف الكمية والسعر */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">الكمية</Label>
                  <Input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">السعر (تلقائي)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="0.00"
                    className="h-8 text-sm"
                    readOnly
                  />
                </div>
              </div>
              {/* زر الإضافة */}
              <Button type="button" onClick={addItem} size="sm" className="w-full h-8">
                <Plus className="h-3.5 w-3.5 ml-1" />
                إضافة المنتج
              </Button>
            </div>

            {/* Items List */}
            {orderItems.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs py-1.5">المنتج</TableHead>
                      <TableHead className="text-xs py-1.5 w-16">الكمية</TableHead>
                      <TableHead className="text-xs py-1.5 w-20">السعر</TableHead>
                      <TableHead className="text-xs py-1.5 w-24">الإجمالي</TableHead>
                      <TableHead className="text-xs py-1.5 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs py-1.5 truncate max-w-[150px]">{item.productName}</TableCell>
                        <TableCell className="text-xs py-1.5">{item.quantity}</TableCell>
                        <TableCell className="text-xs py-1.5">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-xs py-1.5 font-medium">{formatCurrency(item.total)}</TableCell>
                        <TableCell className="py-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeItem(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-muted/50 px-3 py-2 flex justify-between items-center">
                  <span className="text-xs font-medium">الإجمالي:</span>
                  <span className="text-sm font-bold text-orange-600">{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 pt-2 gap-2 shrink-0 border-t bg-background">
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء أمر الشراء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog - Compact */}
      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="sm:max-w-[450px] p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">تفاصيل أمر الشراء</DialogTitle>
          </DialogHeader>
          {viewingOrder && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">رقم الطلب</p>
                  <p className="font-mono font-medium text-sm">{viewingOrder.orderNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">التاريخ</p>
                  <p className="font-medium text-sm">
                    {format(new Date(viewingOrder.orderDate), "dd MMM yyyy", {
                      locale: ar,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المورد</p>
                  <p className="font-medium text-sm">{viewingOrder.supplierName || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الحالة</p>
                  <Badge variant={statusLabels[viewingOrder.status]?.variant || "secondary"} className="text-xs">
                    {statusLabels[viewingOrder.status]?.label || viewingOrder.status}
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center text-base font-bold">
                  <span>الإجمالي:</span>
                  <span className="text-orange-600">{formatCurrency(viewingOrder.total)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="pt-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                handlePrintInvoice(viewingOrder);
                setViewingOrder(null);
              }}
              className="gap-1"
            >
              <FileText className="h-3.5 w-3.5" />
              طباعة الفاتورة
            </Button>
            <Button variant="outline" size="sm" onClick={() => setViewingOrder(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation - Compact */}
      <Dialog open={!!deleteOrderId} onOpenChange={() => setDeleteOrderId(null)}>
        <DialogContent className="sm:max-w-[350px] p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">تأكيد الحذف</DialogTitle>
            <DialogDescription className="text-xs">
              هل أنت متأكد من حذف أمر الشراء هذا؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOrderId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteOrderId && deleteMutation.mutate({ id: deleteOrderId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden Invoice for Printing */}
      {orderDetails && printingOrder && (
        <div className="fixed -left-[9999px] top-0">
          <PurchaseInvoice
            ref={invoiceRef}
            order={{
              id: orderDetails.id,
              orderNumber: orderDetails.orderNumber,
              supplierName: orderDetails.supplierName || undefined,
              orderDate: orderDetails.orderDate,
              expectedDate: orderDetails.expectedDate || undefined,
              subtotal: orderDetails.subtotal,
              taxRate: orderDetails.taxRate || undefined,
              taxAmount: orderDetails.taxAmount || undefined,
              shippingCost: orderDetails.shippingCost || undefined,
              total: orderDetails.total,
              status: orderDetails.status,
              notes: orderDetails.notes || undefined,
              items: orderDetails.items?.map((item: any) => ({
                id: item.id,
                productName: item.productName,
                productSku: item.productSku,
                quantity: item.quantity,
                unitCost: item.unitCost,
                total: item.total,
              })) || [],
            }}
          />
        </div>
      )}
    </div>
  );
}
