/**
 * إنهاء الخدمة والمخالصات النهائية: القائمة والإنشاء
 * ?new=1 (و&employeeId= اختيارياً) يفتح نموذج الإنشاء مباشرة (من صفحة الطلبات)
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import {
  AlertTriangle,
  Banknote,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { END_OF_SERVICE_STATUSES, END_OF_SERVICE_STATUS_LABELS, type EndOfServiceStatus } from '@shared/endOfService';
import { formatVoucherDate, formatVoucherDateTime } from '@shared/vouchers';
import EndOfServiceForm from '@/components/endOfService/EndOfServiceForm';
import { EndOfServiceStatusBadge } from '@/components/endOfService/EndOfServiceStatusBadge';
import type { EosListRow } from '@/components/endOfService/types';
import { canManageEndOfService, canViewEndOfService, formatSar, retryUnlessFinal } from '@/components/endOfService/utils';

type StatusFilter = EndOfServiceStatus | 'all';

function NetAmount({ value, cancelled }: { value: number; cancelled: boolean }) {
  const negative = value < 0;
  return (
    <span className={`font-bold whitespace-nowrap tabular-nums ${cancelled ? 'line-through opacity-70' : ''} ${negative ? 'text-red-600 dark:text-red-400' : ''}`}>
      {formatSar(Math.abs(value))}
      {negative && <span className="block text-[11px] font-normal">مستحق على الموظف</span>}
    </span>
  );
}

export default function EndOfService() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const role = user?.role;
  const canView = canViewEndOfService(role);
  const isManager = canManageEndOfService(role);
  const showBranchFilter = canView && role !== 'supervisor';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createEmployeeId, setCreateEmployeeId] = useState<number | null>(null);

  // فتح نموذج الإنشاء من الرابط (?new=1&employeeId=)
  useEffect(() => {
    if (!isManager) return;
    const params = new URLSearchParams(search);
    if (params.get('new') !== '1') return;
    const employeeId = Number(params.get('employeeId'));
    setCreateEmployeeId(Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null);
    setShowCreate(true);
  }, [search, isManager]);

  const handleCreateOpenChange = (open: boolean) => {
    setShowCreate(open);
    // إزالة ?new=1 حتى لا يُفتح النموذج مجدداً عند التحديث
    if (!open && new URLSearchParams(search).get('new')) navigate('/end-of-service', { replace: true });
  };

  const openCreate = () => {
    setCreateEmployeeId(null);
    setShowCreate(true);
  };

  const branchesQuery = trpc.branches.list.useQuery(undefined, { enabled: showBranchFilter });
  const branches = branchesQuery.data ?? [];

  const listQuery = trpc.endOfService.list.useQuery(
    {
      status: statusFilter === 'all' ? undefined : statusFilter,
      branchId: showBranchFilter && branchFilter !== 'all' ? Number(branchFilter) : undefined,
    },
    { enabled: canView, retry: retryUnlessFinal }
  );
  const rows: EosListRow[] = listQuery.data ?? [];

  const filteredRows = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      r =>
        r.employeeName.toLowerCase().includes(term) ||
        r.employeeCode.toLowerCase().includes(term) ||
        r.settlementNumber.toLowerCase().includes(term)
    );
  }, [rows, searchText]);

  // ملخص الحالات (يُعرض فقط بدون فلتر حالة حتى لا يضلل)
  const summary = useMemo(() => {
    const count = (status: string) => rows.filter(r => r.status === status).length;
    const paidTotal = rows.filter(r => r.status === 'paid').reduce((sum, r) => sum + Math.max(0, r.netAmount), 0);
    return { draft: count('draft'), approved: count('approved'), paid: count('paid'), paidTotal };
  }, [rows]);

  const resetFilters = () => {
    setStatusFilter('all');
    setBranchFilter('all');
    setSearchText('');
  };
  const hasFilters = statusFilter !== 'all' || branchFilter !== 'all' || searchText.trim() !== '';

  if (authLoading) {
    return (
      <div className="space-y-4" dir="rtl">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!canView) {
    return (
      <Card dir="rtl">
        <CardContent className="py-12 text-center space-y-2">
          <ShieldAlert className="w-12 h-12 mx-auto text-red-500" />
          <h2 className="text-lg font-semibold">غير مصرح</h2>
          <p className="text-muted-foreground">صفحة إنهاء الخدمة متاحة للإدارة والمشرفين فقط</p>
        </CardContent>
      </Card>
    );
  }

  const summaryCards: Array<{ status: EndOfServiceStatus; label: string; value: number; sub?: string; icon: typeof Clock; color: string }> = [
    { status: 'draft', label: 'بانتظار الاعتماد', value: summary.draft, icon: Clock, color: 'text-amber-600' },
    { status: 'approved', label: 'معتمد - بانتظار الصرف', value: summary.approved, icon: CheckCircle, color: 'text-emerald-600' },
    { status: 'paid', label: 'تم الصرف', value: summary.paid, sub: formatSar(summary.paidTotal), icon: Banknote, color: 'text-blue-600' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* الرأس */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <UserX className="w-7 h-7 text-red-600 shrink-0" />
            إنهاء الخدمة والمخالصات النهائية
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            انتهاء العقد وعدم التجديد: خطاب إشعار رسمي ومخالصة نهائية وإبراء ذمة - التوقيعات والختم بعد اعتماد الإدارة فقط
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/manage-requests')}>
            <FileText className="w-4 h-4 ml-2" />
            إدارة الطلبات
          </Button>
          {isManager && (
            <Button onClick={openCreate} className="bg-red-700 hover:bg-red-800 text-white">
              <Plus className="w-4 h-4 ml-2" />
              إنهاء خدمة جديد
            </Button>
          )}
        </div>
      </div>

      {/* الملخص */}
      {statusFilter === 'all' && !listQuery.error && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summaryCards.map(card => (
            <button key={card.status} type="button" onClick={() => setStatusFilter(card.status)} className="text-right">
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <card.icon className="w-4 h-4" />
                    {card.label}
                  </p>
                  {listQuery.isLoading ? (
                    <Skeleton className="h-8 w-16 mt-1" />
                  ) : (
                    <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  )}
                  {card.sub && !listQuery.isLoading && <p className="text-xs text-muted-foreground">{card.sub}</p>}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* الفلاتر */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="mb-1.5 block">بحث</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="اسم الموظف أو الكود أو رقم المخالصة"
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">الحالة</Label>
              <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  {END_OF_SERVICE_STATUSES.map(status => (
                    <SelectItem key={status} value={status}>
                      {END_OF_SERVICE_STATUS_LABELS[status].ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showBranchFilter && (
              <div>
                <Label className="mb-1.5 block">الفرع</Label>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.nameAr || b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" onClick={resetFilters} disabled={!hasFilters}>
              <RotateCcw className="w-4 h-4 ml-2" />
              إعادة تعيين
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* القائمة */}
      <Card>
        <CardHeader>
          <CardTitle>المخالصات</CardTitle>
          <CardDescription>
            {listQuery.isLoading
              ? 'جاري التحميل...'
              : listQuery.error
                ? '—'
                : `${filteredRows.length} مخالصة${filteredRows.length !== rows.length ? ` من ${rows.length}` : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : listQuery.error ? (
            <div className="text-center py-10 space-y-3">
              <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
              <p className="text-red-600">تعذر تحميل المخالصات: {listQuery.error.message}</p>
              <Button variant="outline" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
                <RefreshCw className={`w-4 h-4 ml-2 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
                إعادة المحاولة
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <UserX className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <p className="font-medium">{statusFilter !== 'all' || branchFilter !== 'all' ? 'لا توجد مخالصات بهذه الفلاتر' : 'لا توجد مخالصات إنهاء خدمة بعد'}</p>
              {isManager && statusFilter === 'all' && branchFilter === 'all' && (
                <Button onClick={openCreate} variant="outline">
                  <Plus className="w-4 h-4 ml-2" />
                  إنهاء خدمة جديد
                </Button>
              )}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">لا توجد نتائج مطابقة للبحث</div>
          ) : (
            <>
              {/* الجوال: بطاقات */}
              <div className="space-y-3 md:hidden">
                {filteredRows.map(row => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => navigate(`/end-of-service/${row.id}`)}
                    className={`w-full text-right rounded-lg border p-3 hover:bg-muted/50 ${row.status === 'cancelled' ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{row.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{row.employeeCode}</span>
                          {row.branchName ? ` - ${row.branchName}` : ''}
                        </p>
                      </div>
                      <EndOfServiceStatusBadge status={row.status} />
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2 text-sm">
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p className="font-mono">{row.settlementNumber}</p>
                        <p>آخر يوم عمل: {formatVoucherDate(row.lastWorkingDay)}</p>
                      </div>
                      <NetAmount value={row.netAmount} cancelled={row.status === 'cancelled'} />
                    </div>
                  </button>
                ))}
              </div>

              {/* الشاشات الكبيرة: جدول */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-right py-3 px-3">رقم المخالصة</th>
                      <th className="text-right py-3 px-3">الموظف</th>
                      <th className="text-right py-3 px-3">الفرع</th>
                      <th className="text-right py-3 px-3">آخر يوم عمل</th>
                      <th className="text-right py-3 px-3">الصافي</th>
                      <th className="text-right py-3 px-3">الحالة</th>
                      <th className="text-right py-3 px-3">تاريخ الإنشاء</th>
                      <th className="text-right py-3 px-3">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map(row => (
                      <tr key={row.id} className={`border-b hover:bg-muted/40 ${row.status === 'cancelled' ? 'opacity-70' : ''}`}>
                        <td className="py-3 px-3 font-mono font-semibold whitespace-nowrap">{row.settlementNumber}</td>
                        <td className="py-3 px-3">
                          <p className="font-medium">{row.employeeName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{row.employeeCode}</p>
                        </td>
                        <td className="py-3 px-3">{row.branchName || '-'}</td>
                        <td className="py-3 px-3 whitespace-nowrap">{formatVoucherDate(row.lastWorkingDay)}</td>
                        <td className="py-3 px-3">
                          <NetAmount value={row.netAmount} cancelled={row.status === 'cancelled'} />
                        </td>
                        <td className="py-3 px-3">
                          <EndOfServiceStatusBadge status={row.status} />
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-muted-foreground">{formatVoucherDateTime(row.createdAt)}</td>
                        <td className="py-3 px-3">
                          <Button size="sm" variant="outline" onClick={() => navigate(`/end-of-service/${row.id}`)}>
                            <Eye className="w-4 h-4 ml-1.5" />
                            عرض
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {showCreate && isManager && (
        <EndOfServiceForm
          open={showCreate}
          onOpenChange={handleCreateOpenChange}
          initialEmployeeId={createEmployeeId}
          onCreated={id => navigate(`/end-of-service/${id}`)}
        />
      )}
    </div>
  );
}
