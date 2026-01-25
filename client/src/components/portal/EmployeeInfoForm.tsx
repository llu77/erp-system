import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  Loader2, 
  FileText,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Lock,
  Info
} from 'lucide-react';

interface EmployeeInfoFormProps {
  employeeId: number;
  onSuccess?: () => void;
}

export function EmployeeInfoForm({ employeeId, onSuccess }: EmployeeInfoFormProps) {
  const [iqamaNumber, setIqamaNumber] = useState('');
  const [iqamaExpiryDate, setIqamaExpiryDate] = useState('');
  const [healthCertExpiryDate, setHealthCertExpiryDate] = useState('');
  const [contractExpiryDate, setContractExpiryDate] = useState('');

  // التحقق مما إذا كان الموظف قد سجل معلوماته
  const { data: submissionStatus, isLoading: checkingStatus } = trpc.employeePortal.hasSubmittedInfo.useQuery(
    { employeeId },
    { retry: false }
  );

  // جلب معلومات الموظف الحالية
  const { data: documentInfo, isLoading: loadingInfo, refetch } = trpc.employeePortal.getDocumentInfo.useQuery(
    { employeeId },
    { retry: false }
  );

  // تسجيل المعلومات
  const submitMutation = trpc.employeePortal.submitInfo.useMutation({
    onSuccess: () => {
      toast.success('تم تسجيل المعلومات بنجاح');
      refetch();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || 'فشل في تسجيل المعلومات');
    },
  });

  // تعبئة البيانات الموجودة
  useEffect(() => {
    if (documentInfo) {
      if (documentInfo.iqamaNumber) setIqamaNumber(documentInfo.iqamaNumber);
      if (documentInfo.iqamaExpiryDate) {
        setIqamaExpiryDate(new Date(documentInfo.iqamaExpiryDate).toISOString().split('T')[0]);
      }
      if (documentInfo.healthCertExpiryDate) {
        setHealthCertExpiryDate(new Date(documentInfo.healthCertExpiryDate).toISOString().split('T')[0]);
      }
      if (documentInfo.contractExpiryDate) {
        setContractExpiryDate(new Date(documentInfo.contractExpiryDate).toISOString().split('T')[0]);
      }
    }
  }, [documentInfo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق من إدخال بيانات
    if (!iqamaNumber && !iqamaExpiryDate && !healthCertExpiryDate && !contractExpiryDate) {
      toast.error('يرجى إدخال بيانات واحدة على الأقل');
      return;
    }

    submitMutation.mutate({
      employeeId,
      iqamaNumber: iqamaNumber || undefined,
      iqamaExpiryDate: iqamaExpiryDate ? new Date(iqamaExpiryDate) : undefined,
      healthCertExpiryDate: healthCertExpiryDate ? new Date(healthCertExpiryDate) : undefined,
      contractExpiryDate: contractExpiryDate ? new Date(contractExpiryDate) : undefined,
    });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // حساب حالة انتهاء الصلاحية
  const getExpiryStatus = (date: string | Date | null) => {
    if (!date) return null;
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { status: 'expired', label: 'منتهية', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'expiring', label: `تنتهي خلال ${daysUntilExpiry} يوم`, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
    } else if (daysUntilExpiry <= 60) {
      return { status: 'warning', label: `تنتهي خلال ${daysUntilExpiry} يوم`, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    }
    return { status: 'valid', label: 'سارية', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
  };

  if (checkingStatus || loadingInfo) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  // إذا كان الموظف قد سجل معلوماته، عرضها للقراءة فقط
  if (submissionStatus?.hasSubmitted && documentInfo) {
    const iqamaStatus = getExpiryStatus(documentInfo.iqamaExpiryDate);
    const healthStatus = getExpiryStatus(documentInfo.healthCertExpiryDate);
    const contractStatus = getExpiryStatus(documentInfo.contractExpiryDate);

    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                بيانات الإقامة والوثائق
              </CardTitle>
              <CardDescription className="text-slate-400 mt-1">
                تم تسجيل المعلومات بتاريخ {formatDate(documentInfo.infoSubmittedAt)}
              </CardDescription>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 ml-1" />
              مسجّلة
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Alert className="mb-6 bg-slate-700/50 border-slate-600">
            <Lock className="h-4 w-4 text-slate-400" />
            <AlertDescription className="text-slate-300">
              تم تسجيل المعلومات ولا يمكن تعديلها. للتعديل يرجى التواصل مع الإدارة.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* رقم الإقامة */}
            <div className="p-4 bg-slate-700/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-400">رقم الإقامة</span>
              </div>
              <p className="text-white font-mono text-lg">{documentInfo.iqamaNumber || '-'}</p>
            </div>

            {/* تاريخ انتهاء الإقامة */}
            <div className="p-4 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400">تاريخ انتهاء الإقامة</span>
                </div>
                {iqamaStatus && (
                  <Badge className={iqamaStatus.color}>
                    {iqamaStatus.label}
                  </Badge>
                )}
              </div>
              <p className="text-white">{formatDate(documentInfo.iqamaExpiryDate)}</p>
            </div>

            {/* تاريخ انتهاء الشهادة الصحية */}
            <div className="p-4 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400">تاريخ انتهاء الشهادة الصحية</span>
                </div>
                {healthStatus && (
                  <Badge className={healthStatus.color}>
                    {healthStatus.label}
                  </Badge>
                )}
              </div>
              <p className="text-white">{formatDate(documentInfo.healthCertExpiryDate)}</p>
            </div>

            {/* تاريخ انتهاء عقد العمل */}
            <div className="p-4 bg-slate-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-400">تاريخ انتهاء عقد العمل</span>
                </div>
                {contractStatus && (
                  <Badge className={contractStatus.color}>
                    {contractStatus.label}
                  </Badge>
                )}
              </div>
              <p className="text-white">{formatDate(documentInfo.contractExpiryDate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // نموذج تسجيل المعلومات (لمرة واحدة فقط)
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="border-b border-slate-700">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-amber-500" />
          تسجيل بيانات الإقامة والوثائق
        </CardTitle>
        <CardDescription className="text-slate-400">
          يرجى إدخال بياناتك بدقة. هذه البيانات تُسجّل لمرة واحدة فقط.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Alert className="mb-6 bg-amber-500/10 border-amber-500/30">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-300">
            <strong>تنبيه:</strong> بعد التسجيل لن تتمكن من تعديل هذه البيانات. للتعديل لاحقاً يرجى التواصل مع الإدارة.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* رقم الإقامة */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-500" />
              رقم الإقامة
            </Label>
            <Input
              value={iqamaNumber}
              onChange={(e) => setIqamaNumber(e.target.value)}
              placeholder="أدخل رقم الإقامة"
              className="bg-slate-700 border-slate-600 text-white"
              dir="ltr"
            />
          </div>

          {/* تاريخ انتهاء الإقامة */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              تاريخ انتهاء الإقامة
            </Label>
            <Input
              type="date"
              value={iqamaExpiryDate}
              onChange={(e) => setIqamaExpiryDate(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {/* تاريخ انتهاء الشهادة الصحية */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              تاريخ انتهاء الشهادة الصحية
            </Label>
            <Input
              type="date"
              value={healthCertExpiryDate}
              onChange={(e) => setHealthCertExpiryDate(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {/* تاريخ انتهاء عقد العمل */}
          <div className="space-y-2">
            <Label className="text-slate-300 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              تاريخ انتهاء عقد العمل
            </Label>
            <Input
              type="date"
              value={contractExpiryDate}
              onChange={(e) => setContractExpiryDate(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
            <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-400">
              سيتم إرسال تنبيهات تلقائية قبل انتهاء صلاحية الوثائق
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 ml-2" />
                تسجيل المعلومات
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
