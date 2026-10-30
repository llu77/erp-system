/**
 * نموذج طلب سلفة من بوابة الموظف (employeePortal.createAdvanceRequest)
 * يصدر الطلب كمستند رسمي مؤرخ، ويظهر الختم والتوقيع عليه بعد الموافقة
 */

import { useState } from "react";
import { toast } from "sonner";
import { Info, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ADVANCE_LIMITS,
  errorMessage,
  normalizeAmountInput,
  REPAYMENT_METHODS,
  validateAdvanceForm,
  type AdvanceFormErrors,
  type AdvanceFormInput,
} from "@/lib/portal/portalUi";
import { REPAYMENT_METHOD_LABELS } from "@shared/advanceRequestTemplate";
import { amountToArabicWords } from "@shared/vouchers";

interface AdvanceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM: AdvanceFormInput = {
  amount: "",
  reason: "",
  repaymentMethod: "salary_deduction",
};

export function AdvanceRequestDialog({
  open,
  onOpenChange,
}: AdvanceRequestDialogProps) {
  const [form, setForm] = useState<AdvanceFormInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<AdvanceFormErrors>({});
  const utils = trpc.useUtils();

  const createMutation = trpc.employeePortal.createAdvanceRequest.useMutation({
    onSuccess: (result: { id: number; requestNumber: string }) => {
      toast.success(`تم إرسال طلب السلفة رقم ${result.requestNumber}`, {
        description: "يمكنك متابعة الطلب وتحميله من سجل طلباتي",
      });
      utils.employeeAuth.getMyRequests.invalidate();
      setForm(EMPTY_FORM);
      setErrors({});
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(errorMessage(error, "تعذر إرسال طلب السلفة"));
    },
  });

  const update = (field: keyof AdvanceFormInput, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createMutation.isPending) return;
    const result = validateAdvanceForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    createMutation.mutate(result.value);
  };

  const amountPreview = (() => {
    const n = Number(normalizeAmountInput(form.amount));
    return Number.isFinite(n) &&
      n >= ADVANCE_LIMITS.minAmount &&
      n <= ADVANCE_LIMITS.maxAmount
      ? amountToArabicWords(n)
      : null;
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!createMutation.isPending) onOpenChange(next);
      }}
    >
      <DialogContent
        className="bg-slate-800 border-slate-700 text-white sm:max-w-lg"
        dir="rtl"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Wallet className="h-5 w-5 text-amber-500" />
            طلب سلفة جديد
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            يُسجَّل الطلب باسمك وبتاريخ اليوم ويُرسل للإدارة للمراجعة.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="advance-amount" className="text-slate-300">
              مبلغ السلفة (ريال)
            </Label>
            <Input
              id="advance-amount"
              inputMode="decimal"
              autoComplete="off"
              value={form.amount}
              onChange={e => update("amount", e.target.value)}
              placeholder="مثال: 1500"
              className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500"
              aria-invalid={!!errors.amount}
              disabled={createMutation.isPending}
            />
            {errors.amount ? (
              <p className="text-xs text-red-400">{errors.amount}</p>
            ) : (
              amountPreview && (
                <p className="text-xs text-slate-400">{amountPreview}</p>
              )
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="advance-reason" className="text-slate-300">
              سبب السلفة
            </Label>
            <Textarea
              id="advance-reason"
              value={form.reason}
              onChange={e => update("reason", e.target.value)}
              maxLength={ADVANCE_LIMITS.maxReason}
              rows={3}
              placeholder="اذكر سبب طلب السلفة"
              className="bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500"
              aria-invalid={!!errors.reason}
              disabled={createMutation.isPending}
            />
            <div className="flex justify-between text-xs">
              <span className="text-red-400">{errors.reason}</span>
              <span className="text-slate-500">
                {form.reason.trim().length}/{ADVANCE_LIMITS.maxReason}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">طريقة السداد</Label>
            <Select
              value={form.repaymentMethod}
              onValueChange={value => update("repaymentMethod", value)}
              disabled={createMutation.isPending}
            >
              <SelectTrigger
                className="bg-slate-700/60 border-slate-600 text-white"
                aria-invalid={!!errors.repaymentMethod}
              >
                <SelectValue placeholder="اختر طريقة السداد" />
              </SelectTrigger>
              <SelectContent>
                {REPAYMENT_METHODS.map(method => (
                  <SelectItem key={method} value={method}>
                    {REPAYMENT_METHOD_LABELS[method] ?? method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.repaymentMethod && (
              <p className="text-xs text-red-400">{errors.repaymentMethod}</p>
            )}
          </div>

          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              يصدر طلب السلفة كمستند رسمي يمكنك تحميله وطباعته من سجل طلباتي،
              ويظهر عليه الختم والتوقيع بعد موافقة الإدارة.
            </span>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700"
            >
              {createMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              إرسال الطلب
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className="border-slate-600 bg-transparent text-slate-300 hover:bg-slate-700"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
