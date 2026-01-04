import { useState } from "react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { ResponsiveTable, Column } from "@/components/ResponsiveTable";
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
  Printer,
  FileText,
  Upload,
  Image,
  X,
  Eye,
  Download,
  FileSpreadsheet,
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

interface ExpenseAttachment {
  url: string;
  key: string;
  name: string;
  uploadedAt: string;
}

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
  attachments?: ExpenseAttachment[];
}

export default function Expenses() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewAttachment, setViewAttachment] = useState<string | null>(null);

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
  const { data: advances } = trpc.expenses.advances.useQuery();
  const { data: advancesStats } = trpc.expenses.advancesStats.useQuery();
  
  // حالة عرض قسم السلف
  const [showAdvances, setShowAdvances] = useState(false);
  const [advancesDateFrom, setAdvancesDateFrom] = useState('');
  const [advancesDateTo, setAdvancesDateTo] = useState('');
  const [advancesStatusFilter, setAdvancesStatusFilter] = useState<'all' | 'deducted' | 'pending'>('all');

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

  // رفع مرفق
  const uploadAttachmentMutation = trpc.expenses.uploadAttachment.useMutation({
    onSuccess: (data) => {
      setAttachments(prev => [...prev, {
        url: data.url,
        key: data.key,
        name: data.name,
        uploadedAt: new Date().toISOString(),
      }]);
      toast.success("تم رفع المرفق بنجاح");
      setIsUploading(false);
    },
    onError: (error) => {
      toast.error(error.message || "فشل رفع المرفق");
      setIsUploading(false);
    },
  });

  // معالجة اختيار المرفق
  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من حجم الملف (10MB كحد أقصى)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الملف يجب أن يكون أقل من 10 ميجابايت");
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      uploadAttachmentMutation.mutate({
        base64Data,
        fileName: file.name,
        contentType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  // حذف مرفق
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // إضافة مصروف
  const onSubmitAdd = (data: ExpenseFormData) => {
    const branch = branches?.find(b => b.id === data.branchId);
    createMutation.mutate({
      ...data,
      category: data.category as "shop_supplies" | "printing" | "carpet_cleaning" | "small_needs" | "residency" | "medical_exam" | "transportation" | "electricity" | "internet" | "license_renewal" | "visa" | "residency_renewal" | "health_cert_renewal" | "maintenance" | "health_cert" | "violation" | "emergency" | "shop_rent" | "housing_rent" | "improvements" | "bonus" | "other",
      paymentMethod: data.paymentMethod as "cash" | "bank_transfer" | "check" | "credit_card" | "other",
      branchName: branch?.nameAr || branch?.name,
      attachments: attachments.length > 0 ? JSON.stringify(attachments) : undefined,
    }, {
      onSuccess: () => {
        setAttachments([]);
      }
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
    if (filterBranch !== "all" && expense.branchId?.toString() !== filterBranch) return false;
    // فلتر الشهر
    if (filterMonth) {
      const expenseDate = new Date(expense.expenseDate);
      const [year, month] = filterMonth.split('-').map(Number);
      if (expenseDate.getFullYear() !== year || expenseDate.getMonth() + 1 !== month) return false;
    }
    return true;
  });

  // حساب إجمالي المصاريف المفلترة
  const filteredTotal = filteredExpenses?.reduce((sum, exp) => sum + parseFloat(exp.amount || '0'), 0) || 0;

  // تصدير السلف إلى Excel
  const exportAdvancesToExcel = () => {
    if (!advances || advances.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    // تطبيق الفلاتر
    const filteredAdvances = advances.filter((advance: any) => {
      if (advancesStatusFilter === 'deducted' && !advance.isDeducted) return false;
      if (advancesStatusFilter === 'pending' && advance.isDeducted) return false;
      if (advancesDateFrom && advance.approvedAt) {
        const approvedDate = new Date(advance.approvedAt);
        const fromDate = new Date(advancesDateFrom);
        if (approvedDate < fromDate) return false;
      }
      if (advancesDateTo && advance.approvedAt) {
        const approvedDate = new Date(advance.approvedAt);
        const toDate = new Date(advancesDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (approvedDate > toDate) return false;
      }
      return true;
    });

    // إنشاء محتوى CSV
    const headers = ['الموظف', 'المبلغ', 'السبب', 'تاريخ الموافقة', 'الموافق', 'حالة الخصم', 'تاريخ الخصم'];
    const rows = filteredAdvances.map((advance: any) => [
      advance.employeeName,
      advance.amount,
      advance.reason || advance.title || '',
      advance.approvedAt ? new Date(advance.approvedAt).toLocaleDateString('ar-SA') : '',
      advance.approvedBy || '',
      advance.isDeducted ? 'تم الخصم' : 'لم يخصم بعد',
      advance.deductedAt ? new Date(advance.deductedAt).toLocaleDateString('ar-SA') : '',
    ]);

    // إضافة سطر الإجمالي
    const totalAmount = filteredAdvances.reduce((sum: number, adv: any) => sum + adv.amount, 0);
    rows.push(['', '', '', '', '', '', '']);
    rows.push(['الإجمالي', totalAmount.toString(), '', '', '', '', '']);

    // إنشاء CSV مع BOM لدعم العربية
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `السلف_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير السلف بنجاح');
  };

  // تصدير السلف إلى PDF
  const exportAdvancesToPDF = () => {
    if (!advances || advances.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }

    // تطبيق الفلاتر
    const filteredAdvances = advances.filter((advance: any) => {
      if (advancesStatusFilter === 'deducted' && !advance.isDeducted) return false;
      if (advancesStatusFilter === 'pending' && advance.isDeducted) return false;
      if (advancesDateFrom && advance.approvedAt) {
        const approvedDate = new Date(advance.approvedAt);
        const fromDate = new Date(advancesDateFrom);
        if (approvedDate < fromDate) return false;
      }
      if (advancesDateTo && advance.approvedAt) {
        const approvedDate = new Date(advance.approvedAt);
        const toDate = new Date(advancesDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (approvedDate > toDate) return false;
      }
      return true;
    });

    const totalAmount = filteredAdvances.reduce((sum: number, adv: any) => sum + adv.amount, 0);
    const deductedAmount = filteredAdvances.filter((a: any) => a.isDeducted).reduce((sum: number, adv: any) => sum + adv.amount, 0);
    const pendingAmount = filteredAdvances.filter((a: any) => !a.isDeducted).reduce((sum: number, adv: any) => sum + adv.amount, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير السلف</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');
          body { 
            font-family: 'Tajawal', Arial, sans-serif; 
            padding: 30px; 
            background: #fff;
            color: #000;
          }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 10px; }
          .header p { color: #666; }
          .stats { display: flex; justify-content: space-around; margin-bottom: 30px; }
          .stat-box { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 150px; }
          .stat-box .value { font-size: 20px; font-weight: bold; color: #333; }
          .stat-box .label { font-size: 12px; color: #666; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #f5f5f5; font-weight: 600; }
          tr:nth-child(even) { background: #fafafa; }
          .deducted { color: #16a34a; }
          .pending { color: #ca8a04; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير السلف المأخوذة</h1>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
          ${advancesDateFrom || advancesDateTo ? `<p>الفترة: ${advancesDateFrom || 'البداية'} - ${advancesDateTo || 'النهاية'}</p>` : ''}
        </div>
        
        <div class="stats">
          <div class="stat-box">
            <div class="value">${filteredAdvances.length}</div>
            <div class="label">إجمالي السلف</div>
          </div>
          <div class="stat-box">
            <div class="value">${totalAmount.toLocaleString()} ر.س</div>
            <div class="label">إجمالي المبالغ</div>
          </div>
          <div class="stat-box">
            <div class="value">${deductedAmount.toLocaleString()} ر.س</div>
            <div class="label">المخصومة</div>
          </div>
          <div class="stat-box">
            <div class="value">${pendingAmount.toLocaleString()} ر.س</div>
            <div class="label">غير مخصومة</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الموظف</th>
              <th>المبلغ</th>
              <th>السبب</th>
              <th>تاريخ الموافقة</th>
              <th>الموافق</th>
              <th>الحالة</th>
              <th>تاريخ الخصم</th>
            </tr>
          </thead>
          <tbody>
            ${filteredAdvances.map((advance: any, index: number) => `
              <tr>
                <td>${index + 1}</td>
                <td>${advance.employeeName}</td>
                <td>${advance.amount.toLocaleString()} ر.س</td>
                <td>${advance.reason || advance.title || '-'}</td>
                <td>${advance.approvedAt ? new Date(advance.approvedAt).toLocaleDateString('ar-SA') : '-'}</td>
                <td>${advance.approvedBy || '-'}</td>
                <td class="${advance.isDeducted ? 'deducted' : 'pending'}">
                  ${advance.isDeducted ? 'تم الخصم' : 'لم يخصم بعد'}
                </td>
                <td>${advance.deductedAt ? new Date(advance.deductedAt).toLocaleDateString('ar-SA') : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة نظام ERP</p>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // طباعة تقرير المصاريف
  const printExpensesReport = () => {
    const [year, month] = filterMonth.split('-').map(Number);
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const monthName = monthNames[month - 1];
    const branchName = filterBranch === 'all' ? 'جميع الفروع' : branches?.find(b => b.id.toString() === filterBranch)?.nameAr || 'غير محدد';
    
    // تجميع المصاريف حسب التصنيف
    const expensesByCategory: Record<string, { count: number; total: number; items: typeof filteredExpenses }> = {};
    filteredExpenses?.forEach(exp => {
      if (!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = { count: 0, total: 0, items: [] };
      }
      expensesByCategory[exp.category].count++;
      expensesByCategory[exp.category].total += parseFloat(exp.amount || '0');
      expensesByCategory[exp.category].items?.push(exp);
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير المصاريف - ${monthName} ${year}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800;900&display=swap');
          body { 
            font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif; 
            padding: 20px; 
            background: #fff;
            color: #000;
            font-size: 14px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            padding-bottom: 20px;
            border-bottom: 3px solid #000;
          }
          .logo { font-size: 28px; font-weight: 800; color: #000; margin-bottom: 5px; }
          .report-title { font-size: 20px; color: #000; margin: 10px 0; font-weight: 700; }
          .report-info { color: #6b7280; font-size: 14px; }
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
          }
          .summary-card {
            background: #f5f5f5;
            border: 2px solid #000;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
          }
          .summary-card .label { color: #333; font-size: 12px; margin-bottom: 5px; font-weight: 600; }
          .summary-card .value { font-size: 22px; font-weight: 800; color: #000; }
          .category-section {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .category-header {
            background: #1a1a1a;
            color: white;
            padding: 10px 15px;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .category-name { font-weight: 700; font-size: 14px; }
          .category-total { font-size: 16px; font-weight: 800; }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 10px;
            background: white;
          }
          th { 
            background: #f5f5f5; 
            padding: 10px 8px; 
            text-align: right; 
            font-weight: 700;
            color: #000;
            border: 1px solid #ccc;
          }
          td { 
            padding: 10px 8px; 
            border: 1px solid #ccc; 
            text-align: right;
            font-weight: 600;
            color: #000;
          }
          tr:nth-child(even) { background: #f8fafc; }
          .amount { color: #cc0000; font-weight: 800; font-size: 15px; }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 500;
          }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-approved { background: #d1fae5; color: #065f46; }
          .status-paid { background: #dbeafe; color: #1e40af; }
          .status-rejected { background: #fee2e2; color: #991b1b; }
          .grand-total {
            background: #1a1a1a;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 20px;
            font-weight: 800;
            margin-top: 20px;
            border: 2px solid #000;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            color: #9ca3af;
            font-size: 11px;
          }
          @media print {
            body { padding: 10px; }
            .summary-cards { grid-template-columns: repeat(4, 1fr); }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Symbol AI</div>
          <div class="report-title">تقرير المصاريف الشهري</div>
          <div class="report-info">
            <strong>الشهر:</strong> ${monthName} ${year} | 
            <strong>الفرع:</strong> ${branchName} | 
            <strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-SA')}
          </div>
        </div>

        <div class="summary-cards">
          <div class="summary-card">
            <div class="label">عدد المصاريف</div>
            <div class="value">${filteredExpenses?.length || 0}</div>
          </div>
          <div class="summary-card">
            <div class="label">عدد التصنيفات</div>
            <div class="value">${Object.keys(expensesByCategory).length}</div>
          </div>
          <div class="summary-card">
            <div class="label">متوسط المصروف</div>
            <div class="value">${filteredExpenses?.length ? (filteredTotal / filteredExpenses.length).toFixed(2) : '0.00'} ر.س</div>
          </div>
          <div class="summary-card">
            <div class="label">إجمالي المصاريف</div>
            <div class="value">${filteredTotal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</div>
          </div>
        </div>

        ${Object.entries(expensesByCategory).map(([category, data]) => `
          <div class="category-section">
            <div class="category-header">
              <span class="category-name">${categoryNames[category] || category}</span>
              <span class="category-total">${data.count} مصروف | ${data.total.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>رقم المصروف</th>
                  <th>العنوان</th>
                  <th>التاريخ</th>
                  <th>طريقة الدفع</th>
                  <th>الحالة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                ${data.items?.map(exp => `
                  <tr>
                    <td>${exp.expenseNumber}</td>
                    <td>${exp.title}</td>
                    <td>${new Date(exp.expenseDate).toLocaleDateString('ar-SA')}</td>
                    <td>${paymentMethods.find(p => p.value === exp.paymentMethod)?.label || exp.paymentMethod}</td>
                    <td><span class="status-badge status-${exp.status}">${statusNames[exp.status]}</span></td>
                    <td class="amount">${parseFloat(exp.amount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}

        <div class="grand-total">
          <span>إجمالي المصاريف لشهر ${monthName} ${year}</span>
          <span>${filteredTotal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ريال سعودي</span>
        </div>

        <div class="footer">
          <p>تم إنشاء هذا التقرير بواسطة نظام Symbol AI لإدارة الموارد</p>
          <p>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

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
                
                {/* قسم المرفقات */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">المرفقات (صور الفواتير/الإيصالات)</label>
                  <div className="border-2 border-dashed rounded-lg p-4">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleAttachmentSelect}
                      className="hidden"
                      id="attachment-upload"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="attachment-upload"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      )}
                      <span className="text-sm text-muted-foreground mt-2">
                        {isUploading ? "جاري الرفع..." : "اضغط لرفع مرفق"}
                      </span>
                    </label>
                  </div>
                  
                  {/* عرض المرفقات المرفوعة */}
                  {attachments.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {attachments.map((att, index) => (
                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Image className="h-4 w-4" />
                            <span className="text-sm truncate max-w-[200px]">{att.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(att.url, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAttachment(index)}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <Button type="submit" className="w-full" disabled={createMutation.isPending || isUploading}>
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
        <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'}`}>
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
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="الفرع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.nameAr || branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-40"
                />
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
              <div className="flex-1" />
              <Button variant="outline" onClick={printExpensesReport} className="gap-2">
                <Printer className="h-4 w-4" />
                طباعة التقرير
              </Button>
            </div>
            {/* عرض إجمالي المصاريف المفلترة */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                عدد المصاريف: <strong>{filteredExpenses?.length || 0}</strong>
              </span>
              <span className="text-lg font-bold text-red-600">
                إجمالي: {filteredTotal.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
              </span>
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
              isMobile ? (
                // عرض البطاقات على الموبايل
                <div className="space-y-3">
                  {filteredExpenses.map((expense) => (
                    <Card key={expense.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-bold text-lg">{expense.title}</p>
                          <p className="text-sm text-muted-foreground">{expense.expenseNumber}</p>
                        </div>
                        <Badge className={statusColors[expense.status]}>
                          {statusNames[expense.status]}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المبلغ:</span>
                          <span className="font-bold text-red-600">{formatAmount(expense.amount)} ر.س</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">التصنيف:</span>
                          <Badge variant="outline">{categoryNames[expense.category]}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">التاريخ:</span>
                          <span>{formatDate(expense.expenseDate)}</span>
                        </div>
                        {expense.branchName && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الفرع:</span>
                            <span>{expense.branchName}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t">
                        {expense.status === 'pending' && (
                          <>
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(expense)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canApprove && (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => updateStatusMutation.mutate({ id: expense.id, status: 'approved' })}>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => {
                                  const reason = prompt('سبب الرفض:');
                                  if (reason) updateStatusMutation.mutate({ id: expense.id, status: 'rejected', rejectionReason: reason });
                                }}>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) deleteMutation.mutate({ id: expense.id });
                              }}>
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            )}
                          </>
                        )}
                        {expense.status === 'approved' && canApprove && (
                          <Button variant="ghost" size="sm" onClick={() => updateStatusMutation.mutate({ id: expense.id, status: 'paid' })}>
                            <DollarSign className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                // عرض الجدول على الشاشات الكبيرة
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
              )
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد مصاريف</p>
                <p className="text-sm">قم بإضافة مصروف جديد للبدء</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* قسم السلف المأخوذة */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              السلف المأخوذة
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvances(!showAdvances)}
            >
              {showAdvances ? 'إخفاء' : 'عرض'}
            </Button>
          </CardHeader>
          
          {showAdvances && (
            <CardContent>
              {/* إحصائيات السلف */}
              {advancesStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">إجمالي السلف</p>
                    <p className="text-xl font-bold">{advancesStats.totalAdvances}</p>
                    <p className="text-sm text-blue-600">{advancesStats.totalAmount.toLocaleString()} ر.س</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">المخصومة</p>
                    <p className="text-xl font-bold">{advancesStats.deductedCount}</p>
                    <p className="text-sm text-green-600">{advancesStats.deductedAmount.toLocaleString()} ر.س</p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">غير مخصومة</p>
                    <p className="text-xl font-bold">{advancesStats.pendingCount}</p>
                    <p className="text-sm text-yellow-600">{advancesStats.pendingAmount.toLocaleString()} ر.س</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">نسبة الخصم</p>
                    <p className="text-xl font-bold">
                      {advancesStats.totalAdvances > 0 
                        ? Math.round((advancesStats.deductedCount / advancesStats.totalAdvances) * 100) 
                        : 0}%
                    </p>
                    <p className="text-sm text-purple-600">من إجمالي السلف</p>
                  </div>
                </div>
              )}

              {/* فلاتر السلف */}
              <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">من:</label>
                  <Input
                    type="date"
                    value={advancesDateFrom}
                    onChange={(e) => setAdvancesDateFrom(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">إلى:</label>
                  <Input
                    type="date"
                    value={advancesDateTo}
                    onChange={(e) => setAdvancesDateTo(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">الحالة:</label>
                  <Select
                    value={advancesStatusFilter}
                    onValueChange={(v) => setAdvancesStatusFilter(v as 'all' | 'deducted' | 'pending')}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="deducted">مخصومة</SelectItem>
                      <SelectItem value="pending">غير مخصومة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(advancesDateFrom || advancesDateTo || advancesStatusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdvancesDateFrom('');
                      setAdvancesDateTo('');
                      setAdvancesStatusFilter('all');
                    }}
                  >
                    <X className="h-4 w-4 ml-1" />
                    مسح الفلاتر
                  </Button>
                )}
                
                {/* أزرار التصدير */}
                <div className="flex-1" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAdvancesToExcel()}
                    disabled={!advances || advances.length === 0}
                  >
                    <FileSpreadsheet className="h-4 w-4 ml-1" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportAdvancesToPDF()}
                    disabled={!advances || advances.length === 0}
                  >
                    <Download className="h-4 w-4 ml-1" />
                    PDF
                  </Button>
                </div>
              </div>

              {/* جدول السلف */}
              {advances && advances.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الموظف</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>السبب</TableHead>
                        <TableHead>تاريخ الموافقة</TableHead>
                        <TableHead>الموافق</TableHead>
                        <TableHead>حالة الخصم</TableHead>
                        <TableHead>تاريخ الخصم</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advances
                        .filter((advance: any) => {
                          // فلترة الحالة
                          if (advancesStatusFilter === 'deducted' && !advance.isDeducted) return false;
                          if (advancesStatusFilter === 'pending' && advance.isDeducted) return false;
                          
                          // فلترة التاريخ
                          if (advancesDateFrom && advance.approvedAt) {
                            const approvedDate = new Date(advance.approvedAt);
                            const fromDate = new Date(advancesDateFrom);
                            if (approvedDate < fromDate) return false;
                          }
                          if (advancesDateTo && advance.approvedAt) {
                            const approvedDate = new Date(advance.approvedAt);
                            const toDate = new Date(advancesDateTo);
                            toDate.setHours(23, 59, 59, 999);
                            if (approvedDate > toDate) return false;
                          }
                          return true;
                        })
                        .map((advance: any) => (
                        <TableRow key={advance.id}>
                          <TableCell className="font-medium">{advance.employeeName}</TableCell>
                          <TableCell>
                            <span className="font-bold text-red-600">
                              {advance.amount.toLocaleString()} ر.س
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {advance.reason || advance.title || '-'}
                          </TableCell>
                          <TableCell>
                            {advance.approvedAt 
                              ? new Date(advance.approvedAt).toLocaleDateString('ar-SA')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>{advance.approvedBy || '-'}</TableCell>
                          <TableCell>
                            <Badge className={advance.isDeducted 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                            }>
                              {advance.isDeducted ? 'تم الخصم' : 'لم يخصم بعد'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {advance.deductedAt 
                              ? new Date(advance.deductedAt).toLocaleDateString('ar-SA')
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد سلف معتمدة</p>
                </div>
              )}
            </CardContent>
          )}
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
