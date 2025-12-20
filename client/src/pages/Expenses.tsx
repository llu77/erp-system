import { useState } from "react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Receipt,
  DollarSign,
  Building2,
  Calendar,
  CreditCard,
  TrendingDown,
  Clock,
  Filter,
} from "lucide-react";

// تصنيفات المصاريف
const expenseCategories = [
  { value: "shop_supplies", label: "اغراض محل" },
  { value: "printing", label: "طباعة ورق" },
  { value: "carpet_cleaning", label: "غسيل سجاد" },
  { value: "small_needs", label: "احتياجات بسيطة" },
  { value: "residency", label: "اقامة" },
  { value: "medical_exam", label: "فحص طبي" },
  { value: "transportation", label: "مواصلات" },
  { value: "electricity", label: "كهرباء" },
  { value: "internet", label: "انترنت" },
  { value: "license_renewal", label: "تجديد رخصة" },
  { value: "visa", label: "تاشيره" },
  { value: "residency_renewal", label: "تجديد اقامة" },
  { value: "health_cert_renewal", label: "تجديد شهادة صحيه" },
  { value: "maintenance", label: "صيانة" },
  { value: "health_cert", label: "شهادة صحية" },
  { value: "violation", label: "مخالفة" },
  { value: "emergency", label: "طوارىء" },
  { value: "shop_rent", label: "ايجار محل" },
  { value: "housing_rent", label: "ايجار سكن" },
  { value: "improvements", label: "تحسينات" },
  { value: "bonus", label: "مكافأة" },
  { value: "other", label: "أخرى" },
];

// طرق الدفع
const paymentMethods = [
  { value: "cash", label: "نقدي" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "check", label: "شيك" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "other", label: "أخرى" },
];

// أسماء الحالات
const statusNames: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  paid: "مدفوع",
};

// ألوان الحالات
const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-blue-100 text-blue-800",
};

// أسماء التصنيفات
const categoryNames: Record<string, string> = {
  shop_supplies: "اغراض محل",
  printing: "طباعة ورق",
  carpet_cleaning: "غسيل سجاد",
  small_needs: "احتياجات بسيطة",
  residency: "اقامة",
  medical_exam: "فحص طبي",
  transportation: "مواصلات",
  electricity: "كهرباء",
  internet: "انترنت",
  license_renewal: "تجديد رخصة",
  visa: "تاشيره",
  residency_renewal: "تجديد اقامة",
  health_cert_renewal: "تجديد شهادة صحيه",
  maintenance: "صيانة",
  health_cert: "شهادة صحية",
  violation: "مخالفة",
  emergency: "طوارىء",
  shop_rent: "ايجار محل",
  housing_rent: "ايجار سكن",
  improvements: "تحسينات",
  bonus: "مكافأة",
  other: "أخرى",
};

interface ExpenseFormData {
  category: string;
  title: string;
  description?: string;
  amount: string;
  branchId?: number;
  expenseDate: string;
  paymentMethod: string;
  paymentReference?: string;
  receiptNumber?: string;
}

