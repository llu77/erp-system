/**
 * لوحة الوثائق: كل الموظفين النشطين ووثائقهم الثلاث (الإقامة، الشهادة الصحية، العقد)
 * بالحالة (منتهية / حرجة / قريبة / سارية / بدون تاريخ)، مع الفلاتر والتقويم والرفع من أي صف
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileQuestion,
  FileSignature,
  FolderOpen,
  HeartPulse,
  IdCard,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_WARNING_DAYS,
  EXPIRING_DOCUMENT_KINDS,
  compareDocumentStatus,
  formatArabicDate,
  worstDocumentStatus,
  type DocumentStatus,
  type ExpiringDocumentKind,
} from "@shared/employeeFile";
import {
  DocumentsCalendar,
  type CalendarEntry,
} from "@/components/employees/DocumentsCalendar";
import { EmployeeFileDialog } from "@/components/employees/EmployeeFileDialog";
import {
  DocumentFileActions,
  DocumentStatusBadge,
  EmployeeAvatar,
  LoadingState,
  QueryErrorState,
} from "@/components/employees/EmployeeFileParts";
import type { DocumentsOverviewItem } from "@/components/employees/types";
import {
  canManageEmployees,
  canOpenEmployeeFiles,
  canViewDocumentsDashboard,
  errorMessage,
} from "@/components/employees/utils";

type StatusFilter = "all" | "attention" | DocumentStatus;
type KindFilter = "all" | ExpiringDocumentKind;

const STATUS_ORDER: DocumentStatus[] = [
  "expired",
  "critical",
  "warning",
  "missing",
  "valid",
];
const ATTENTION: DocumentStatus[] = ["expired", "critical", "warning"];

const KIND_ICONS: Record<ExpiringDocumentKind, typeof IdCard> = {
  iqama: IdCard,
  health: HeartPulse,
  contract: FileSignature,
};

const STATUS_CARD: Record<
  DocumentStatus,
  { icon: typeof AlertTriangle; className: string; hint: string }
> = {
  expired: {
    icon: AlertTriangle,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    hint: "تتطلب إجراءً فورياً",
  },
  critical: {
    icon: ShieldAlert,
    className:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    hint: "خلال 7 أيام",
  },
  warning: {
    icon: Clock,
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    hint: `خلال ${DOCUMENT_WARNING_DAYS.iqama} يوماً (العقد ${DOCUMENT_WARNING_DAYS.contract})`,
  },
  missing: {
    icon: FileQuestion,
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    hint: "تاريخ الانتهاء غير مسجل",
  },
  valid: {
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    hint: "سارية المفعول",
  },
};

function matchesStatus(status: DocumentStatus, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "attention") return ATTENTION.includes(status);
  return status === filter;
}

function DocumentCell({
  row,
  kind,
  canEdit,
  highlighted,
}: {
  row: DocumentsOverviewItem;
  kind: ExpiringDocumentKind;
  canEdit: boolean;
  highlighted: boolean;
}) {
  const doc = row[kind];
  return (
    <div
      className={cn("space-y-1 rounded-md p-1", !highlighted && "opacity-50")}
    >
      <div className="text-sm font-medium">
        {doc.expiry ? formatArabicDate(doc.expiry) : "—"}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <DocumentStatusBadge status={doc.status} daysLeft={doc.daysLeft} />
        <DocumentFileActions
          employeeId={row.employeeId}
          kind={kind}
          url={doc.imageUrl}
          canEdit={canEdit}
          iconOnly
        />
      </div>
    </div>
  );
}

export default function DocumentsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const role = user?.role;
  const canView = canViewDocumentsDashboard(role);
  const canEdit = canOpenEmployeeFiles(role);
  const canExport = canManageEmployees(role);

  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("attention");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [fileEmployeeId, setFileEmployeeId] = useState<number | null>(null);

  const overviewQuery = trpc.employees.getDocumentsOverview.useQuery(
    undefined,
    { enabled: canView }
  );
  const branchesQuery = trpc.branches.list.useQuery(undefined, {
    enabled: canView,
  });

  const exportReport = trpc.cashFlow.exportDocumentsReport.useMutation({
    onSuccess: data => {
      const printWindow = window.open(
        data.url,
        "_blank",
        "width=1000,height=700"
      );
      if (printWindow) {
        printWindow.focus();
        toast.success("تم فتح التقرير للطباعة");
      } else {
        window.location.href = data.url;
      }
    },
    onError: error => toast.error(errorMessage(error, "فشل تصدير التقرير")),
  });

  const kinds = useMemo<ExpiringDocumentKind[]>(
    () => (kindFilter === "all" ? EXPIRING_DOCUMENT_KINDS : [kindFilter]),
    [kindFilter]
  );

  // الموظفون بعد فلتر الفرع والبحث (قبل فلتر الحالة) - للعدادات
  const scopedRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return (overviewQuery.data?.rows ?? []).filter(row => {
      const matchesBranch =
        branchFilter === "all" || String(row.branchId) === branchFilter;
      const matchesSearch =
        !term ||
        row.name.toLowerCase().includes(term) ||
        row.code.toLowerCase().includes(term) ||
        (row.iqamaNumber ?? "").includes(term) ||
        (row.branchName ?? "").toLowerCase().includes(term);
      return matchesBranch && matchesSearch;
    });
  }, [overviewQuery.data, branchFilter, searchTerm]);

  const counts = useMemo(() => {
    const result: Record<DocumentStatus, number> = {
      expired: 0,
      critical: 0,
      warning: 0,
      missing: 0,
      valid: 0,
    };
    const byKind = Object.fromEntries(
      EXPIRING_DOCUMENT_KINDS.map(kind => [
        kind,
        { expired: 0, critical: 0, warning: 0, missing: 0, valid: 0 },
      ])
    ) as Record<ExpiringDocumentKind, Record<DocumentStatus, number>>;
    for (const row of scopedRows) {
      for (const kind of kinds) {
        result[row[kind].status]++;
        byKind[kind][row[kind].status]++;
      }
    }
    const total = scopedRows.length * kinds.length;
    return {
      result,
      byKind,
      total,
      compliance: total ? Math.round((result.valid / total) * 100) : 0,
    };
  }, [scopedRows, kinds]);

  // الصفوف المعروضة: موظف فيه وثيقة واحدة على الأقل تطابق الحالة المختارة
  const visibleRows = useMemo(() => {
    return scopedRows
      .filter(row =>
        kinds.some(kind => matchesStatus(row[kind].status, statusFilter))
      )
      .map(row => ({
        row,
        worst: worstDocumentStatus(kinds.map(kind => row[kind].status)),
      }))
      .sort((a, b) => {
        const soonest = (r: DocumentsOverviewItem) =>
          Math.min(
            ...kinds.map(kind => r[kind].daysLeft ?? Number.POSITIVE_INFINITY)
          );
        return (
          compareDocumentStatus(a.worst, b.worst) ||
          soonest(a.row) - soonest(b.row) ||
          a.row.name.localeCompare(b.row.name, "ar")
        );
      });
  }, [scopedRows, statusFilter, kinds]);

  const calendarEntries = useMemo<CalendarEntry[]>(() => {
    const entries: CalendarEntry[] = [];
    for (const row of scopedRows) {
      for (const kind of kinds) {
        const doc = row[kind];
        if (doc.expiry && matchesStatus(doc.status, statusFilter)) {
          entries.push({
            employeeId: row.employeeId,
            employeeName: row.name,
            kind,
            expiry: doc.expiry,
            status: doc.status,
          });
        }
      }
    }
    return entries;
  }, [scopedRows, statusFilter, kinds]);

  if (authLoading) return <LoadingState />;

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h3 className="mb-2 text-lg font-medium">غير مصرح</h3>
          <p className="text-muted-foreground">
            لوحة الوثائق متاحة للإدارة والمشرفين فقط
          </p>
        </CardContent>
      </Card>
    );
  }

  const showBranchFilter = role !== "supervisor";
  const branches = branchesQuery.data ?? [];

  return (
    <div className="space-y-6 p-1">
      {/* العنوان */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white lg:flex-row lg:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold lg:text-3xl">
            <Shield className="h-8 w-8 text-amber-400" />
            لوحة الوثائق
          </h1>
          <p className="mt-2 text-slate-300">
            الإقامة والشهادة الصحية وعقد العمل لكل الموظفين النشطين - التواريخ
            بالتقويم الميلادي حسب توقيت الرياض
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => overviewQuery.refetch()}
            disabled={overviewQuery.isFetching}
            className="border-white/30 bg-transparent text-white hover:bg-white/10"
          >
            <RefreshCw
              className={cn(
                "ml-2 h-4 w-4",
                overviewQuery.isFetching && "animate-spin"
              )}
            />
            تحديث
          </Button>
          {canExport && (
            <Button
              onClick={() =>
                exportReport.mutate({
                  branchId:
                    branchFilter !== "all" ? Number(branchFilter) : undefined,
                })
              }
              disabled={exportReport.isPending}
              className="bg-amber-500 font-bold text-black hover:bg-amber-600"
            >
              <Download className="ml-2 h-4 w-4" />
              {exportReport.isPending ? "جاري التصدير..." : "تصدير PDF"}
            </Button>
          )}
        </div>
      </div>

      {overviewQuery.isLoading ? (
        <LoadingState label="جاري تحميل بيانات الوثائق..." />
      ) : overviewQuery.isError || !overviewQuery.data ? (
        <Card>
          <CardContent>
            <QueryErrorState
              title="تعذر تحميل بيانات الوثائق"
              error={overviewQuery.error}
              onRetry={() => overviewQuery.refetch()}
              retrying={overviewQuery.isFetching}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* الفلاتر */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو الكود أو رقم الإقامة..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                {showBranchFilter && (
                  <Select value={branchFilter} onValueChange={setBranchFilter}>
                    <SelectTrigger className="w-full lg:w-52">
                      <Building className="ml-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="جميع الفروع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={String(branch.id)}>
                          {branch.nameAr || branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={kindFilter}
                  onValueChange={value => setKindFilter(value as KindFilter)}
                >
                  <SelectTrigger className="w-full lg:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الوثائق</SelectItem>
                    {EXPIRING_DOCUMENT_KINDS.map(kind => (
                      <SelectItem key={kind} value={kind}>
                        {DOCUMENT_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={value =>
                    setStatusFilter(value as StatusFilter)
                  }
                >
                  <SelectTrigger className="w-full lg:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attention">
                      تحتاج متابعة (منتهية وقريبة)
                    </SelectItem>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    {STATUS_ORDER.map(status => (
                      <SelectItem key={status} value={status}>
                        {DOCUMENT_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {branchesQuery.isError && showBranchFilter && (
                <p className="mt-2 text-xs text-red-600">
                  تعذر تحميل الفروع.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => branchesQuery.refetch()}
                  >
                    إعادة المحاولة
                  </button>
                </p>
              )}
            </CardContent>
          </Card>

          {/* العدادات */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {STATUS_ORDER.map(status => {
              const { icon: Icon, className, hint } = STATUS_CARD[status];
              return (
                <button
                  type="button"
                  key={status}
                  onClick={() =>
                    setStatusFilter(current =>
                      current === status ? "all" : status
                    )
                  }
                  className={cn(
                    "rounded-xl border-2 p-4 text-right transition-shadow hover:shadow-md",
                    className,
                    statusFilter === status &&
                      "ring-2 ring-offset-2 ring-primary"
                  )}
                  aria-pressed={statusFilter === status}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" />
                    {DOCUMENT_STATUS_LABELS[status]}
                  </div>
                  <div className="mt-1 text-3xl font-black">
                    {counts.result[status]}
                  </div>
                  <div className="text-xs opacity-80">{hint}</div>
                </button>
              );
            })}
            <div className="rounded-xl border-2 p-4">
              <div className="text-sm font-semibold text-muted-foreground">
                نسبة الوثائق السارية
              </div>
              <div className="mt-1 text-3xl font-black text-emerald-600">
                {counts.compliance}%
              </div>
              <Progress value={counts.compliance} className="mt-2 h-2" />
              <div className="mt-1 text-xs text-muted-foreground">
                {scopedRows.length} موظف • {counts.total} وثيقة
              </div>
            </div>
          </div>

          {/* حسب نوع الوثيقة */}
          <div className="grid gap-3 md:grid-cols-3">
            {kinds.map(kind => {
              const Icon = KIND_ICONS[kind];
              const c = counts.byKind[kind];
              return (
                <Card key={kind}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <span className="flex items-center gap-2 font-semibold">
                      <Icon className="h-5 w-5 text-primary" />
                      {DOCUMENT_KIND_LABELS[kind]}
                    </span>
                    <div className="flex flex-wrap gap-1 text-xs">
                      <Badge
                        variant="outline"
                        className="border-red-300 text-red-700 dark:text-red-300"
                      >
                        منتهية {c.expired}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-orange-300 text-orange-700 dark:text-orange-300"
                      >
                        حرجة {c.critical}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700 dark:text-amber-300"
                      >
                        قريبة {c.warning}
                      </Badge>
                      <Badge variant="outline">بدون تاريخ {c.missing}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* الجدول */}
          <Card>
            <CardHeader>
              <CardTitle>وثائق الموظفين</CardTitle>
              <CardDescription>
                {visibleRows.length} موظف • الأكثر إلحاحاً أولاً
                {canEdit
                  ? " • يمكنك رفع أو استبدال صورة أي وثيقة من الجدول"
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {visibleRows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-emerald-500 opacity-60" />
                  <p className="text-lg font-medium">
                    لا توجد وثائق مطابقة للفلاتر
                  </p>
                  {statusFilter !== "all" && (
                    <Button
                      variant="link"
                      onClick={() => setStatusFilter("all")}
                    >
                      عرض كل الحالات
                    </Button>
                  )}
                </div>
              ) : isMobile ? (
                <div className="space-y-3">
                  {visibleRows.map(({ row, worst }) => (
                    <div
                      key={row.employeeId}
                      className="space-y-3 rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          name={row.name}
                          photoUrl={row.photoUrl}
                        />
                        <div className="flex-1">
                          <div className="font-bold">{row.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.code} • {row.branchName ?? "-"}
                          </div>
                        </div>
                        <DocumentStatusBadge status={worst} />
                      </div>
                      {kinds.map(kind => (
                        <div
                          key={kind}
                          className="flex items-start justify-between gap-2 border-t pt-2"
                        >
                          <span className="text-sm text-muted-foreground">
                            {DOCUMENT_KIND_LABELS[kind]}
                          </span>
                          <DocumentCell
                            row={row}
                            kind={kind}
                            canEdit={canEdit}
                            highlighted={matchesStatus(
                              row[kind].status,
                              statusFilter
                            )}
                          />
                        </div>
                      ))}
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setFileEmployeeId(row.employeeId)}
                        >
                          <FolderOpen className="ml-1 h-4 w-4" />
                          ملف الموظف
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        {kinds.map(kind => (
                          <TableHead key={kind} className="text-right">
                            {DOCUMENT_KIND_LABELS[kind]}
                          </TableHead>
                        ))}
                        {canEdit && (
                          <TableHead className="w-32 text-right">
                            الإجراءات
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map(({ row, worst }) => (
                        <TableRow
                          key={row.employeeId}
                          className={cn(
                            worst === "expired" &&
                              "bg-red-50/60 dark:bg-red-950/20",
                            worst === "critical" &&
                              "bg-orange-50/60 dark:bg-orange-950/20"
                          )}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <EmployeeAvatar
                                name={row.name}
                                photoUrl={row.photoUrl}
                              />
                              <div>
                                <div className="font-bold">{row.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {row.code}
                                  {row.iqamaNumber
                                    ? ` • ${row.iqamaNumber}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.branchName ?? "-"}
                          </TableCell>
                          {kinds.map(kind => (
                            <TableCell key={kind}>
                              <DocumentCell
                                row={row}
                                kind={kind}
                                canEdit={canEdit}
                                highlighted={matchesStatus(
                                  row[kind].status,
                                  statusFilter
                                )}
                              />
                            </TableCell>
                          ))}
                          {canEdit && (
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setFileEmployeeId(row.employeeId)
                                }
                              >
                                <FolderOpen className="ml-1 h-4 w-4" />
                                ملف الموظف
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* التقويم */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <CalendarDays className="h-6 w-6 text-primary" />
                تقويم تواريخ الانتهاء
              </CardTitle>
              <CardDescription>
                كل تواريخ الانتهاء المسجلة حسب الفلاتر المختارة
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsCalendar
                entries={calendarEntries}
                onSelect={
                  canEdit
                    ? entry => setFileEmployeeId(entry.employeeId)
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </>
      )}

      {fileEmployeeId !== null && (
        <EmployeeFileDialog
          key={fileEmployeeId}
          employeeId={fileEmployeeId}
          open
          initialTab="documents"
          onOpenChange={open => !open && setFileEmployeeId(null)}
        />
      )}
    </div>
  );
}
