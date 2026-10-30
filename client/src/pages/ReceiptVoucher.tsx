import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { downloadBase64Pdf } from '@/lib/downloadPdf';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Mail,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  VOUCHER_PARTY_TYPE_LABELS,
  VOUCHER_PARTY_TYPES,
  VOUCHER_TITLES,
  amountToArabicWords,
  amountToEnglishWords,
  computeVoucherItems,
  formatPaymentSplitText,
  formatVoucherAmount,
  formatVoucherDate,
  getAllowedVoucherTransitions,
  getVoucherStatusLabel,
  isVoucherSigned,
  resolvePaymentSplit,
  roundMoney,
  todayVoucherDate,
  validatePaymentDetails,
  type VoucherPartyType,
  type VoucherStatus,
  type VoucherType,
} from '@shared/vouchers';
import { renderVoucherHtml } from '@shared/voucherTemplate';

// المستلمون الثابتون لسند القبض (تسليم كاش الفرع للإدارة)
const RECIPIENTS = ['عمر المطيري', 'سالم الوادعي', 'اغراض محل'];

type StatusFilter = VoucherStatus | 'all';

interface FormItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

interface VoucherForm {
  voucherDate: string;
  dueDateFrom: string;
  dueDateTo: string;
  branchId: string;
  partyName: string;
  partyType: VoucherPartyType;
  payeeName: string;
  description: string;
  items: FormItem[];
  /** النقد يُحسب تلقائياً (الإجمالي - الحوالة - الشيك) حتى يعدّله المستخدم */
  cashManual: boolean;
  cashAmount: string;
  bankAmount: string;
  bankName: string;
  bankReference: string;
  checkAmount: string;
  checkNumber: string;
  checkDate: string;
  checkBank: string;
  notes: string;
}

const NO_BRANCH = 'none';

function emptyForm(type: VoucherType, branchId: number | null | undefined): VoucherForm {
  const isReceipt = type === 'receipt';
  return {
    voucherDate: todayVoucherDate(),
    dueDateFrom: '',
    dueDateTo: '',
    branchId: branchId ? String(branchId) : NO_BRANCH,
    partyName: '',
    partyType: isReceipt ? 'branch' : 'supplier',
    payeeName: '',
    description: isReceipt ? 'تسليم مبالغ كاش' : '',
    items: [{ description: isReceipt ? 'تسليم مبالغ كاش' : '', quantity: '1', unitPrice: '' }],
    cashManual: false,
    cashAmount: '',
    bankAmount: '',
    bankName: '',
    bankReference: '',
    checkAmount: '',
    checkNumber: '',
    checkDate: '',
    checkBank: '',
    notes: '',
  };
}

function toNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300';
    case 'approved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'paid':
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300';
    default:
      return '';
  }
}

/** الحد الأقصى لعدد السندات في القائمة */
const VOUCHER_LIST_LIMIT = 300;

