import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import { 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  Users,
  FileImage,
  CreditCard,
  Heart,
  FileCheck,
  RefreshCw,
  Bell,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function EmployeeDocumentsReport() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // جلب الموظفين بدون وثائق
  const { data: employees, isLoading, refetch } = trpc.employees.getWithoutDocuments.useQuery();
  
  // جلب إحصائيات الوثائق
  const { data: stats } = trpc.employees.getDocumentStatistics.useQuery();
  
  // إرسال تذكيرات الوثائق
  const sendReminderMutation = trpc.notifications.sendDocumentReminders.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'فشل في إرسال التذكير');
    },
  });

  // إرسال تذكير لموظف محدد
  const sendEmployeeReminderMutation = trpc.notifications.sendDocumentReminderToEmployee.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'فشل في إرسال التذكير');
    },
  });

  const filteredEmployees = employees?.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.branchName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleSendReminder = () => {
    if (!employees || employees.length === 0) {
      toast.error('لا يوجد موظفين بدون وثائق');
      return;
    }
    sendReminderMutation.mutate();
  };

  const handleSendEmployeeReminder = (employeeId: number) => {
    sendEmployeeReminderMutation.mutate({ employeeId });
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-amber-500" />
            تقرير وثائق الموظفين
          </h1>
          <p className="text-slate-400 mt-1">متابعة حالة رفع الوثائق للموظفين</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
          <Button
            onClick={handleSendReminder}
            disabled={sendReminderMutation.isPending || !employees?.length}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {sendReminderMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Bell className="h-4 w-4 ml-2" />
            )}
            إرسال تذكير
          </Button>
        </div>
      </div>

      {/* الإحصائيات */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">إجمالي الموظفين</p>
                  <p className="text-2xl font-bold text-white">{stats.totalEmployees}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">أكملوا الوثائق</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.withAllImages}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">بدون وثائق</p>
                  <p className="text-2xl font-bold text-red-400">{stats.totalEmployees - stats.withAllImages}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-slate-400 text-sm">نسبة الإكتمال</p>
                  <p className="text-lg font-bold text-amber-400">{stats.completionRate}%</p>
                </div>
                <Progress value={stats.completionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* تفاصيل الوثائق */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">صورة الإقامة</p>
                  <p className="text-lg font-semibold text-white">
                    {stats.withIqamaImage} / {stats.totalEmployees}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-500/20 rounded-lg">
                  <Heart className="h-5 w-5 text-pink-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">صورة الشهادة الصحية</p>
                  <p className="text-lg font-semibold text-white">
                    {stats.withHealthCertImage} / {stats.totalEmployees}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <FileCheck className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">صورة عقد العمل</p>
                  <p className="text-lg font-semibold text-white">
                    {stats.withContractImage} / {stats.totalEmployees}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* جدول الموظفين بدون وثائق */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                الموظفين بدون وثائق مكتملة
              </CardTitle>
              <CardDescription className="text-slate-400">
                {filteredEmployees.length} موظف يحتاجون لإكمال وثائقهم
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 bg-slate-700 border-slate-600 text-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-400">جميع الموظفين أكملوا وثائقهم</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400 text-right">الكود</TableHead>
                  <TableHead className="text-slate-400 text-right">الاسم</TableHead>
                  <TableHead className="text-slate-400 text-right">الفرع</TableHead>
                  <TableHead className="text-slate-400 text-right">المنصب</TableHead>
                  <TableHead className="text-slate-400 text-center">المعلومات</TableHead>
                  <TableHead className="text-slate-400 text-center">صورة الإقامة</TableHead>
                  <TableHead className="text-slate-400 text-center">صورة الشهادة</TableHead>
                  <TableHead className="text-slate-400 text-center">صورة العقد</TableHead>
                  <TableHead className="text-slate-400 text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id} className="border-slate-700 hover:bg-slate-700/30">
                    <TableCell className="text-white font-mono">{emp.code}</TableCell>
                    <TableCell className="text-white">{emp.name}</TableCell>
                    <TableCell className="text-slate-300">{emp.branchName}</TableCell>
                    <TableCell className="text-slate-300">{emp.position || '-'}</TableCell>
                    <TableCell className="text-center">
                      {emp.missingDocuments.info ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <AlertCircle className="h-3 w-3 ml-1" />
                          ناقص
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                          مكتمل
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.missingDocuments.iqamaImage ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <FileImage className="h-3 w-3 ml-1" />
                          ناقص
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                          مرفق
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.missingDocuments.healthCertImage ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <FileImage className="h-3 w-3 ml-1" />
                          ناقص
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                          مرفق
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {emp.missingDocuments.contractImage ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <FileImage className="h-3 w-3 ml-1" />
                          ناقص
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                          مرفق
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendEmployeeReminder(emp.id)}
                        disabled={sendEmployeeReminderMutation.isPending}
                        className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
