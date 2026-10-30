/**
 * تبويب حساب بوابة الموظفين: اسم المستخدم، تفعيل/إيقاف الدخول، تعيين أو توليد كلمة المرور،
 * وإعادة التعيين مع عرض كلمة المرور الجديدة مرة واحدة
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Wand2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PortalAccountInfo,
  ResetPortalPasswordResult,
  SavePortalAccountResult,
} from "./types";
import {
  LoadingState,
  QueryErrorState,
  useInvalidateEmployeeFile,
} from "./EmployeeFileParts";
import {
  copyText,
  errorMessage,
  formatDateTimeAr,
  generateStrongPassword,
} from "./utils";

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const PASSWORD_MIN = 8;

function OneTimePasswordDialog({
  password,
  username,
  onClose,
}: {
  password: string | null;
  username: string;
  onClose: () => void;
}) {
  const copy = async (text: string) => {
    if (await copyText(text)) toast.success("تم النسخ");
    else toast.error("تعذر النسخ، انسخها يدوياً");
  };
  return (
    <Dialog open={!!password} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            كلمة المرور الجديدة
          </DialogTitle>
          <DialogDescription>
            تظهر مرة واحدة فقط. انسخها وسلّمها للموظف، ويمكنه تغييرها بعد
            الدخول.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-800">
            <p className="text-xs text-muted-foreground">اسم المستخدم</p>
            <p className="font-mono text-lg" dir="ltr">
              {username}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/30">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">كلمة المرور</p>
              <p
                className="font-mono text-xl font-bold tracking-wider"
                dir="ltr"
              >
                {password}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => password && copy(password)}
            >
              <Copy className="ml-1 h-4 w-4" />
              نسخ
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() =>
              copy(
                `اسم المستخدم: ${username}\nكلمة المرور: ${password}\nرابط الدخول: ${window.location.origin}/employee-login`
              )
            }
          >
            <Copy className="ml-1 h-4 w-4" />
            نسخ بيانات الدخول كاملة
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>تم</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PortalAccountTab({
  employeeId,
  employeeName,
}: {
  employeeId: number;
  employeeName: string;
}) {
  const accountQuery = trpc.employeeAuth.getAccount.useQuery({ employeeId });
  const account = accountQuery.data as PortalAccountInfo | undefined;
  const invalidateFile = useInvalidateEmployeeFile();

  const [username, setUsername] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!account) return;
    setUsername(account.username ?? "");
    setEnabled(account.hasPortalAccess);
    setPassword("");
  }, [account]);

  const afterChange = async () => {
    await Promise.all([accountQuery.refetch(), invalidateFile(employeeId)]);
  };

  const saveAccount = trpc.employeeAuth.saveAccount.useMutation({
    onSuccess: async (result: SavePortalAccountResult) => {
      if (result.generatedPassword)
        setOneTimePassword(result.generatedPassword);
      toast.success(
        password ? "تم حفظ الحساب وتعيين كلمة المرور" : "تم حفظ حساب البوابة"
      );
      setPassword("");
      await afterChange();
    },
    onError: (error: { message?: string }) =>
      toast.error(errorMessage(error, "تعذر حفظ حساب البوابة")),
  });

  const resetPassword = trpc.employeeAuth.resetPassword.useMutation({
    onSuccess: async result => {
      const newPassword: ResetPortalPasswordResult["password"] =
        result.password;
      setConfirmReset(false);
      if (newPassword) setOneTimePassword(newPassword);
      toast.success("تمت إعادة تعيين كلمة المرور");
      await afterChange();
    },
    onError: error =>
      toast.error(errorMessage(error, "تعذر إعادة تعيين كلمة المرور")),
  });

  if (accountQuery.isLoading)
    return <LoadingState label="جاري تحميل حساب البوابة..." />;
  if (accountQuery.isError || !account) {
    return (
      <QueryErrorState
        title="تعذر تحميل حساب البوابة"
        error={accountQuery.error}
        onRetry={() => accountQuery.refetch()}
        retrying={accountQuery.isFetching}
      />
    );
  }

  const normalizedUsername = username.trim().toLowerCase();
  // الاسم المحفوظ سابقاً (قد يكون بصيغة قديمة) مقبول كما هو؛ النمط للاسم الجديد فقط
  const usernameUnchanged =
    normalizedUsername === (account?.username ?? "").trim().toLowerCase();
  const usernameError =
    normalizedUsername && !usernameUnchanged && !USERNAME_RE.test(normalizedUsername)
      ? "من 3 إلى 30 حرفاً: أحرف إنجليزية صغيرة وأرقام و . _ - فقط"
      : null;
  const passwordError =
    password && password.length < PASSWORD_MIN
      ? `كلمة المرور ${PASSWORD_MIN} أحرف على الأقل`
      : null;
  const busy = saveAccount.isPending || resetPassword.isPending;
  const changed =
    normalizedUsername !== (account.username ?? "") ||
    enabled !== account.hasPortalAccess ||
    password.length > 0;

  const handleSave = () => {
    if (!normalizedUsername) {
      toast.error("اسم المستخدم مطلوب");
      return;
    }
    if (usernameError || passwordError) {
      toast.error(usernameError ?? passwordError);
      return;
    }
    saveAccount.mutate({
      employeeId,
      username: normalizedUsername,
      password: password || null,
      enabled,
    });
  };

  const loginUrl = `${window.location.origin}/employee-login`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {account.hasPortalAccess && account.username ? (
          <Badge className="bg-emerald-600 text-white">الدخول مفعّل</Badge>
        ) : account.username ? (
          <Badge
            variant="outline"
            className="border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            الدخول موقوف
          </Badge>
        ) : (
          <Badge variant="secondary">لا يوجد حساب</Badge>
        )}
        <Badge variant="outline">
          {account.hasPassword ? "كلمة المرور معيّنة" : "بدون كلمة مرور"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          آخر دخول: {formatDateTimeAr(account.lastLogin)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="portalUsername">اسم المستخدم *</Label>
          <Input
            id="portalUsername"
            dir="ltr"
            autoComplete="off"
            maxLength={30}
            placeholder="ahmed.ali"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={busy}
            aria-invalid={!!usernameError}
          />
          {usernameError && (
            <p className="text-xs text-red-600">{usernameError}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="portalPassword">كلمة مرور جديدة</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="portalPassword"
                dir="ltr"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={100}
                placeholder={
                  account.hasPassword
                    ? "اتركها فارغة للإبقاء على الحالية"
                    : "اتركها فارغة للتوليد التلقائي"
                }
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={busy}
                aria-invalid={!!passwordError}
                className="pl-10"
              />
              <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword(v => !v)}
                aria-label={
                  showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setPassword(generateStrongPassword());
                setShowPassword(true);
              }}
            >
              <Wand2 className="ml-1 h-4 w-4" />
              توليد
            </Button>
          </div>
          {passwordError && (
            <p className="text-xs text-red-600">{passwordError}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label htmlFor="portalEnabled" className="font-semibold">
            السماح بالدخول إلى بوابة الموظفين
          </Label>
          <p className="text-xs text-muted-foreground">
            الإيقاف يسجّل خروج الموظف من كل الأجهزة فوراً
          </p>
        </div>
        <Switch
          id="portalEnabled"
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={busy}
        />
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">رابط الدخول:</span>
        <span className="font-mono" dir="ltr">
          {loginUrl}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label="نسخ رابط الدخول"
          onClick={async () => {
            if (await copyText(loginUrl)) toast.success("تم نسخ الرابط");
            else toast.error("تعذر النسخ، انسخه يدوياً");
          }}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => setConfirmReset(true)}
          disabled={busy || !account.username}
          title={!account.username ? "احفظ اسم المستخدم أولاً" : undefined}
        >
          {resetPassword.isPending ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="ml-2 h-4 w-4" />
          )}
          إعادة تعيين كلمة المرور
        </Button>
        <Button onClick={handleSave} disabled={busy || !changed}>
          {saveAccount.isPending ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="ml-2 h-4 w-4" />
          )}
          {saveAccount.isPending ? "جاري الحفظ..." : "حفظ الحساب"}
        </Button>
      </div>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              إعادة تعيين كلمة مرور {employeeName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              ستُولَّد كلمة مرور جديدة وتتوقف كلمة المرور الحالية، ويُسجَّل خروج
              الموظف من كل الأجهزة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetPassword.isPending}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={resetPassword.isPending}
              onClick={event => {
                event.preventDefault();
                resetPassword.mutate({ employeeId });
              }}
            >
              {resetPassword.isPending ? "جاري التعيين..." : "إعادة التعيين"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OneTimePasswordDialog
        password={oneTimePassword}
        username={account.username ?? normalizedUsername}
        onClose={() => setOneTimePassword(null)}
      />
    </div>
  );
}
