import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { Gift, CheckCircle, Loader2, Calendar, PartyPopper, Camera, X, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Progress } from '@/components/ui/progress';

// ============================================
// أنواع البيانات (Types)
// ============================================
interface VisitResult {
  success: boolean;
  customerName?: string;
  isDiscountVisit?: boolean;
  discountPercentage?: number;
  visitNumberInMonth?: number;
  message?: string;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

// ============================================
// ثوابت التطبيق (Constants)
// ============================================
const MAX_FILE_SIZE_MB = 10;
const COMPRESSION_CONFIG = {
  maxWidth: 800,
  quality: 0.6,
  fallbackMaxWidth: 600,
  fallbackQuality: 0.4,
};

// ============================================
// دوال مساعدة (Helper Functions)
// ============================================

/**
 * ضغط الصورة إلى حجم أصغر
 * Single Responsibility: هذه الدالة مسؤولة فقط عن ضغط الصور
 */
const compressImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // تصغير الصورة مع الحفاظ على النسبة
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('فشل إنشاء canvas'));
            return;
          }
          
          // خلفية بيضاء + رسم الصورة
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          // تحويل إلى JPEG مضغوط
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch (err) {
          reject(err);
        }
      };
      
      img.onerror = () => reject(new Error('فشل تحميل الصورة'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });
};

/**
 * التحقق من صحة الملف
 * Single Responsibility: التحقق فقط
 */
const validateFile = (file: File): { valid: boolean; error?: string } => {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'يرجى اختيار صورة فقط' };
  }
  
  const sizeInMB = file.size / (1024 * 1024);
  if (sizeInMB > MAX_FILE_SIZE_MB) {
    return { valid: false, error: `حجم الصورة كبير جداً (الحد الأقصى ${MAX_FILE_SIZE_MB} ميجابايت)` };
  }
  
  return { valid: true };
};

/**
 * حساب حجم base64 بالميجابايت
 */
const getBase64SizeInMB = (base64: string): number => {
  return (base64.length * 0.75) / (1024 * 1024);
};

