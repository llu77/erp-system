import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { Gift, CheckCircle, Loader2, Camera, X, ImageIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Progress } from '@/components/ui/progress';

// ============================================
// ثوابت الضغط والتحقق
// ============================================
const COMPRESSION_CONFIG = {
  maxWidth: 800,
  quality: 0.6,
  fallbackMaxWidth: 600,
  fallbackQuality: 0.4,
};

const FILE_CONFIG = {
  maxSizeMB: 10,
  allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
};

// ============================================
// دوال مساعدة
// ============================================

/**
 * ضغط الصورة وتحويلها إلى base64
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
          
          // تصغير الصورة إذا كانت أكبر من الحد الأقصى
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('فشل إنشاء canvas'));
            return;
          }
          
          // رسم خلفية بيضاء (للصور الشفافة)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve(base64);
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
 * حساب حجم base64 بالميجابايت
 */
const getBase64SizeInMB = (base64: string): number => {
  const base64Length = base64.length - (base64.indexOf(',') + 1);
  const sizeInBytes = (base64Length * 3) / 4;
  return sizeInBytes / (1024 * 1024);
};

/**
 * التحقق من صحة الملف
 */
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // التحقق من نوع الملف
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'يرجى اختيار صورة فقط' };
  }
  
  // التحقق من الحجم
  const sizeInMB = file.size / (1024 * 1024);
  if (sizeInMB > FILE_CONFIG.maxSizeMB) {
    return { valid: false, error: `حجم الصورة كبير جداً (${sizeInMB.toFixed(1)}MB). الحد الأقصى ${FILE_CONFIG.maxSizeMB}MB` };
  }
  
  return { valid: true };
};