export default function ReceiptVoucher({ initialType }: { initialType?: VoucherType } = {}) {
  const { user } = useAuth();
  const [location] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const typeFromUrl: VoucherType = useMemo(() => {
    const params = new URLSearchParams(search);
    if (params.get('type') === 'payment' || location.startsWith('/payment-voucher')) return 'payment';
    if (params.get('type') === 'receipt') return 'receipt';
    return initialType ?? 'receipt';
  }, [search, location, initialType]);

  const [activeType, setActiveType] = useState<VoucherType>(typeFromUrl);
  useEffect(() => setActiveType(typeFromUrl), [typeFromUrl]);

  const role = user?.role ?? '';
  const isApprover = role === 'admin' || role === 'manager';
  const canCreate = isApprover || role === 'supervisor';
  const isAdmin = role === 'admin';

  // الفلاتر
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // سندات القبض ليس لها حالة "تم الصرف": إعادة الفلتر عند التبديل حتى لا تظهر القائمة فارغة بدون فلتر ظاهر
  const switchVoucherType = (type: VoucherType) => {
    setActiveType(type);
    if (type === 'receipt' && statusFilter === 'paid') setStatusFilter('all');
  };
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchText, setSearchText] = useState('');

  // النوافذ
  const [showCreate, setShowCreate] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ voucherId: string; status: 'approved' | 'paid'; type: VoucherType } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ voucherId: string; type: VoucherType } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const branchesQuery = trpc.branches.list.useQuery();
  const branches = branchesQuery.data || [];
  const userBranch = useMemo(
    () => (user?.branchId ? branches.find(b => b.id === user.branchId) ?? null : null),
    [user?.branchId, branches]
  );

  const listInput = {
    voucherType: activeType,
    status: statusFilter,
    branchId: isApprover && branchFilter !== 'all' ? parseInt(branchFilter, 10) : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: searchText.trim() || undefined,
    limit: VOUCHER_LIST_LIMIT,
    offset: 0,
  };
  const vouchersQuery = trpc.receiptVoucher.getAll.useQuery(listInput);
  const vouchers = vouchersQuery.data || [];

  const previewQuery = trpc.receiptVoucher.get.useQuery(
    { voucherId: previewId || '' },
    { enabled: !!previewId }
  );

  const refresh = () => utils.receiptVoucher.getAll.invalidate();

  const updateStatusMutation = trpc.receiptVoucher.updateStatus.useMutation({
    onSuccess: () => {
      refresh();
      if (previewId) utils.receiptVoucher.get.invalidate({ voucherId: previewId });
    },
  });
  const deleteMutation = trpc.receiptVoucher.delete.useMutation({ onSuccess: () => refresh() });
  const sendEmailMutation = trpc.receiptVoucher.sendEmail.useMutation();
  const generatePDFMutation = trpc.receiptVoucher.generatePDF.useMutation();

  // ملخص القائمة الحالية (الملغي لا يدخل في الإجماليات)
  const summary = useMemo(() => {
    const active = vouchers.filter(v => v.status !== 'cancelled');
    const sum = (list: typeof vouchers) => roundMoney(list.reduce((s, v) => s + (parseFloat(v.totalAmount) || 0), 0));
    const drafts = active.filter(v => v.status === 'draft');
    const signed = active.filter(v => isVoucherSigned(v.status));
    return {
      count: active.length,
      total: sum(active),
      draftCount: drafts.length,
      draftTotal: sum(drafts),
      signedCount: signed.length,
      signedTotal: sum(signed),
      cancelledCount: vouchers.length - active.length,
    };
  }, [vouchers]);

  const titles = VOUCHER_TITLES[activeType];

  // ==================== الإجراءات ====================

  // الطباعة: تُفتح النافذة مباشرة عند النقر (قبل أي انتظار) لتجنب حظر النوافذ المنبثقة
  const handlePrint = async (voucherId: string) => {
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }
    win.document.write('<p dir="rtl" style="font-family: Tahoma, sans-serif; padding: 24px;">جاري تجهيز السند للطباعة...</p>');
    try {
      const voucher = await utils.receiptVoucher.get.fetch({ voucherId });
      const html = renderVoucherHtml(voucher, { assetBaseUrl: window.location.origin, autoPrint: true });
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (error: any) {
      win.close();
      toast.error(error?.message || 'فشل في تجهيز السند للطباعة');
    }
  };

  const handleDownloadPdf = async (voucherId: string) => {
    const toastId = `pdf-${voucherId}`;
    try {
      toast.loading('جاري توليد ملف PDF...', { id: toastId });
      const result = await generatePDFMutation.mutateAsync({ voucherId });
      downloadBase64Pdf(result.pdf, result.filename);
      toast.success('تم تحميل السند بنجاح', { id: toastId });
    } catch (error: any) {
      toast.error(error?.message || 'فشل في توليد ملف PDF', { id: toastId });
    }
  };

  const handleSendEmail = async (voucherId: string) => {
    try {
      const result = await sendEmailMutation.mutateAsync({ voucherId });
      if (result.partial) {
        toast.warning(
          `تم إرسال السند إلى ${result.sentTo.length} مستلم، وتعذر الإرسال إلى: ${result.failed.map(f => f.email).join('، ')}`
        );
      } else if (result.success) toast.success(`تم إرسال السند إلى ${result.sentTo.length} مستلم`);
      else toast.error(result.error || 'فشل في إرسال البريد الإلكتروني');
    } catch (error: any) {
      toast.error(error?.message || 'فشل في إرسال البريد الإلكتروني');
    }
  };

  const handleConfirmStatus = async () => {
    if (!confirmAction) return;
    try {
      await updateStatusMutation.mutateAsync({ voucherId: confirmAction.voucherId, status: confirmAction.status });
      toast.success(confirmAction.status === 'approved' ? 'تم اعتماد السند وإضافة التوقيعات والختم' : 'تم تسجيل صرف السند');
    } catch (error: any) {
      toast.error(error?.message || 'فشل في تحديث حالة السند');
    } finally {
      setConfirmAction(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      toast.error('يرجى كتابة سبب الإلغاء');
      return;
    }
    try {
      await updateStatusMutation.mutateAsync({ voucherId: cancelTarget.voucherId, status: 'cancelled', reason: cancelReason.trim() });
      toast.success('تم إلغاء السند');
      setCancelTarget(null);
      setCancelReason('');
    } catch (error: any) {
      toast.error(error?.message || 'فشل في إلغاء السند');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync({ voucherId: deleteTarget });
      toast.success('تم حذف السند');
      if (previewId === deleteTarget) setPreviewId(null);
    } catch (error: any) {
      toast.error(error?.message || 'فشل في حذف السند');
    } finally {
      setDeleteTarget(null);
    }
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setBranchFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchText('');
  };

  // أزرار الإجراءات حسب الحالة والصلاحية
  const renderActions = (v: { voucherId: string; status: string; voucherType: string }, compact = true) => {
    const type: VoucherType = v.voucherType === 'payment' ? 'payment' : 'receipt';
    const allowed = getAllowedVoucherTransitions(type, v.status as VoucherStatus);
    const size = compact ? 'sm' : 'default';
    return (
      <div className="flex flex-wrap gap-1.5">
        {compact && (
          <Button size={size} variant="outline" onClick={() => setPreviewId(v.voucherId)} title="معاينة">
            <Eye className="w-4 h-4" />
          </Button>
        )}
        <Button size={size} variant="outline" onClick={() => handlePrint(v.voucherId)} title="طباعة">
          <Printer className="w-4 h-4" />
          {!compact && <span className="mr-1">طباعة</span>}
        </Button>
        {isApprover && allowed.includes('approved') && (
          <Button
            size={size}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setConfirmAction({ voucherId: v.voucherId, status: 'approved', type })}
            disabled={updateStatusMutation.isPending}
            title="اعتماد"
          >
            <CheckCircle className="w-4 h-4" />
            {!compact && <span className="mr-1">اعتماد</span>}
          </Button>
        )}
        {isApprover && allowed.includes('paid') && (
          <Button
            size={size}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setConfirmAction({ voucherId: v.voucherId, status: 'paid', type })}
            disabled={updateStatusMutation.isPending}
            title="تسجيل الصرف"
          >
            <Banknote className="w-4 h-4" />
            {!compact && <span className="mr-1">تم الصرف</span>}
          </Button>
        )}
        {isApprover && allowed.includes('cancelled') && (
          <Button
            size={size}
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => {
              setCancelReason('');
              setCancelTarget({ voucherId: v.voucherId, type });
            }}
            title="إلغاء السند"
          >
            <XCircle className="w-4 h-4" />
            {!compact && <span className="mr-1">إلغاء</span>}
          </Button>
        )}
        {isAdmin && v.status === 'draft' && (
          <Button size={size} variant="destructive" onClick={() => setDeleteTarget(v.voucherId)} title="حذف المسودة">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  const previewHtml = useMemo(() => {
    if (!previewQuery.data) return '';
    return renderVoucherHtml(previewQuery.data, { assetBaseUrl: window.location.origin });
  }, [previewQuery.data]);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        {/* رأس الصفحة */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">السندات المالية</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              سندات القبض والصرف الرسمية - التوقيعات والختم تظهر بعد اعتماد الإدارة فقط
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => (window.location.href = '/vouchers-report')}>
              <FileText className="w-4 h-4 ml-2" />
              تقرير السندات
            </Button>
            {canCreate && (
              <Button
                onClick={() => setShowCreate(true)}
                className={activeType === 'receipt' ? 'bg-[#1f3a5f] hover:bg-[#16304f] text-white' : 'bg-[#7a1f1f] hover:bg-[#641818] text-white'}
              >
                <Plus className="w-4 h-4 ml-2" />
                {titles.ar} جديد
              </Button>
            )}
          </div>
        </div>

        {/* التبويبات */}
        <Tabs value={activeType} onValueChange={value => switchVoucherType(value as VoucherType)}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="receipt" className="gap-2">
              <ArrowDownCircle className="w-4 h-4" />
              سندات القبض
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <ArrowUpCircle className="w-4 h-4" />
              سندات الصرف
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* بطاقات الملخص (لا تُعرض أصفاراً عند فشل التحميل) */}
        {!vouchersQuery.error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">عدد السندات</p>
              <p className="text-2xl font-bold">{summary.count}</p>
              {summary.cancelledCount > 0 && (
                <p className="text-xs text-muted-foreground mt-1">+ {summary.cancelledCount} ملغي (غير محتسب)</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">إجمالي المبالغ</p>
              <p className="text-2xl font-bold">{formatVoucherAmount(summary.total)} <span className="text-sm">ر.س</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-4 h-4" /> بانتظار الاعتماد</p>
              <p className="text-2xl font-bold text-amber-600">{summary.draftCount}</p>
              <p className="text-xs text-muted-foreground">{formatVoucherAmount(summary.draftTotal)} ر.س</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle className="w-4 h-4" /> معتمد</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.signedCount}</p>
              <p className="text-xs text-muted-foreground">{formatVoucherAmount(summary.signedTotal)} ر.س</p>
            </CardContent>
          </Card>
        </div>
        )}

        {/* الفلاتر */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
              <div>
                <Label>الحالة</Label>
                <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="draft">مسودة - بانتظار الاعتماد</SelectItem>
                    <SelectItem value="approved">معتمد</SelectItem>
                    {activeType === 'payment' && <SelectItem value="paid">تم الصرف</SelectItem>}
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isApprover && (
                <div>
                  <Label>الفرع</Label>
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>من تاريخ</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>إلى تاريخ</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div>
                <Label>بحث</Label>
                <Input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="رقم السند أو الاسم" />
              </div>
              <Button variant="outline" onClick={resetFilters}>
                <RotateCcw className="w-4 h-4 ml-2" />
                إعادة تعيين
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* جدول السندات */}
        <Card>
          <CardHeader>
            <CardTitle>{activeType === 'receipt' ? 'قائمة سندات القبض' : 'قائمة سندات الصرف'}</CardTitle>
            <CardDescription>{vouchersQuery.error ? "—" : `${vouchers.length} سند`}</CardDescription>
            {vouchers.length >= VOUCHER_LIST_LIMIT && (
              <p className="text-xs text-yellow-600">
                يُعرض أحدث {VOUCHER_LIST_LIMIT} سند فقط، والملخص أعلاه يشملها وحدها. ضيّق نطاق التاريخ لعرض النتائج كاملة.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {vouchersQuery.isLoading ? (
              <div className="text-center py-8">جاري التحميل...</div>
            ) : vouchersQuery.error ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-red-600">تعذر تحميل السندات: {vouchersQuery.error.message}</p>
                <Button variant="outline" size="sm" onClick={() => vouchersQuery.refetch()}>إعادة المحاولة</Button>
              </div>
            ) : vouchers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {activeType === 'receipt' ? 'لا توجد سندات قبض' : 'لا توجد سندات صرف'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-right py-3 px-3">رقم السند</th>
                      <th className="text-right py-3 px-3">التاريخ</th>
                      <th className="text-right py-3 px-3">{titles.partyAr}</th>
                      {activeType === 'receipt' && <th className="text-right py-3 px-3">المستلم</th>}
                      <th className="text-right py-3 px-3">الفرع</th>
                      <th className="text-right py-3 px-3">البيان</th>
                      <th className="text-right py-3 px-3">طريقة الدفع</th>
                      <th className="text-right py-3 px-3">المبلغ</th>
                      <th className="text-right py-3 px-3">الحالة</th>
                      <th className="text-right py-3 px-3">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map(v => (
                      <tr
                        key={v.id}
                        className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${v.status === 'cancelled' ? 'opacity-60' : ''}`}
                      >
                        <td className="py-3 px-3 font-mono font-semibold whitespace-nowrap">{v.voucherId}</td>
                        <td className="py-3 px-3 whitespace-nowrap">{formatVoucherDate(v.voucherDate)}</td>
                        <td className="py-3 px-3">{v.partyName || v.payeeName}</td>
                        {activeType === 'receipt' && <td className="py-3 px-3">{v.payeeName}</td>}
                        <td className="py-3 px-3">{v.branchName || '-'}</td>
                        <td className="py-3 px-3 max-w-[220px] truncate" title={v.description || ''}>{v.description || '-'}</td>
                        <td className="py-3 px-3 text-xs">{formatPaymentSplitText(v) || '-'}</td>
                        <td className={`py-3 px-3 font-bold whitespace-nowrap ${v.status === 'cancelled' ? 'line-through' : ''}`}>
                          {formatVoucherAmount(v.totalAmount)} ر.س
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className={statusBadgeClass(v.status)}>
                            {getVoucherStatusLabel(v.status, activeType).ar}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">{renderActions(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* إنشاء سند */}
      {showCreate && (
        <VoucherFormDialog
          type={activeType}
          open={showCreate}
          onOpenChange={setShowCreate}
          isApprover={isApprover}
          branches={branches}
          userBranch={userBranch}
          userName={user?.name || user?.username || ''}
          onCreated={voucherId => {
            refresh();
            setPreviewId(voucherId);
          }}
        />
      )}

      {/* معاينة السند */}
      <Dialog open={!!previewId} onOpenChange={open => !open && setPreviewId(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>معاينة السند {previewId}</DialogTitle>
            <DialogDescription>
              {previewQuery.data && !isVoucherSigned(previewQuery.data.status)
                ? 'التوقيعات والختم تظهر بعد اعتماد المدير'
                : 'نسخة معتمدة'}
            </DialogDescription>
          </DialogHeader>
          {previewQuery.isLoading ? (
            <div className="text-center py-12">جاري التحميل...</div>
          ) : previewQuery.error ? (
            <div className="text-center py-12 text-red-600">{previewQuery.error.message}</div>
          ) : previewHtml ? (
            <iframe
              title="voucher-preview"
              srcDoc={previewHtml}
              sandbox="allow-same-origin"
              className="w-full h-[70vh] border rounded bg-white"
            />
          ) : null}
          {previewQuery.data && (
            <DialogFooter className="flex flex-wrap gap-2 sm:justify-between">
              {renderActions(previewQuery.data, false)}
              <div className="flex flex-wrap gap-2">
                {/* السند الملغي لا يُرسل بالبريد */}
                {previewQuery.data.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    onClick={() => handleSendEmail(previewQuery.data!.voucherId)}
                    disabled={sendEmailMutation.isPending}
                  >
                    <Mail className="w-4 h-4 ml-2" />
                    {sendEmailMutation.isPending ? 'جاري الإرسال...' : 'إرسال بالبريد'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleDownloadPdf(previewQuery.data!.voucherId)}
                  disabled={generatePDFMutation.isPending}
                >
                  <Download className="w-4 h-4 ml-2" />
                  {generatePDFMutation.isPending ? 'جاري...' : 'تحميل PDF'}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* تأكيد الاعتماد / الصرف */}
      <AlertDialog open={!!confirmAction} onOpenChange={open => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.status === 'approved' ? 'اعتماد السند' : 'تسجيل صرف السند'} {confirmAction?.voucherId}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.status === 'approved'
                ? 'بعد الاعتماد تظهر توقيعات المشرف العام والمدير العام وختم الشركة على السند، ولا يمكن تعديله (يمكن إلغاؤه فقط).'
                : 'سيتم تسجيل أن مبلغ سند الصرف قد صُرف فعلياً. هذه حالة نهائية.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmStatus} className="bg-emerald-600 hover:bg-emerald-700">
              {updateStatusMutation.isPending ? 'جاري التنفيذ...' : 'تأكيد'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* الإلغاء مع السبب */}
      <Dialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إلغاء السند {cancelTarget?.voucherId}</DialogTitle>
            <DialogDescription>السند الملغي يبقى في السجل للمراجعة ولا يدخل في الإجماليات.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>سبب الإلغاء *</Label>
            <Textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="اكتب سبب الإلغاء" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>تراجع</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? 'جاري الإلغاء...' : 'إلغاء السند'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المسودة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف السند رقم {deleteTarget}؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

// ==================== نموذج إنشاء سند ====================

function VoucherFormDialog({
  type,
  open,
  onOpenChange,
  isApprover,
  branches,
  userBranch,
  userName,
  onCreated,
}: {
  type: VoucherType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isApprover: boolean;
  branches: Array<{ id: number; name: string }>;
  userBranch: { id: number; name: string } | null;
  userName: string;
  onCreated: (voucherId: string) => void;
}) {
  const isReceipt = type === 'receipt';
  const titles = VOUCHER_TITLES[type];
  const [form, setForm] = useState<VoucherForm>(() => emptyForm(type, userBranch?.id));
  const createMutation = trpc.receiptVoucher.create.useMutation();

  const set = <K extends keyof VoucherForm>(key: K, value: VoucherForm[K]) => setForm(prev => ({ ...prev, [key]: value }));

  // الفرع المعروض: المشرف فرعه فقط
  const selectedBranchName = isApprover
    ? branches.find(b => String(b.id) === form.branchId)?.name ?? ''
    : userBranch?.name ?? '';
  const defaultPartyName = [selectedBranchName, userName].filter(Boolean).join(' - ');

  // البنود والإجمالي (نفس دالة الخادم)
  const computed = useMemo(
    () =>
      computeVoucherItems(
        form.items.map(item => ({
          description: item.description,
          quantity: item.quantity === '' ? null : item.quantity,
          unitPrice: item.unitPrice === '' ? null : item.unitPrice,
          amount: null,
        }))
      ),
    [form.items]
  );
  const total = computed.ok ? computed.total : roundMoney(
    form.items.reduce((s, item) => s + toNumber(item.quantity || '1') * toNumber(item.unitPrice), 0)
  );

  // توزيع الدفع: نقداً افتراضياً حتى يعدّل المستخدم التوزيع
  const bankAmount = toNumber(form.bankAmount);
  const checkAmount = toNumber(form.checkAmount);
  const cashAmount = form.cashManual ? toNumber(form.cashAmount) : roundMoney(Math.max(0, total - bankAmount - checkAmount));
  const splitSum = roundMoney(cashAmount + bankAmount + checkAmount);
  const splitDiff = roundMoney(total - splitSum);

  const splitCheck = useMemo(() => {
    if (!computed.ok) return { ok: false as const, error: computed.error };
    const r = resolvePaymentSplit(computed.total, { cashAmount, bankAmount, checkAmount });
    if (!r.ok) return r;
    const detailsError = validatePaymentDetails(r.split, { checkNumber: form.checkNumber, checkDate: form.checkDate || null });
    return detailsError ? { ok: false as const, error: detailsError } : r;
  }, [computed, cashAmount, bankAmount, checkAmount, form.checkNumber, form.checkDate]);

  const updateItem = (index: number, patch: Partial<FormItem>) =>
    setForm(prev => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const putAllIn = (method: 'cash' | 'bank' | 'check') =>
    setForm(prev => ({
      ...prev,
      cashManual: false,
      cashAmount: '',
      bankAmount: method === 'bank' ? String(total) : '',
      checkAmount: method === 'check' ? String(total) : '',
    }));

  const handleSubmit = async () => {
    if (isReceipt && !form.payeeName) {
      toast.error('يرجى اختيار المستلم');
      return;
    }
    if (!isReceipt && !form.partyName.trim()) {
      toast.error('يرجى إدخال اسم المصروف له');
      return;
    }
    if (!computed.ok) {
      toast.error(computed.error);
      return;
    }
    if (!splitCheck.ok) {
      toast.error(splitCheck.error);
      return;
    }
    if (form.dueDateFrom && form.dueDateTo && form.dueDateFrom > form.dueDateTo) {
      toast.error('تاريخ بداية الفترة يجب أن يكون قبل نهايتها');
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        voucherType: type,
        voucherDate: form.voucherDate,
        dueDateFrom: form.dueDateFrom || null,
        dueDateTo: form.dueDateTo || null,
        branchId: isApprover && form.branchId !== NO_BRANCH ? parseInt(form.branchId, 10) : undefined,
        // سند القبض بدون اسم: الخادم يضع "الفرع - المستخدم" افتراضياً
        partyName: form.partyName.trim() || null,
        partyType: form.partyType,
        payeeName: isReceipt ? form.payeeName : form.partyName.trim(),
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        items: form.items.map(item => ({
          description: item.description.trim(),
          quantity: item.quantity === '' ? 1 : toNumber(item.quantity),
          unitPrice: toNumber(item.unitPrice),
        })),
        cashAmount,
        bankAmount,
        checkAmount,
        bankName: bankAmount > 0 ? form.bankName.trim() || null : null,
        bankReference: bankAmount > 0 ? form.bankReference.trim() || null : null,
        checkNumber: checkAmount > 0 ? form.checkNumber.trim() || null : null,
        checkDate: checkAmount > 0 ? form.checkDate || null : null,
        checkBank: checkAmount > 0 ? form.checkBank.trim() || null : null,
      });
      toast.success(`تم إنشاء ${titles.ar} ${result.voucherId} - بانتظار اعتماد الإدارة`);
      onOpenChange(false);
      onCreated(result.voucherId);
    } catch (error: any) {
      toast.error(error?.message || 'فشل في إنشاء السند');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReceipt ? <ArrowDownCircle className="w-5 h-5 text-[#1f3a5f]" /> : <ArrowUpCircle className="w-5 h-5 text-[#7a1f1f]" />}
            {titles.ar} جديد <span className="text-sm text-muted-foreground font-normal">/ New {titles.en}</span>
          </DialogTitle>
          <DialogDescription>
            {isReceipt ? 'تسليم واستلام المبالغ - يُعتمد من المدير قبل ظهور التوقيعات والختم' : 'صرف مبلغ لطرف - يُعتمد من المدير ثم يُسجّل الصرف'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* التاريخ والفرع */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>تاريخ السند *</Label>
              <Input type="date" value={form.voucherDate} onChange={e => set('voucherDate', e.target.value)} disabled={!isApprover} />
              {!isApprover && <p className="text-xs text-muted-foreground mt-1">تاريخ اليوم تلقائياً</p>}
            </div>
            <div>
              <Label>الفرع</Label>
              {isApprover ? (
                <Select value={form.branchId} onValueChange={value => set('branchId', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BRANCH}>الإدارة (بدون فرع)</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input value={userBranch?.name || 'غير محدد'} disabled />
                  <p className="text-xs text-muted-foreground mt-1">يُحدد تلقائياً حسب فرع المشرف</p>
                </>
              )}
            </div>
          </div>

          {/* الطرف */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Label>{titles.partyAr} {isReceipt ? '' : '*'}</Label>
              <Input
                value={form.partyName}
                onChange={e => set('partyName', e.target.value)}
                placeholder={isReceipt ? defaultPartyName || 'اسم الدافع' : 'اسم المورد / الموظف / الجهة'}
                maxLength={255}
              />
              {isReceipt && !form.partyName && defaultPartyName && (
                <p className="text-xs text-muted-foreground mt-1">افتراضياً: {defaultPartyName}</p>
              )}
            </div>
            <div>
              <Label>نوع الطرف</Label>
              <Select value={form.partyType} onValueChange={value => set('partyType', value as VoucherPartyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOUCHER_PARTY_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{VOUCHER_PARTY_TYPE_LABELS[t].ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isReceipt && (
            <div>
              <Label>المستلم (Received by) *</Label>
              <Select value={form.payeeName} onValueChange={value => set('payeeName', value)}>
                <SelectTrigger><SelectValue placeholder="اختر المستلم" /></SelectTrigger>
                <SelectContent>
                  {RECIPIENTS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <Label>وذلك عن (Being for)</Label>
              <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="الغرض من السند" maxLength={2000} />
            </div>
            <div>
              <Label>الفترة من</Label>
              <Input type="date" value={form.dueDateFrom} onChange={e => set('dueDateFrom', e.target.value)} />
            </div>
            <div>
              <Label>الفترة إلى</Label>
              <Input type="date" value={form.dueDateTo} onChange={e => set('dueDateTo', e.target.value)} />
            </div>
          </div>

          {/* البنود */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">البنود</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setForm(prev => ({ ...prev, items: [...prev.items, { description: '', quantity: '1', unitPrice: '' }] }))}
                disabled={form.items.length >= 100}
              >
                <Plus className="w-4 h-4 ml-1" />
                إضافة بند
              </Button>
            </div>
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
              <span className="col-span-6">البيان</span>
              <span className="col-span-2">الكمية</span>
              <span className="col-span-2">سعر الوحدة</span>
              <span className="col-span-2">الإجمالي</span>
            </div>
            {form.items.map((item, index) => {
              const lineTotal = roundMoney(toNumber(item.quantity || '1') * toNumber(item.unitPrice));
              return (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-12 sm:col-span-6"
                    value={item.description}
                    onChange={e => updateItem(index, { description: e.target.value })}
                    placeholder={`وصف البند ${index + 1}`}
                    maxLength={500}
                  />
                  <Input
                    className="col-span-3 sm:col-span-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={e => updateItem(index, { quantity: e.target.value })}
                    placeholder="1"
                  />
                  <Input
                    className="col-span-4 sm:col-span-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={e => updateItem(index, { unitPrice: e.target.value })}
                    placeholder="0.00"
                  />
                  <div className="col-span-4 sm:col-span-1 text-sm font-semibold text-left" dir="ltr">{formatVoucherAmount(lineTotal)}</div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="col-span-1 text-red-500"
                    onClick={() => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))}
                    disabled={form.items.length <= 1}
                    title="حذف البند"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* الإجمالي والتفقيط */}
          <div className={`rounded-lg p-4 ${isReceipt ? 'bg-[#eef3f9] dark:bg-blue-950/30' : 'bg-[#fbf0f0] dark:bg-red-950/30'}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">الإجمالي / Total</span>
              <span className="text-2xl font-bold" dir="ltr">{formatVoucherAmount(total)} SAR</span>
            </div>
            <p className="text-sm mt-2">{amountToArabicWords(total)}</p>
            <p className="text-xs text-muted-foreground mt-1" dir="ltr">{amountToEnglishWords(total)}</p>
            {!computed.ok && form.items.some(i => i.description || i.unitPrice) && (
              <p className="text-xs text-red-600 mt-2">{computed.error}</p>
            )}
          </div>

          {/* طريقة الدفع */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">طريقة الدفع</h3>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => putAllIn('cash')}>كامل المبلغ نقداً</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => putAllIn('bank')}>كامل المبلغ حوالة</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => putAllIn('check')}>كامل المبلغ شيك</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label>نقداً (Cash){!form.cashManual && <span className="text-xs text-muted-foreground"> - تلقائي (الباقي)</span>}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cashManual ? form.cashAmount : cashAmount ? String(cashAmount) : ''}
                  onChange={e => setForm(prev => ({ ...prev, cashManual: true, cashAmount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label>حوالة بنكية (Bank)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bankAmount}
                  onChange={e => set('bankAmount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {bankAmount > 0 && (
                <>
                  <div className="sm:col-span-2">
                    <Label>اسم البنك</Label>
                    <Input value={form.bankName} onChange={e => set('bankName', e.target.value)} maxLength={100} />
                  </div>
                  <div>
                    <Label>رقم المرجع / العملية</Label>
                    <Input value={form.bankReference} onChange={e => set('bankReference', e.target.value)} maxLength={100} />
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <Label>شيك (Cheque)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.checkAmount}
                  onChange={e => set('checkAmount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {checkAmount > 0 && (
                <>
                  <div>
                    <Label>رقم الشيك *</Label>
                    <Input value={form.checkNumber} onChange={e => set('checkNumber', e.target.value)} maxLength={50} />
                  </div>
                  <div>
                    <Label>تاريخ الشيك *</Label>
                    <Input type="date" value={form.checkDate} onChange={e => set('checkDate', e.target.value)} />
                  </div>
                  <div>
                    <Label>بنك الشيك</Label>
                    <Input value={form.checkBank} onChange={e => set('checkBank', e.target.value)} maxLength={100} />
                  </div>
                </>
              )}
            </div>

            <div
              className={`text-sm rounded-md px-3 py-2 ${
                splitCheck.ok
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
              }`}
            >
              {splitCheck.ok ? (
                <>✓ {formatPaymentSplitText({ ...splitCheck.split, totalAmount: total })}</>
              ) : (
                <>
                  مجموع طرق الدفع {formatVoucherAmount(splitSum)} من {formatVoucherAmount(total)}
                  {splitDiff !== 0 && <> (الفرق {formatVoucherAmount(Math.abs(splitDiff))} {splitDiff > 0 ? 'ناقص' : 'زائد'})</>}
                  {' - '}{splitCheck.error}
                </>
              )}
            </div>
          </div>

          {/* الملاحظات */}
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="ملاحظات اختيارية" maxLength={2000} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="w-4 h-4 ml-2" />
            {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ السند'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
