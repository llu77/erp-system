/**
 * تغيير كلمة مرور البوابة (employeeAuth.changePassword)
 * يُلغي الخادم الجلسات الأخرى ويجدد جلسة هذا الجهاز
 */

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
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
import { trpc } from "@/lib/trpc";
import { errorMessage, PORTAL_PASSWORD_MIN_LENGTH, validatePasswordChange } from "@/lib/portal/portalUi";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const changeMutation = trpc.employeeAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور", { description: "تم تسجيل الخروج من الأجهزة الأخرى" });
      setForm(EMPTY);
      setFormError(null);
      setOpen(false);
    },
    onError: error => {
      const message = errorMessage(error, "تعذر تغيير كلمة المرور");
      setFormError(message);
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (changeMutation.isPending) return;
    const problem = validatePasswordChange(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    changeMutation.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  const field = (key: keyof typeof EMPTY, label: string, autoComplete: string) => (
    <div className="space-y-2">
      <Label htmlFor={`pw-${key}`} className="text-slate-300">
        {label}
      </Label>
      <Input
        id={`pw-${key}`}
        type="password"
        dir="ltr"
        autoComplete={autoComplete}
        value={form[key]}
        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
        className="bg-slate-700/60 border-slate-600 text-white"
        disabled={changeMutation.isPending}
      />
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-700"
      >
        <KeyRound className="ml-2 h-4 w-4 text-amber-500" />
        تغيير كلمة المرور
      </Button>
      <Dialog
        open={open}
        onOpenChange={next => {
          if (changeMutation.isPending) return;
          setOpen(next);
          if (!next) {
            setForm(EMPTY);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-md" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2 text-white">
              <KeyRound className="h-5 w-5 text-amber-500" />
              تغيير كلمة المرور
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              كلمة المرور الجديدة {PORTAL_PASSWORD_MIN_LENGTH} أحرف على الأقل.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {field("currentPassword", "كلمة المرور الحالية", "current-password")}
            {field("newPassword", "كلمة المرور الجديدة", "new-password")}
            {field("confirmPassword", "تأكيد كلمة المرور الجديدة", "new-password")}
            {formError && (
              <p role="alert" className="text-sm text-red-400">
                {formError}
              </p>
            )}
            <DialogFooter className="gap-2 sm:justify-start">
              <Button type="submit" disabled={changeMutation.isPending} className="bg-amber-500 text-white hover:bg-amber-600">
                {changeMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ كلمة المرور
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={changeMutation.isPending}
                className="border-slate-600 bg-transparent text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
