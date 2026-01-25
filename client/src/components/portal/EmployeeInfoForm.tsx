import { useState, useEffect, useRef } from 'react';
import { compressDocumentImage, formatFileSize } from '@/lib/imageCompression';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Info,
  Camera,
  Image as ImageIcon,
  X,
  Eye,
  Upload
} from 'lucide-react';

interface EmployeeInfoFormProps {
  employeeId: number;
  onSuccess?: () => void;
}

type DocumentType = 'iqama' | 'healthCert' | 'contract';

export function EmployeeInfoForm({ employeeId, onSuccess }: EmployeeInfoFormProps) {
  const [iqamaNumber, setIqamaNumber] = useState('');
  const [iqamaExpiryDate, setIqamaExpiryDate] = useState('');
  const [healthCertExpiryDate, setHealthCertExpiryDate] = useState('');
  const [contractExpiryDate, setContractExpiryDate] = useState('');
  
  // حالات الصور
  const [iqamaImage, setIqamaImage] = useState<string | null>(null);
  const [healthCertImage, setHealthCertImage] = useState<string | null>(null);
  const [contractImage, setContractImage] = useState<string | null>(null);
  
  // حالة عرض الصورة
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  
  // مراجع للـ input files
  const iqamaInputRef = useRef<HTMLInputElement>(null);
  const healthCertInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);

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

  // رفع صورة
  const uploadMutation = trpc.employeePortal.uploadDocumentImage.useMutation({
    onSuccess: (data, variables) => {
      toast.success('تم رفع الصورة بنجاح');
      // تحديث الصورة المحلية
      switch (variables.documentType) {
        case 'iqama':
          setIqamaImage(data.url);
          break;
        case 'healthCert':
          setHealthCertImage(data.url);
          break;
        case 'contract':
          setContractImage(data.url);
          break;
      }
      setUploadingType(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'فشل في رفع الصورة');
      setUploadingType(null);
    },
  });

  // حذف صورة
  const deleteMutation = trpc.employeePortal.deleteDocumentImage.useMutation({
    onSuccess: (_, variables) => {
      toast.success('تم حذف الصورة بنجاح');
      switch (variables.documentType) {
        case 'iqama':
          setIqamaImage(null);
          break;
        case 'healthCert':
          setHealthCertImage(null);
          break;
        case 'contract':
          setContractImage(null);
          break;
      }
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'فشل في حذف الصورة');
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
      // تحميل روابط الصور
      if (documentInfo.iqamaImageUrl) setIqamaImage(documentInfo.iqamaImageUrl);
      if (documentInfo.healthCertImageUrl) setHealthCertImage(documentInfo.healthCertImageUrl);
      if (documentInfo.contractImageUrl) setContractImage(documentInfo.contractImageUrl);
    }
  }, [documentInfo]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, docType: DocumentType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }

    // التحقق من حجم الملف (10MB max قبل الضغط)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 10 ميجابايت');
      return;
    }

    setUploadingType(docType);

    try {
      // ضغط الصورة قبل الرفع
      const { base64, originalSize, compressedSize, compressionRatio } = await compressDocumentImage(file);
      
      // عرض رسالة الضغط إذا كان الضغط ملحوظاً
      if (compressionRatio > 20) {
        toast.info(`تم ضغط الصورة بنسبة ${compressionRatio}% (من ${formatFileSize(originalSize)} إلى ${formatFileSize(compressedSize)})`);
      }
      
      uploadMutation.mutate({
        employeeId,
        documentType: docType,
        imageData: base64,
        fileName: file.name,
        mimeType: 'image/jpeg',
      });
    } catch (error) {
      toast.error('فشل في معالجة الصورة');
      setUploadingType(null);
    }

    // إعادة تعيين الـ input
    e.target.value = '';
  };

  const handleDeleteImage = (docType: DocumentType) => {
    if (confirm('هل أنت متأكد من حذف هذه الصورة؟')) {
      deleteMutation.mutate({ employeeId, documentType: docType });
    }
  };

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

  // مكون عرض/رفع الصورة
  const ImageUploadSection = ({ 
    docType, 
    label, 
    imageUrl, 
    inputRef,
    disabled = false
  }: { 
    docType: DocumentType; 
    label: string; 
    imageUrl: string | null;
    inputRef: React.RefObject<HTMLInputElement>;
    disabled?: boolean;
  }) => {
    const isUploading = uploadingType === docType;
    
    return (
      <div className="space-y-2">
        <Label className="text-slate-300 flex items-center gap-2">
          <Camera className="h-4 w-4 text-amber-500" />
          صورة {label}
        </Label>
        
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileChange(e, docType)}
          className="hidden"
          disabled={disabled || isUploading}
        />
        
        {imageUrl ? (
          <div className="relative group">
            <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-700 border border-slate-600">
              <img 
                src={imageUrl} 
                alt={label}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setViewingImage(imageUrl)}
              />
            </div>
            {!disabled && (
              <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-slate-800/80 hover:bg-slate-700"
                  onClick={() => setViewingImage(imageUrl)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={() => handleDeleteImage(docType)}
                  disabled={deleteMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {disabled && (
              <div className="absolute top-2 left-2">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-slate-800/80 hover:bg-slate-700"
                  onClick={() => setViewingImage(imageUrl)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full h-32 border-dashed border-slate-600 bg-slate-700/30 hover:bg-slate-700/50 text-slate-400"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <span className="text-sm">جاري الرفع...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8" />
                <span className="text-sm">اضغط لرفع صورة {label}</span>
                <span className="text-xs text-slate-500">أو التقط صورة من الكاميرا</span>
              </div>
            )}
          </Button>
        )}
      </div>
    );
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
      <>
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

            {/* صور الوثائق */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-amber-500" />
                صور الوثائق
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {iqamaImage && (
                  <div className="relative group">
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-700 border border-slate-600">
                      <img 
                        src={iqamaImage} 
                        alt="صورة الإقامة"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setViewingImage(iqamaImage)}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-center">صورة الإقامة</p>
                  </div>
                )}
                {healthCertImage && (
                  <div className="relative group">
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-700 border border-slate-600">
                      <img 
                        src={healthCertImage} 
                        alt="صورة الشهادة الصحية"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setViewingImage(healthCertImage)}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-center">صورة الشهادة الصحية</p>
                  </div>
                )}
                {contractImage && (
                  <div className="relative group">
                    <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-700 border border-slate-600">
                      <img 
                        src={contractImage} 
                        alt="صورة عقد العمل"
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setViewingImage(contractImage)}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 text-center">صورة عقد العمل</p>
                  </div>
                )}
                {!iqamaImage && !healthCertImage && !contractImage && (
                  <p className="text-slate-500 text-sm col-span-3 text-center py-4">لا توجد صور مرفقة</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dialog لعرض الصورة بحجم كامل */}
        <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-4xl bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">عرض الصورة</DialogTitle>
            </DialogHeader>
            {viewingImage && (
              <div className="flex justify-center">
                <img 
                  src={viewingImage} 
                  alt="صورة الوثيقة"
                  className="max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // نموذج تسجيل المعلومات (لمرة واحدة فقط)
  return (
    <>
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

            {/* صورة الإقامة */}
            <ImageUploadSection
              docType="iqama"
              label="الإقامة"
              imageUrl={iqamaImage}
              inputRef={iqamaInputRef as React.RefObject<HTMLInputElement>}
            />

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

            {/* صورة الشهادة الصحية */}
            <ImageUploadSection
              docType="healthCert"
              label="الشهادة الصحية"
              imageUrl={healthCertImage}
              inputRef={healthCertInputRef as React.RefObject<HTMLInputElement>}
            />

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

            {/* صورة عقد العمل */}
            <ImageUploadSection
              docType="contract"
              label="عقد العمل"
              imageUrl={contractImage}
              inputRef={contractInputRef as React.RefObject<HTMLInputElement>}
            />

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

      {/* Dialog لعرض الصورة بحجم كامل */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-4xl bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">عرض الصورة</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <div className="flex justify-center">
              <img 
                src={viewingImage} 
                alt="صورة الوثيقة"
                className="max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
