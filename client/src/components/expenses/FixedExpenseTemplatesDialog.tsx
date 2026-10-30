/**
 * إدارة المصاريف الثابتة (للمسؤول فقط): بنود شهرية لكل فرع تُضاف تلقائياً كل شهر
 * - إضافة بند، تعديل اسمه وتصنيفه ومبلغه وطريقة دفعه، إيقافه أو إعادة تفعيله
 * - التعديل يسري على الشهور التي لم تُضف بعد؛ مصروف الشهر الحالي المضاف لا يتغير
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Loader2, Pencil, Plus, Power, PowerOff, Save, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_METHOD_LABELS,
  MANUAL_EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
  type ExpensePaymentMethod,
  type ManualExpenseCategory,
} from "@shared/expenses";
import { arabicMonthName } from "@shared/employeeDocumentBase";
import { formatVoucherAmount } from "@shared/vouchers";

interface TemplateForm {
  id?: number;
  branchId: string;
  category: ManualExpenseCategory;
  title: string;
  amount: string;
  paymentMethod: ExpensePaymentMethod;
  isActive: boolean;
}

const EMPTY_FORM: TemplateForm = {
  branchId: "",
  category: "shop_rent",
  title: "",
  amount: "",
  paymentMethod: "cash",
  isActive: true,
};

const sar = (value: number) => `${formatVoucherAmount(value)} ر.س`;

function startsOnLabel(startsOn: string): string {
  const [year, month] = startsOn.split("-").map(Number);
  return year && month ? `${arabicMonthName(month)} ${year}` : startsOn;
}

export function FixedExpenseTemplatesDialog({
  open,
  onOpenChange,
  branches,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Array<{ id: number; name: string; nameAr: string | null }>;
}) {
  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.expenses.fixedTemplates.list.useQuery(undefined, { enabled: open });
  const [form, setForm] = useState<TemplateForm | null>(null);

  const refresh = async () => {
    await Promise.all([utils.expenses.fixedTemplates.list.invalidate(), utils.expenses.list.invalidate()]);
  };

  const save = trpc.expenses.fixedTemplates.save.useMutation({
    onSuccess: async result => {
      toast.success(result.message);
      setForm(null);
      await refresh();
    },
    onError: error => toast.error(error.message || "تعذر حفظ المصروف الثابت"),
  });

  const remove = trpc.expenses.fixedTemplates.remove.useMutation({
    onSuccess: async result => {
      toast.success(result.message);
      await refresh();
    },
    onError: error => toast.error(error.message || "تعذر إيقاف المصروف الثابت"),
  });

  const groups = useMemo(() => {
    const map = new Map<number, { branchName: string; rows: NonNullable<typeof templates> }>();
    for (const t of templates ?? []) {
      const group = map.get(t.branchId) ?? { branchName: t.branchName, rows: [] };
      group.rows.push(t);
      map.set(t.branchId, group);
    }
    return Array.from(map.entries()).map(([branchId, g]) => ({
      branchId,
      ...g,
      total: g.rows.filter(r => r.isActive).reduce((sum, r) => sum + r.amount, 0),
    }));
  }, [templates]);

  const submit = () => {
    if (!form) return;
    const amount = Number(String(form.amount).replace(/,/g, "").trim());
    if (!form.branchId) return toast.error("اختر الفرع");
    if (form.title.trim().length < 2) return toast.error("أدخل اسم المصروف");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("المبلغ يجب أن يكون أكبر من صفر");
    save.mutate({
      id: form.id,
      branchId: Number(form.branchId),
      category: form.category,
      title: form.title.trim(),
      amount,
      paymentMethod: form.paymentMethod,
      isActive: form.isActive,
    });
  };

  const setActive = (t: NonNullable<typeof templates>[number], isActive: boolean) => {
    if (!isActive) {
      remove.mutate({ id: t.id });
      return;
    }
    save.mutate({
      id: t.id,
      branchId: t.branchId,
      category: t.category,
      title: t.title,
      amount: t.amount,
      paymentMethod: t.paymentMethod,
      isActive: true,
    });
  };

  const busy = save.isPending || remove.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>إدارة المصاريف الثابتة</DialogTitle>
          <DialogDescription>بنود شهرية لكل فرع تُضاف تلقائياً إلى المصاريف أول كل شهر (معتمدة)</DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            التعديل والإيقاف يسريان على الشهور التي لم تُضف بعد. مصروف الشهر الحالي المضاف لا يتغير، ويمكن تعديل مبلغه أو رفضه من
            قائمة المصاريف. البند الجديد يُضاف لهذا الشهر فوراً ما لم يوجد مصروف يدوي بنفس التصنيف للفرع.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">لا توجد مصاريف ثابتة بعد</p>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.branchId} className="rounded-lg border">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg">
                  <span className="font-semibold">{group.branchName}</span>
                  <span className="text-sm">
                    الإجمالي الشهري: <strong dir="ltr">{sar(group.total)}</strong>
                  </span>
                </div>
                <ul className="divide-y">
                  {group.rows.map(t => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className={t.isActive ? "" : "text-muted-foreground"}>
                        <div className="font-medium flex items-center gap-2">
                          {t.title}
                          {!t.isActive && <Badge variant="outline">موقوف</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {expenseCategoryLabel(t.category)} · {expensePaymentMethodLabel(t.paymentMethod)} · يبدأ من{" "}
                          {startsOnLabel(t.startsOn)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold ml-2" dir="ltr">{sar(t.amount)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="تعديل"
                          disabled={busy}
                          onClick={() =>
                            setForm({
                              id: t.id,
                              branchId: String(t.branchId),
                              category: t.category,
                              title: t.title,
                              amount: String(t.amount),
                              paymentMethod: t.paymentMethod,
                              isActive: t.isActive,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t.isActive ? "إيقاف" : "إعادة تفعيل"}
                          disabled={busy}
                          onClick={() => setActive(t, !t.isActive)}
                        >
                          {t.isActive ? <PowerOff className="h-4 w-4 text-red-600" /> : <Power className="h-4 w-4 text-green-600" />}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {form ? (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{form.id ? "تعديل مصروف ثابت" : "إضافة مصروف ثابت"}</span>
              <Button variant="ghost" size="icon" onClick={() => setForm(null)} title="إلغاء">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>الفرع *</Label>
                <Select
                  value={form.branchId}
                  onValueChange={v => setForm({ ...form, branchId: v })}
                  disabled={!!form.id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.nameAr || b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>التصنيف *</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v as ManualExpenseCategory })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUAL_EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>
                        {EXPENSE_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>اسم المصروف *</Label>
                <Input
                  value={form.title}
                  maxLength={100}
                  placeholder="مثال: إيجار محل"
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>المبلغ الشهري (ر.س) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  dir="ltr"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>طريقة الدفع</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={v => setForm({ ...form, paymentMethod: v as ExpensePaymentMethod })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_PAYMENT_METHODS.map(m => (
                      <SelectItem key={m} value={m}>
                        {EXPENSE_PAYMENT_METHOD_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full gap-2" onClick={submit} disabled={busy}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="gap-2" onClick={() => setForm({ ...EMPTY_FORM })} disabled={busy}>
            <Plus className="h-4 w-4" />
            إضافة مصروف ثابت
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
