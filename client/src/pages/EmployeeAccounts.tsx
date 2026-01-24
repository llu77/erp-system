import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Users, 
  Key, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Copy,
  Loader2,
  UserPlus,
  Clock,
  Building2
} from 'lucide-react';

export default function EmployeeAccounts() {
  const [showNewAccounts, setShowNewAccounts] = useState(false);
  const [newAccounts, setNewAccounts] = useState<Array<{
    id: number;
    name: string;
    username: string;
    password: string;
  }>>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: accountsData, isLoading, refetch } = trpc.employeeAuth.getAccounts.useQuery();
  const createAccountsMutation = trpc.employeeAuth.createAccounts.useMutation();
  const resetPasswordMutation = trpc.employeeAuth.resetPassword.useMutation();

  const handleCreateAccounts = async () => {
    try {
      const result = await createAccountsMutation.mutateAsync();
      if (result.success) {
        if (result.created.length > 0) {
          setNewAccounts(result.created);
          setShowNewAccounts(true);
          toast.success(`تم إنشاء ${result.created.length} حساب جديد`);
        } else {
          toast.info('جميع الموظفين لديهم حسابات بالفعل');
        }
        refetch();
      }
      if (result.errors.length > 0) {
        result.errors.forEach(err => toast.error(err));
      }
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء إنشاء الحسابات');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedEmployee) return;
    
    try {
      const result = await resetPasswordMutation.mutateAsync({
        employeeId: selectedEmployee.id,
      });
      if (result.success && result.newPassword) {
        setNewPassword(result.newPassword);
        toast.success('تم إعادة تعيين كلمة المرور بنجاح');
      } else {
        toast.error(result.error || 'حدث خطأ');
      }
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('تم النسخ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const accounts = accountsData?.accounts || [];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">حسابات الموظفين</h1>
          <p className="text-muted-foreground">إدارة حسابات دخول الموظفين لبوابة Symbol AI</p>
        </div>
        <Button onClick={handleCreateAccounts} disabled={createAccountsMutation.isPending}>
          {createAccountsMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
          ) : (
            <UserPlus className="h-4 w-4 ml-2" />
          )}
          إنشاء حسابات للموظفين الجدد
        </Button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                <p className="text-2xl font-bold">{accounts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">حسابات مفعلة</p>
                <p className="text-2xl font-bold">{accounts.filter(a => a.hasPortalAccess).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-lg">
                <XCircle className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">بدون حساب</p>
                <p className="text-2xl font-bold">{accounts.filter(a => !a.hasPortalAccess).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* جدول الحسابات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            قائمة الحسابات
          </CardTitle>
          <CardDescription>جميع حسابات الموظفين للوصول إلى بوابة Symbol AI</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الكود</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>اسم المستخدم</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر دخول</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono">{account.code}</TableCell>
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell className="font-mono">{account.username || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      {account.branchName}
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.hasPortalAccess ? (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                        <CheckCircle className="h-3 w-3 ml-1" />
                        مفعل
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 ml-1" />
                        غير مفعل
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.lastLogin ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(account.lastLogin).toLocaleDateString('ar-SA')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {account.hasPortalAccess && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedEmployee({ id: account.id, name: account.name });
                          setNewPassword('');
                          setShowResetDialog(true);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 ml-1" />
                        إعادة تعيين كلمة المرور
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog - الحسابات الجديدة */}
      <Dialog open={showNewAccounts} onOpenChange={setShowNewAccounts}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              تم إنشاء الحسابات بنجاح
            </DialogTitle>
            <DialogDescription>
              احفظ هذه البيانات الآن - لن تظهر كلمات المرور مرة أخرى
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <AlertDescription className="text-amber-600">
                ⚠️ هام: احفظ كلمات المرور الآن! لن تتمكن من رؤيتها مرة أخرى.
              </AlertDescription>
            </Alert>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>اسم المستخدم</TableHead>
                  <TableHead>كلمة المرور</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {newAccounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="font-mono">{acc.username}</TableCell>
                    <TableCell className="font-mono">{acc.password}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`اسم المستخدم: ${acc.username}\nكلمة المرور: ${acc.password}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowNewAccounts(false)}>تم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog - إعادة تعيين كلمة المرور */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>
              {selectedEmployee?.name}
            </DialogDescription>
          </DialogHeader>
          {newPassword ? (
            <div className="space-y-4">
              <Alert className="bg-emerald-500/10 border-emerald-500/30">
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>كلمة المرور الجديدة:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-slate-800 px-2 py-1 rounded">{newPassword}</code>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(newPassword)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <p>هل أنت متأكد من إعادة تعيين كلمة المرور لـ {selectedEmployee?.name}؟</p>
          )}
          <DialogFooter>
            {newPassword ? (
              <Button onClick={() => setShowResetDialog(false)}>تم</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowResetDialog(false)}>إلغاء</Button>
                <Button onClick={handleResetPassword} disabled={resetPasswordMutation.isPending}>
                  {resetPasswordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  إعادة تعيين
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
