import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { Gift, CheckCircle, Loader2, Calendar, PartyPopper, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export default function LoyaltyVisit() {
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<{ id: number; name: string } | null>(null);
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null);
  const [invoiceImagePreview, setInvoiceImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{
    success: boolean;
    customerName?: string;
    isDiscountVisit?: boolean;
    discountPercentage?: number;
    visitNumberInMonth?: number;
    message?: string;
  } | null>(null);

  // جلب الفروع
  const { data: branches } = trpc.loyalty.branches.useQuery();
  
  // جلب أنواع الخدمات من قاعدة البيانات
  const { data: serviceTypes } = trpc.loyalty.getServiceTypes.useQuery();
  
  // جلب إعدادات الولاء
  const { data: settings } = trpc.loyalty.getSettings.useQuery();

  // رفع الصورة عبر tRPC
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
        
        // إطلاق الكونفيتي إذا حصل على خصم
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

  // ضغط الصورة قبل الرفع
  const compressImage = (file: File, maxWidth = 1200, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // تصغير الصورة إذا كانت كبيرة
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
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // تحويل إلى base64 مع ضغط
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('فشل تحميل الصورة'));
      };
      reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    });
  };

  // تحويل الملف إلى base64 (بدون ضغط)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // التقاط صورة من الكاميرا مباشرة
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // التحقق من نوع الملف
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى التقاط صورة فقط');
        return;
      }
      
      // التحقق من حجم الملف (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
        return;
      }
      
      setInvoiceImage(file);
      
      // إنشاء معاينة للصورة
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setInvoiceImage(null);
    setInvoiceImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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

    setIsUploading(true);
    
    try {
      // ضغط الصورة قبل الرفع لتقليل الحجم وتسريع العملية
      let base64Data: string;
      try {
        base64Data = await compressImage(invoiceImage, 1200, 0.7);
        console.log('Image compressed successfully');
      } catch (compressError) {
        console.warn('Compression failed, using original:', compressError);
        base64Data = await fileToBase64(invoiceImage);
      }
      
      // التحقق من حجم البيانات بعد الضغط
      const sizeInMB = (base64Data.length * 0.75) / (1024 * 1024);
      console.log(`Image size after compression: ${sizeInMB.toFixed(2)} MB`);
      
      if (sizeInMB > 10) {
        toast.error('حجم الصورة كبير جداً، يرجى التقاط صورة أصغر');
        setIsUploading(false);
        return;
      }
      
      // رفع الصورة عبر tRPC
      console.log('Uploading image...');
      const uploadResult = await uploadMutation.mutateAsync({
        base64Data,
        fileName: `invoice_${Date.now()}.jpg`,
        contentType: 'image/jpeg',
      });
      
      console.log('Upload result:', uploadResult);
      
      if (!uploadResult.success || !uploadResult.url) {
        toast.error('فشل رفع صورة الفاتورة - يرجى المحاولة مرة أخرى');
        setIsUploading(false);
        return;
      }

      // تسجيل الزيارة مع رابط الصورة
      console.log('Recording visit with image URL:', uploadResult.url);
      visitMutation.mutate({
        phone: phone.trim(),
        serviceType,
        branchId: selectedBranch?.id,
        branchName: selectedBranch?.name,
        invoiceImageUrl: uploadResult.url,
        invoiceImageKey: uploadResult.key,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error?.message || 'حدث خطأ أثناء رفع الصورة';
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setPhone('');
    setServiceType('');
    setInvoiceImage(null);
    setInvoiceImagePreview(null);
    setResult(null);
  };

  // عدد الزيارات المطلوبة للخصم
  const visitsRequired = settings?.requiredVisitsForDiscount ?? 4;
  const discountPercentage = settings?.discountPercentage ?? 50;

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
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p className="text-blue-700 dark:text-blue-300">
                  {result.visitNumberInMonth && result.visitNumberInMonth < visitsRequired ? (
                    <>باقي {visitsRequired - result.visitNumberInMonth} زيارات للحصول على خصم {discountPercentage}%</>
                  ) : (
                    'في انتظار الموافقة على الزيارة'
                  )}
                </p>
              </div>
            )}

            <p className="text-sm text-gray-500">
              ⏳ الزيارة في انتظار موافقة المشرف
            </p>
            
            <Button onClick={resetForm} className="w-full">
              تسجيل زيارة جديدة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="05xxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-right"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceType">نوع الخدمة *</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
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

            <div className="space-y-2">
              <Label htmlFor="branch">الفرع (اختياري)</Label>
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

            {/* التقاط صورة الفاتورة من الكاميرا مباشرة */}
            <div className="space-y-2">
              <Label>صورة الفاتورة *</Label>
              <div 
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {invoiceImagePreview ? (
                  <div className="relative">
                    <img 
                      src={invoiceImagePreview} 
                      alt="صورة الفاتورة" 
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage();
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="py-8">
                    <Camera className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500 font-medium">اضغط لالتقاط صورة الفاتورة</p>
                    <p className="text-xs text-gray-400 mt-1">سيتم فتح الكاميرا مباشرة</p>
                  </div>
                )}
              </div>
              {/* input مخفي للكاميرا فقط */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
              />
            </div>

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

            <Button 
              type="submit" 
              className="w-full" 
              disabled={visitMutation.isPending || isUploading}
            >
              {(visitMutation.isPending || isUploading) ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري التسجيل...
                </>
              ) : (
                'تسجيل الزيارة'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