export default function Expenses() {
  const { user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // التحقق من الصلاحيات
  const canAdd = user?.role !== 'viewer';
  const canEdit = user?.role === 'admin';
  const canDelete = user?.role === 'admin';
  const canApprove = user?.role === 'admin';

  const { register, handleSubmit, reset, setValue, watch } = useForm<ExpenseFormData>({
    defaultValues: {
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMethod: "cash",
    },
  });

  // جلب البيانات
  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: stats } = trpc.expenses.stats.useQuery();

  // Mutations
  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المصروف بنجاح");
      setIsAddOpen(false);
      reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث المصروف بنجاح");
      setIsEditOpen(false);
      reset();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStatusMutation = trpc.expenses.updateStatus.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المصروف بنجاح");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // إضافة مصروف
  const onSubmitAdd = (data: ExpenseFormData) => {
    const branch = branches?.find(b => b.id === data.branchId);
    createMutation.mutate({
      ...data,
      category: data.category as "shop_supplies" | "printing" | "carpet_cleaning" | "small_needs" | "residency" | "medical_exam" | "transportation" | "electricity" | "internet" | "license_renewal" | "visa" | "residency_renewal" | "health_cert_renewal" | "maintenance" | "health_cert" | "violation" | "emergency" | "shop_rent" | "housing_rent" | "improvements" | "bonus" | "other",
      paymentMethod: data.paymentMethod as "cash" | "bank_transfer" | "check" | "credit_card" | "other",
      branchName: branch?.nameAr || branch?.name,
    });
  };

  // تحديث مصروف
  const onSubmitEdit = (data: ExpenseFormData) => {
    if (!selectedExpense) return;
    updateMutation.mutate({
      id: selectedExpense,
      ...data,
      category: data.category as "shop_supplies" | "printing" | "carpet_cleaning" | "small_needs" | "residency" | "medical_exam" | "transportation" | "electricity" | "internet" | "license_renewal" | "visa" | "residency_renewal" | "health_cert_renewal" | "maintenance" | "health_cert" | "violation" | "emergency" | "shop_rent" | "housing_rent" | "improvements" | "bonus" | "other",
      paymentMethod: data.paymentMethod as "cash" | "bank_transfer" | "check" | "credit_card" | "other",
    });
  };

  // فتح نافذة التعديل
  const openEditDialog = (expense: NonNullable<typeof expenses>[0]) => {
    setSelectedExpense(expense.id);
    setValue("category", expense.category);
    setValue("title", expense.title);
    setValue("description", expense.description || "");
    setValue("amount", expense.amount);
    setValue("branchId", expense.branchId || undefined);
    setValue("expenseDate", new Date(expense.expenseDate).toISOString().split('T')[0]);
    setValue("paymentMethod", expense.paymentMethod);
    setValue("paymentReference", expense.paymentReference || "");
    setValue("receiptNumber", expense.receiptNumber || "");
    setIsEditOpen(true);
  };

  // تنسيق المبلغ
  const formatAmount = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toLocaleString('ar-SA', { minimumFractionDigits: 2 });
  };

  // تنسيق التاريخ
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('ar-SA');
  };

  // تصفية المصاريف
  const filteredExpenses = expenses?.filter(expense => {
    if (filterCategory !== "all" && expense.category !== filterCategory) return false;
    if (filterStatus !== "all" && expense.status !== filterStatus) return false;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان والإجراءات */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">المصاريف</h1>
            <p className="text-muted-foreground">إدارة وتتبع مصاريف الشركة</p>
          </div>
          {canAdd && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة مصروف
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>إضافة مصروف جديد</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmitAdd)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">التصنيف *</label>
                    <Select
                      value={watch("category")}
                      onValueChange={(v) => setValue("category", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر التصنيف" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">المبلغ *</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register("amount", { required: true })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">العنوان *</label>
                  <Input
                    placeholder="وصف مختصر للمصروف"
                    {...register("title", { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">التفاصيل</label>
                  <Textarea
                    placeholder="تفاصيل إضافية..."
                    {...register("description")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">الفرع</label>
                    <Select
                      value={watch("branchId")?.toString() || ""}
                      onValueChange={(v) => setValue("branchId", parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.nameAr || branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">التاريخ *</label>
                    <Input
                      type="date"
                      {...register("expenseDate", { required: true })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">طريقة الدفع</label>
                    <Select
                      value={watch("paymentMethod")}
                      onValueChange={(v) => setValue("paymentMethod", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">رقم الإيصال</label>
                    <Input
                      placeholder="رقم الإيصال أو الفاتورة"
                      {...register("receiptNumber")}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">مرجع الدفع</label>
                  <Input
                    placeholder="رقم الحوالة أو الشيك"
                    {...register("paymentReference")}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="ml-2 h-4 w-4" />
                  )}
                  إضافة المصروف
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Receipt className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المصاريف</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">قيد المراجعة</p>
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">معتمدة</p>
                  <p className="text-2xl font-bold">{stats?.approved || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">مدفوعة</p>
                  <p className="text-2xl font-bold">{stats?.paid || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المبالغ</p>
                  <p className="text-lg font-bold">{formatAmount(stats?.totalAmount || 0)} ر.س</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* الفلاتر */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">تصفية:</span>
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع التصنيفات</SelectItem>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                  <SelectItem value="approved">معتمد</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* جدول المصاريف */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              قائمة المصاريف
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredExpenses && filteredExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم المصروف</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>التصنيف</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>طريقة الدفع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.expenseNumber}</TableCell>
                        <TableCell>{expense.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {categoryNames[expense.category]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-red-600">
                          {formatAmount(expense.amount)} ر.س
                        </TableCell>
                        <TableCell>
                          {expense.branchName ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              {expense.branchName}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(expense.expenseDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            {paymentMethods.find(m => m.value === expense.paymentMethod)?.label}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[expense.status]}>
                            {statusNames[expense.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {expense.status === 'pending' && (
                              <>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(expense)}
                                    title="تعديل"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canApprove && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => updateStatusMutation.mutate({ id: expense.id, status: 'approved' })}
                                      title="اعتماد"
                                    >
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const reason = prompt('سبب الرفض:');
                                        if (reason) {
                                          updateStatusMutation.mutate({ id: expense.id, status: 'rejected', rejectionReason: reason });
                                        }
                                      }}
                                      title="رفض"
                                    >
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
                                        deleteMutation.mutate({ id: expense.id });
                                      }
                                    }}
                                    title="حذف"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                )}
                              </>
                            )}
                            {expense.status === 'approved' && canApprove && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => updateStatusMutation.mutate({ id: expense.id, status: 'paid' })}
                                title="تأكيد الدفع"
                              >
                                <DollarSign className="h-4 w-4 text-blue-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد مصاريف</p>
                <p className="text-sm">قم بإضافة مصروف جديد للبدء</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة التعديل */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>تعديل المصروف</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">التصنيف *</label>
                  <Select
                    value={watch("category")}
                    onValueChange={(v) => setValue("category", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المبلغ *</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("amount", { required: true })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">العنوان *</label>
                <Input
                  placeholder="وصف مختصر للمصروف"
                  {...register("title", { required: true })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">التفاصيل</label>
                <Textarea
                  placeholder="تفاصيل إضافية..."
                  {...register("description")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">التاريخ *</label>
                  <Input
                    type="date"
                    {...register("expenseDate", { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">طريقة الدفع</label>
                  <Select
                    value={watch("paymentMethod")}
                    onValueChange={(v) => setValue("paymentMethod", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <Edit className="ml-2 h-4 w-4" />
                )}
                حفظ التغييرات
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
