import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  FileText,
  Search,
  MinusCircle,
  ShoppingCart,
  Phone,
  User,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
  }).format(num);
};

export default function EmployeeInvoicesPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "negative" | "sales">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<number | null>(null);

  // Create invoice state
  const [invoiceType, setInvoiceType] = useState<"negative" | "sales">("negative");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const utils = trpc.useUtils();
  
  const { data: invoices = [], isLoading } = trpc.employeeInvoices.list.useQuery(
    activeTab === "all" ? undefined : { type: activeTab }
  );
  const { data: employees = [] } = trpc.employees.list.useQuery();
  const { data: branches = [] } = trpc.branches.list.useQuery();
  const { data: stats } = trpc.employeeInvoices.stats.useQuery();

  const createMutation = trpc.employeeInvoices.create.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء الفاتورة بنجاح: ${data.invoiceNumber}`);
      utils.employeeInvoices.list.invalidate();
      utils.employeeInvoices.stats.invalidate();
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الإنشاء");
    },
  });

  const deleteMutation = trpc.employeeInvoices.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفاتورة بنجاح");
      utils.employeeInvoices.list.invalidate();
      utils.employeeInvoices.stats.invalidate();
      setDeleteInvoiceId(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customerPhone?.includes(searchQuery)
  );

  const resetCreateForm = () => {
    setInvoiceType("negative");
    setSelectedEmployee("");
    setSelectedBranch("");
    setAmount("");
    setCustomerPhone("");
    setCustomerName("");
    setReason("");
    setNotes("");
  };

  const handleCreate = () => {
    if (!selectedEmployee) {
      toast.error("يجب اختيار الموظف");
      return;
    }
    if (!selectedBranch) {
      toast.error("يجب اختيار الفرع");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("يجب إدخال مبلغ صحيح");
      return;
    }
    if (invoiceType === "negative" && !customerPhone) {
      toast.error("يجب إدخال رقم جوال العميل لفاتورة السالب");
      return;
    }

    const employee = employees.find((e) => e.id.toString() === selectedEmployee);
    const branch = branches.find((b) => b.id.toString() === selectedBranch);

    createMutation.mutate({
      type: invoiceType,
      employeeId: parseInt(selectedEmployee),
      employeeName: employee?.name || "",
      branchId: parseInt(selectedBranch),
      branchName: branch?.name,
      amount,
      customerPhone: invoiceType === "negative" ? customerPhone : undefined,
      customerName: invoiceType === "negative" ? customerName : undefined,
      reason: invoiceType === "negative" ? reason : undefined,
      notes,
    });
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">فواتير السالب</p>
                <p className="text-2xl font-bold text-red-500">
                  {formatCurrency(stats?.negativeTotal || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.negativeCount || 0} فاتورة
                </p>
              </div>
              <MinusCircle className="h-10 w-10 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">فواتير المبيعات</p>
                <p className="text-2xl font-bold text-green-500">
                  {formatCurrency(stats?.salesTotal || 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.salesCount || 0} فاتورة
                </p>
              </div>
              <ShoppingCart className="h-10 w-10 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">صافي الفواتير</p>
                <p className="text-2xl font-bold text-blue-500">
                  {formatCurrency((stats?.salesTotal || 0) - (stats?.negativeTotal || 0))}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(stats?.salesCount || 0) + (stats?.negativeCount || 0)} فاتورة إجمالي
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>فواتير الموظفين</CardTitle>
              <Badge variant="secondary">{invoices.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث برقم الفاتورة أو الموظف..."
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="negative" className="text-red-500">
                <MinusCircle className="h-4 w-4 ml-1" />
                سالب
              </TabsTrigger>
              <TabsTrigger value="sales" className="text-green-500">
                <ShoppingCart className="h-4 w-4 ml-1" />
                مبيعات
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
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
                        <TableHead>النوع</TableHead>
                        <TableHead>الموظف</TableHead>
                        <TableHead>الفرع</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>رقم الجوال</TableHead>
                        <TableHead>التاريخ</TableHead>
                        {isAdmin && <TableHead className="w-[80px]">إجراءات</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                            لا يوجد فواتير
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.type === "negative" ? "destructive" : "default"}>
                                {invoice.type === "negative" ? (
                                  <><MinusCircle className="h-3 w-3 ml-1" /> سالب</>
                                ) : (
                                  <><ShoppingCart className="h-3 w-3 ml-1" /> مبيعات</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>{invoice.employeeName}</TableCell>
                            <TableCell>{invoice.branchName}</TableCell>
                            <TableCell className={invoice.type === "negative" ? "text-red-500" : "text-green-500"}>
                              {invoice.type === "negative" ? "-" : "+"}{formatCurrency(invoice.amount)}
                            </TableCell>
                            <TableCell>
                              {invoice.customerPhone ? (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {invoice.customerPhone}
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(invoice.invoiceDate), "dd MMM yyyy", { locale: ar })}
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleteInvoiceId(invoice.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
            <DialogDescription>
              اختر نوع الفاتورة وأدخل البيانات المطلوبة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Invoice Type */}
            <div className="space-y-2">
              <Label>نوع الفاتورة</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={invoiceType === "negative" ? "default" : "outline"}
                  className={invoiceType === "negative" ? "bg-red-500 hover:bg-red-600" : ""}
                  onClick={() => setInvoiceType("negative")}
                >
                  <MinusCircle className="h-4 w-4 ml-2" />
                  فاتورة سالب
                </Button>
                <Button
                  type="button"
                  variant={invoiceType === "sales" ? "default" : "outline"}
                  className={invoiceType === "sales" ? "bg-green-500 hover:bg-green-600" : ""}
                  onClick={() => setInvoiceType("sales")}
                >
                  <ShoppingCart className="h-4 w-4 ml-2" />
                  فاتورة مبيعات
                </Button>
              </div>
            </div>

            {/* Branch Selection */}
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee Selection */}
            <div className="space-y-2">
              <Label>الموظف</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((e) => !selectedBranch || e.branchId?.toString() === selectedBranch)
                    .map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name} ({employee.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>المبلغ (ر.س)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>

            {/* Customer Info - Only for negative invoices */}
            {invoiceType === "negative" && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    رقم جوال العميل <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    اسم العميل (اختياري)
                  </Label>
                  <Input
                    placeholder="اسم العميل"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>سبب الفاتورة السالب</Label>
                  <Textarea
                    placeholder="سبب الخصم على الموظف..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea
                placeholder="ملاحظات إضافية..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {invoiceType === "negative" && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">تنبيه</p>
                  <p className="text-muted-foreground">
                    فاتورة السالب ستُخصم من الموظف. تأكد من صحة البيانات قبل الحفظ.
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className={invoiceType === "negative" ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}
            >
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الفاتورة"}
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
