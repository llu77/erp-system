/**
 * قسم "مصاريف ثابتة" في صفحة المصاريف: المصاريف الثابتة للشهر المحدد لكل فرع
 * (تُضاف تلقائياً أول كل شهر من قوالب الفروع) مع الإجمالي وطريقة الدفع لكل بند.
 * المسؤول يدير القوالب من زر "إدارة المصاريف الثابتة".
 */

import { useMemo, useState } from "react";
import { Building2, CalendarClock, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FIXED_EXPENSES_SECTION_TITLE,
  expenseCategoryLabel,
  expensePaymentMethodLabel,
} from "@shared/expenses";
import { formatVoucherAmount } from "@shared/vouchers";
import { FixedExpenseTemplatesDialog } from "./FixedExpenseTemplatesDialog";

export interface FixedExpenseRow {
  id: number;
  title: string;
  category: string;
  amount: string;
  branchId: number | null;
  branchName: string | null;
  paymentMethod: string;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  paid: "مدفوع",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-blue-100 text-blue-800",
};

const sar = (value: number) => `${formatVoucherAmount(value)} ر.س`;

/** المحتسب في الإجمالي: المعتمد والمدفوع فقط (المرفوض يظهر ولا يُحسب) */
const isCounted = (status: string) => status === "approved" || status === "paid";

export function FixedExpensesSection({
  rows,
  monthLabel,
  isAdmin,
  branches,
}: {
  rows: FixedExpenseRow[];
  monthLabel: string;
  isAdmin: boolean;
  branches: Array<{ id: number; name: string; nameAr: string | null }>;
}) {
  const [manageOpen, setManageOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, { branchName: string; rows: FixedExpenseRow[]; total: number }>();
    for (const row of rows) {
      const key = String(row.branchId ?? 0);
      const group = map.get(key) ?? { branchName: row.branchName || "بدون فرع", rows: [], total: 0 };
      group.rows.push(row);
      if (isCounted(row.status)) group.total += Number(row.amount) || 0;
      map.set(key, group);
    }
    return Array.from(map.values());
  }, [rows]);

  const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);

  return (
    <Card className="card-professional">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <CalendarClock className="h-5 w-5 text-amber-600" />
            </div>
            {FIXED_EXPENSES_SECTION_TITLE} - {monthLabel}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            تُضاف تلقائياً أول كل شهر لكل فرع. يمكن تعديل مبلغ الشهر أو رفضه من قائمة المصاريف.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <span className="text-xs text-muted-foreground block">إجمالي المصاريف الثابتة</span>
            <span className="text-lg font-bold text-amber-700" dir="ltr">{sar(grandTotal)}</span>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setManageOpen(true)}>
              <Settings2 className="h-4 w-4" />
              إدارة المصاريف الثابتة
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            لا توجد مصاريف ثابتة لهذا الشهر
            {isAdmin ? " - أضف البنود من «إدارة المصاريف الثابتة»" : ""}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map(group => (
              <div key={group.branchName} className="rounded-lg border">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-lg">
                  <span className="flex items-center gap-1 font-semibold">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {group.branchName}
                  </span>
                  <span className="font-bold" dir="ltr">{sar(group.total)}</span>
                </div>
                <ul className="divide-y">
                  {group.rows.map(row => (
                    <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className={row.status === "rejected" ? "line-through text-muted-foreground" : ""}>
                        <div className="font-medium">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {expenseCategoryLabel(row.category)} · {expensePaymentMethodLabel(row.paymentMethod)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={STATUS_CLASSES[row.status] ?? ""}>{STATUS_LABELS[row.status] ?? row.status}</Badge>
                        <span className="font-semibold" dir="ltr">{sar(Number(row.amount) || 0)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {isAdmin && (
        <FixedExpenseTemplatesDialog open={manageOpen} onOpenChange={setManageOpen} branches={branches} />
      )}
    </Card>
  );
}