// ============================================
// المكون الرئيسي (Main Component)
// ============================================
export default function LoyaltyVisit() {
  // حالة النموذج
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<{ id: number; name: string } | null>(null);
  
  // حالة الصورة
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null);
  const [invoiceImagePreview, setInvoiceImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // حالة الرفع
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });
  
  // نتيجة التسجيل
  const [result, setResult] = useState<VisitResult | null>(null);

  // ============================================
  // استعلامات tRPC
  // ============================================
  const { data: branches } = trpc.loyalty.branches.useQuery();
  const { data: serviceTypes } = trpc.loyalty.getServiceTypes.useQuery();
  const { data: settings } = trpc.loyalty.getSettings.useQuery();
  
  // رفع الصورة
  const uploadMutation = trpc.loyalty.uploadInvoiceImage.useMutation();
  
  // تسجيل الزيارة
  const visitMutation = trpc.loyalty.recordVisit.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setResult({
          success: true,
          customerName: data.customer?.name,
          isDiscountVisit: data.isDiscountVisit,
          discountPercentage: data.discountPercentage,
          visitNumberInMonth: data.visitNumberInMonth,
          message: data.message,
        });
        
        // إطلاق الكونفيتي عند الحصول على خصم
        if (data.isDiscountVisit) {
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.6 }
          });
        }
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // ============================================
  // معالجات الأحداث (Event Handlers)
  // ============================================
  
  /**
   * معالجة اختيار/التقاط الصورة
   */
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // إعادة تعيين حالة الخطأ
    setUploadState(prev => ({ ...prev, error: null }));
    
    // التحقق من صحة الملف
    const validation = validateFile(file);
    if (!validation.valid) {
      setUploadState(prev => ({ ...prev, error: validation.error || null }));
      toast.error(validation.error);
      return;
    }
    
    setInvoiceImage(file);
    
    // إنشاء معاينة
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Preview error:', err);
    }
  }, []);

  /**
   * إزالة الصورة المحددة
   */
  const removeImage = useCallback(() => {
    setInvoiceImage(null);
    setInvoiceImagePreview(null);
    setUploadState(prev => ({ ...prev, error: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * معالجة إرسال النموذج
   * تطبيق مبدأ KISS - تبسيط العملية
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ============================================
    // الخطوة 1: التحقق من البيانات
    // ============================================
    if (!phone.trim() || phone.length < 10) {
      toast.error('الرجاء إدخال رقم جوال صحيح');
      return;
    }
    if (!serviceType) {
      toast.error('الرجاء اختيار نوع الخدمة');
      return;
    }
    if (!invoiceImage) {
      toast.error('الرجاء التقاط صورة الفاتورة');
      return;
    }

    // بدء عملية الرفع
    setUploadState({ isUploading: true, progress: 10, error: null });
    
    try {
      // ============================================
      // الخطوة 2: ضغط الصورة
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 20 }));
      
      let base64Data: string;
      
      try {
        // محاولة الضغط بالإعدادات الأساسية
        base64Data = await compressImage(
          invoiceImage, 
          COMPRESSION_CONFIG.maxWidth, 
          COMPRESSION_CONFIG.quality
        );
        console.log('✓ Image compressed successfully');
      } catch (compressError) {
        console.warn('⚠ Primary compression failed, trying fallback:', compressError);
        
        try {
          // محاولة الضغط بإعدادات أقل
          base64Data = await compressImage(
            invoiceImage, 
            COMPRESSION_CONFIG.fallbackMaxWidth, 
            COMPRESSION_CONFIG.fallbackQuality
          );
          console.log('✓ Image compressed with fallback settings');
        } catch (fallbackError) {
          throw new Error('فشل ضغط الصورة - يرجى التقاط صورة أخرى');
        }
      }
      
      // ============================================
      // الخطوة 3: التحقق من الحجم بعد الضغط
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 40 }));
      
      const sizeInMB = getBase64SizeInMB(base64Data);
      console.log(`📊 Image size after compression: ${sizeInMB.toFixed(2)} MB`);
      
      if (sizeInMB > 5) {
        throw new Error('حجم الصورة كبير جداً حتى بعد الضغط - يرجى التقاط صورة أقرب');
      }
      
      // ============================================
      // الخطوة 4: رفع الصورة إلى السيرفر
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 50 }));
      console.log('📤 Uploading image to server...');
      
      const uploadResult = await uploadMutation.mutateAsync({
        base64Data,
        fileName: `invoice_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      });
      
      setUploadState(prev => ({ ...prev, progress: 80 }));
      console.log('✓ Upload result:', uploadResult);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('فشل رفع الصورة');
      }

      // ============================================
      // الخطوة 5: تسجيل الزيارة
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 90 }));
      console.log('📝 Recording visit with image URL:', uploadResult.url);
      
      await visitMutation.mutateAsync({
        phone: phone.trim(),
        serviceType,
        branchId: selectedBranch?.id,
        branchName: selectedBranch?.name,
        invoiceImageUrl: uploadResult.url,
        invoiceImageKey: uploadResult.key,
      });
      
      setUploadState(prev => ({ ...prev, progress: 100 }));
      console.log('✓ Visit recorded successfully');
      
    } catch (error: any) {
      // ============================================
      // معالجة الأخطاء - رسائل واضحة ومفيدة
      // ============================================
      console.error('❌ Error:', error);
      
      let errorMessage = 'حدث خطأ - يرجى المحاولة مرة أخرى';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      }
      
      // تحسين رسائل الخطأ للمستخدم
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'مشكلة في الاتصال - تأكد من اتصالك بالإنترنت وحاول مرة أخرى';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'انتهت مهلة الاتصال - يرجى المحاولة مرة أخرى';
      }
      
      setUploadState(prev => ({ ...prev, error: errorMessage }));
      toast.error(errorMessage);
    } finally {
      setUploadState(prev => ({ ...prev, isUploading: false, progress: 0 }));
    }
  };

  /**
   * إعادة تعيين النموذج
   */
  const resetForm = useCallback(() => {
    setPhone('');
    setServiceType('');
    setSelectedBranch(null);
    setInvoiceImage(null);
    setInvoiceImagePreview(null);
    setUploadState({ isUploading: false, progress: 0, error: null });
    setResult(null);
  }, []);

  // ============================================
  // القيم المحسوبة
  // ============================================
  const visitsRequired = settings?.requiredVisitsForDiscount ?? 4;
  const discountPercentage = settings?.discountPercentage ?? 50;
  const isSubmitting = uploadState.isUploading || visitMutation.isPending;

  // ============================================
  // عرض نتيجة التسجيل الناجح
  // ============================================
  if (result?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="pb-2">
            {result.isDiscountVisit ? (
              <>
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                  <PartyPopper className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl text-orange-600">🎉 مبروك!</CardTitle>
                <CardDescription className="text-lg mt-2">
                  حصلت على خصم {result.discountPercentage}%!
                </CardDescription>
              </>
            ) : (
              <>
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <CardTitle className="text-2xl text-green-600">تم تسجيل الزيارة!</CardTitle>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-lg font-semibold">{result.customerName}</p>
              <div className="flex items-center justify-center gap-2 mt-2 text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>الزيارة رقم {result.visitNumberInMonth} هذا الشهر</span>
              </div>
            </div>
            
            {!result.isDiscountVisit && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  باقي {visitsRequired - (result.visitNumberInMonth || 0)} زيارات للحصول على خصم {discountPercentage}%
                </p>
              </div>
            )}
            
            <Button onClick={resetForm} className="w-full">
              تسجيل زيارة جديدة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================
  // عرض نموذج التسجيل
  // ============================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">تسجيل زيارة</CardTitle>
          <CardDescription>
            سجّل زيارتك واحصل على خصم {discountPercentage}% في الزيارة رقم {visitsRequired}!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* رقم الجوال */}
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="05xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
                dir="ltr"
                className="text-left"
              />
            </div>

            {/* نوع الخدمة */}
            <div className="space-y-2">
              <Label htmlFor="serviceType">نوع الخدمة *</Label>
              <Select value={serviceType} onValueChange={setServiceType} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الخدمة" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes && serviceTypes.length > 0 ? (
                    serviceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="حلاقة شعر">حلاقة شعر</SelectItem>
                      <SelectItem value="حلاقة ذقن">حلاقة ذقن</SelectItem>
                      <SelectItem value="حلاقة كاملة">حلاقة كاملة</SelectItem>
                      <SelectItem value="حلاقة رأس + شعر">حلاقة رأس + شعر</SelectItem>
                      <SelectItem value="صبغة">صبغة</SelectItem>
                      <SelectItem value="علاج شعر">علاج شعر</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* الفرع */}
            <div className="space-y-2">
              <Label htmlFor="branch">الفرع (اختياري)</Label>
              <Select 
                value={selectedBranch?.id?.toString() || ''} 
                onValueChange={(value) => {
                  const branch = branches?.find(b => b.id.toString() === value);
                  setSelectedBranch(branch ? { id: branch.id, name: branch.name } : null);
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* صورة الفاتورة */}
            <div className="space-y-2">
              <Label>صورة الفاتورة *</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200 ${
                  uploadState.error 
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20' 
                    : invoiceImagePreview
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'
                } ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
              >
                {invoiceImagePreview ? (
                  <div className="relative">
                    <img 
                      src={invoiceImagePreview} 
                      alt="صورة الفاتورة" 
                      className="max-h-48 mx-auto rounded-lg shadow-md"
                    />
                    {!isSubmitting && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage();
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-lg transition-colors"
                        title="إزالة الصورة"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <p className="text-green-600 text-sm mt-2 flex items-center justify-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      تم اختيار الصورة
                    </p>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                      <Camera className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">اضغط لالتقاط صورة الفاتورة</p>
                    <p className="text-xs text-gray-400 mt-1">يمكنك التقاط صورة أو اختيار من المعرض</p>
                  </div>
                )}
              </div>
              
              {/* input للكاميرا */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
                disabled={isSubmitting}
              />
              
              {/* رسالة الخطأ */}
              {uploadState.error && (
                <div className="flex items-start gap-2 text-red-600 text-sm mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span>{uploadState.error}</span>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="block text-blue-600 hover:underline mt-1"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* شريط التقدم */}
            {uploadState.isUploading && (
              <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Upload className="w-4 h-4 animate-pulse" />
                    جاري رفع الصورة...
                  </span>
                  <span className="font-medium text-blue-700 dark:text-blue-300">{uploadState.progress}%</span>
                </div>
                <Progress value={uploadState.progress} className="h-2" />
              </div>
            )}

            {/* معلومات البرنامج */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-sm">
              <p className="text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                <span className="text-lg">💡</span>
                <span>
                  <strong>كيف يعمل برنامج الولاء؟</strong>
                  <br />
                  • سجّل {visitsRequired - 1} زيارات في الشهر
                  <br />
                  • احصل على خصم {discountPercentage}% في الزيارة رقم {visitsRequired}!
                </span>
              </p>
            </div>

            {/* زر الإرسال */}
            <Button 
              type="submit" 
              className="w-full h-12 text-lg"
              disabled={isSubmitting}
            >
              {uploadState.isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  جاري رفع الصورة...
                </>
              ) : visitMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  جاري التسجيل...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5 ml-2" />
                  تسجيل الزيارة
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
