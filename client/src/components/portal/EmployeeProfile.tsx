import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Loader2, 
  User,
  Phone,
  Mail,
  Building2,
  Briefcase,
  Calendar,
  CreditCard,
  Edit2,
  Save,
  X,
  CheckCircle2
} from 'lucide-react';

interface EmployeeProfileProps {
  employeeId: number;
}

export function EmployeeProfile({ employeeId }: EmployeeProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPhone, setEditedPhone] = useState('');
  const [editedEmail, setEditedEmail] = useState('');

  // جلب الملف الشخصي
  const { data: profile, isLoading, refetch } = trpc.employeePortal.getProfile.useQuery(
    { employeeId },
    { retry: false }
  );

  // تحديث الملف الشخصي
  const updateMutation = trpc.employeePortal.updateProfile.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث البيانات بنجاح');
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'فشل في تحديث البيانات');
    },
  });

  const handleEdit = () => {
    if (profile) {
      setEditedPhone(profile.phone || '');
      setEditedEmail(profile.email || '');
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      employeeId,
      phone: editedPhone || undefined,
      email: editedEmail || undefined,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedPhone('');
    setEditedEmail('');
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | string | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount)) + ' ر.س';
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="text-center py-12">
          <User className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">لا يمكن تحميل الملف الشخصي</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* البطاقة الرئيسية */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{profile.name}</h2>
                <p className="text-slate-400">{profile.position || 'موظف'}</p>
                <Badge className="mt-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {profile.code}
                </Badge>
              </div>
            </div>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
              >
                <Edit2 className="h-4 w-4 ml-2" />
                تعديل
              </Button>
            )}
          </div>
        </div>
        
        <CardContent className="p-6">
          {/* معلومات الاتصال */}
          <div className="space-y-4">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-amber-500" />
              معلومات الاتصال
            </h3>
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-400">رقم الجوال</Label>
                  <Input
                    value={editedPhone}
                    onChange={(e) => setEditedPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="bg-slate-700 border-slate-600 text-white"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={editedEmail}
                    onChange={(e) => setEditedEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="bg-slate-700 border-slate-600 text-white"
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Save className="h-4 w-4 ml-2" />
                    )}
                    حفظ التغييرات
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={updateMutation.isPending}
                    className="border-slate-600 text-slate-400 hover:bg-slate-700"
                  >
                    <X className="h-4 w-4 ml-2" />
                    إلغاء
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <Phone className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">رقم الجوال</p>
                    <p className="text-white font-mono">{profile.phone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">البريد الإلكتروني</p>
                    <p className="text-white">{profile.email || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* معلومات العمل */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-amber-500" />
            معلومات العمل
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
              <Building2 className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">الفرع</p>
                <p className="text-white">{profile.branchName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
              <Briefcase className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">المنصب</p>
                <p className="text-white">{profile.position || 'موظف'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
              <Calendar className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">تاريخ التعيين</p>
                <p className="text-white">{formatDate(profile.hireDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400">الحالة</p>
                <Badge className={
                  profile.status === 'active' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }>
                  {profile.status === 'active' ? 'نشط' : 'غير نشط'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* معلومات الراتب */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-500" />
            معلومات الراتب
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20">
              <p className="text-xs text-amber-400/70">الراتب الأساسي</p>
              <p className="text-xl font-bold text-amber-400">{formatCurrency(profile.baseSalary)}</p>
            </div>
            {profile.isSupervisor && (
              <div className="p-4 bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-400">نوع الموظف</p>
                <Badge className="mt-1 bg-purple-500/20 text-purple-400 border-purple-500/30">
                  مشرف
                </Badge>
              </div>
            )}
            {profile.overtimeEnabled && (
              <div className="p-4 bg-slate-700/30 rounded-lg">
                <p className="text-xs text-slate-400">الساعات الإضافية</p>
                <Badge className="mt-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
                  مفعّلة
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