// ============================================
// المكون الرئيسي
// ============================================
export default function LoyaltyRegister() {
  // حالة النموذج
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<{ id: number; name: string } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // حالة الصورة
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null);
  const [invoiceImagePreview, setInvoiceImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // حالة الرفع
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    progress: 0,
    error: null as string | null,
  });

  // جلب البيانات
  const { data: branches } = trpc.loyalty.branches.useQuery();
  const { data: serviceTypes } = trpc.loyalty.getServiceTypes.useQuery();
  const { data: settings } = trpc.loyalty.getSettings.useQuery();

  // رفع الصورة - استخدام نفس API الناجح في صفحة الزيارة
  const uploadMutation = trpc.loyalty.uploadInvoiceImage.useMutation();

  // تسجيل العميل
  const registerMutation = trpc.loyalty.register.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setIsSuccess(true);
        setSuccessMessage(data.message || 'تم التسجيل بنجاح!');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        toast.error(data.error || 'حدث خطأ أثناء التسجيل');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء التسجيل');
    },
  });

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
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق من البيانات
    if (!name.trim()) {
      toast.error('الرجاء إدخال الاسم');
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      toast.error('الرجاء إدخال رقم جوال صحيح');
      return;
    }
    if (!serviceType) {
      toast.error('الرجاء اختيار نوع الخدمة');
      return;
    }
    if (!selectedBranch) {
      toast.error('الرجاء اختيار الفرع');
      return;
    }
    if (!invoiceImage) {
      toast.error('الرجاء رفع صورة الفاتورة');
      return;
    }

    // بدء عملية الرفع
    setUploadState({ isUploading: true, progress: 10, error: null });
    
    try {
      // ============================================
      // الخطوة 1: ضغط الصورة
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 20 }));
      console.log('🔄 Compressing image...');
      
      let base64Data: string;
      
      try {
        base64Data = await compressImage(
          invoiceImage, 
          COMPRESSION_CONFIG.maxWidth, 
          COMPRESSION_CONFIG.quality
        );
        console.log('✓ Image compressed successfully');
      } catch (compressError) {
        console.warn('⚠ Primary compression failed, trying fallback:', compressError);
        try {
          base64Data = await compressImage(
            invoiceImage, 
            COMPRESSION_CONFIG.fallbackMaxWidth, 
            COMPRESSION_CONFIG.fallbackQuality
          );
          console.log('✓ Image compressed with fallback settings');
        } catch (fallbackError) {
          throw new Error('فشل ضغط الصورة - يرجى اختيار صورة أخرى');
        }
      }
      
      // ============================================
      // الخطوة 2: التحقق من الحجم بعد الضغط
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 40 }));
      
      const sizeInMB = getBase64SizeInMB(base64Data);
      console.log(`📊 Image size after compression: ${sizeInMB.toFixed(2)} MB`);
      
      if (sizeInMB > 5) {
        throw new Error('حجم الصورة كبير جداً حتى بعد الضغط - يرجى اختيار صورة أصغر');
      }
      
      // ============================================
      // الخطوة 3: رفع الصورة إلى السيرفر
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 50 }));
      console.log('📤 Uploading image to server...');
      
      const uploadResult = await uploadMutation.mutateAsync({
        base64Data,
        fileName: `register_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      });
      
      setUploadState(prev => ({ ...prev, progress: 80 }));
      console.log('✓ Upload result:', uploadResult);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('فشل رفع صورة الفاتورة');
      }

      // ============================================
      // الخطوة 4: تسجيل العميل
      // ============================================
      setUploadState(prev => ({ ...prev, progress: 90 }));
      console.log('📝 Registering customer with image URL:', uploadResult.url);
      
      await registerMutation.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        serviceType,
        branchId: selectedBranch?.id,
        branchName: selectedBranch?.name,
        invoiceImageUrl: uploadResult.url,
        invoiceImageKey: uploadResult.key,
      });
      
      setUploadState(prev => ({ ...prev, progress: 100 }));
      console.log('✓ Customer registered successfully');
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      
      let errorMessage = 'حدث خطأ - يرجى المحاولة مرة أخرى';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      }
      
      // تحسين رسائل الخطأ
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

  // القيم الافتراضية للإعدادات
  const requiredVisits = settings?.requiredVisitsForDiscount || 4;
  const discountPercent = settings?.discountPercentage || 50;

  // شاشة النجاح
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10">
            <div className="mb-6">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-green-600 mb-2">تم التسجيل بنجاح!</h1>
              <p className="text-gray-600">{successMessage}</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-700">
                🎁 في كل {requiredVisits} زيارات، الزيارة رقم {requiredVisits} بخصم {discountPercent}%!
              </p>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-700">
                ⏳ سيتم مراجعة زيارتك والموافقة عليها من قبل المشرف
              </p>
            </div>

            <p className="text-sm text-gray-500">
              شكراً لانضمامك لبرنامج الولاء
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Gift className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">برنامج الولاء</CardTitle>
          <CardDescription>
            سجّل الآن واحصل على خصم {discountPercent}% في زيارتك الثالثة كل شهر!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم الكامل *</Label>
              <Input
                id="name"
                placeholder="أدخل اسمك"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="05xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>نوع الخدمة *</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الخدمة" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes?.filter(t => t.isActive).map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الفرع *</Label>
              <Select 
                value={selectedBranch?.id?.toString() || ''} 
                onValueChange={(value) => {
                  const branch = branches?.find(b => b.id.toString() === value);
                  setSelectedBranch(branch ? { id: branch.id, name: branch.name } : null);
                }}
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

            {/* رفع صورة الفاتورة */}
            <div className="space-y-2">
              <Label>صورة الفاتورة *</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                {invoiceImagePreview ? (
                  <div className="relative">
                    <img 
                      src={invoiceImagePreview} 
                      alt="صورة الفاتورة" 
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 left-2"
                      onClick={removeImage}
                      disabled={uploadState.isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex flex-col items-center justify-center py-6 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                      <Camera className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600 mb-1">اضغط لرفع صورة الفاتورة</p>
                    <p className="text-xs text-gray-400">PNG, JPG حتى 10MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
              
              {/* شريط التقدم */}
              {uploadState.isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadState.progress} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    {uploadState.progress < 40 ? 'جاري ضغط الصورة...' :
                     uploadState.progress < 80 ? 'جاري رفع الصورة...' :
                     'جاري التسجيل...'}
                  </p>
                </div>
              )}
              
              {/* رسالة الخطأ */}
              {uploadState.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <span className="text-red-500 text-sm">{uploadState.error}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-1 text-red-600 hover:text-red-700"
                    onClick={() => setUploadState(prev => ({ ...prev, error: null }))}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <p className="font-medium mb-1">📅 التاريخ:</p>
              <p>{new Date().toLocaleDateString('ar-SA', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={registerMutation.isPending || uploadState.isUploading}
            >
              {(registerMutation.isPending || uploadState.isUploading) ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {uploadState.progress < 80 ? 'جاري رفع الصورة...' : 'جاري التسجيل...'}
                </>
              ) : (
                'تسجيل في برنامج الولاء'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
