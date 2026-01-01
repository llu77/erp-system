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

const FORGE_API_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL;
const FORGE_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;

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

  // رفع الصورة إلى S3
  const uploadImage = async (file: File): Promise<{ url: string; key: string } | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${FORGE_API_URL}/storage/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FORGE_API_KEY}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('فشل رفع الصورة');
      }
      
      const data = await response.json();
      return { url: data.url, key: data.key };
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // التحقق من نوع الملف
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار صورة فقط');
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
      toast.error('الرجاء رفع صورة الفاتورة');
      return;
    }

    setIsUploading(true);
    
    try {
      // رفع الصورة أولاً
      const uploadResult = await uploadImage(invoiceImage);
      if (!uploadResult) {
        toast.error('فشل رفع صورة الفاتورة');
        setIsUploading(false);
        return;
      }

      // تسجيل الزيارة مع رابط الصورة
      visitMutation.mutate({
        phone: phone.trim(),
        serviceType,
        branchId: selectedBranch?.id,
        branchName: selectedBranch?.name,
        invoiceImageUrl: uploadResult.url,
        invoiceImageKey: uploadResult.key,
      });
    } catch (error) {
      toast.error('حدث خطأ أثناء التسجيل');
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

  // القيم الافتراضية للإعدادات
  const requiredVisits = settings?.requiredVisitsForDiscount || 4;
  const discountPercent = settings?.discountPercentage || 50;

  if (result?.success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${
        result.isDiscountVisit 
          ? 'bg-gradient-to-br from-yellow-50 to-amber-100' 
          : 'bg-gradient-to-br from-green-50 to-emerald-100'
      }`}>
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-10">
            {result.isDiscountVisit ? (
              <>
                <div className="mb-6">
                  <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <PartyPopper className="h-14 w-14 text-white" />
                  </div>
                  <h1 className="text-3xl font-bold text-yellow-600 mb-2">🎉 مبروك!</h1>
                  <p className="text-xl text-gray-700 mb-4">لقد حصلت على خصم {result.discountPercentage}%!</p>
                  <p className="text-2xl font-bold text-yellow-700">يومك سعيد {result.customerName}!</p>
                </div>
                
                <div className="bg-yellow-100 rounded-lg p-4 mb-6 border-2 border-yellow-400">
                  <p className="text-lg text-yellow-800 font-medium">
                    🎁 هذه زيارتك رقم {result.visitNumberInMonth} هذا الشهر
                  </p>
                  <p className="text-yellow-700 mt-2">
                    استمتع بخصم {discountPercent}% على فاتورتك اليوم!
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-700">
                    ⏳ سيتم مراجعة زيارتك والموافقة عليها من قبل المشرف
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-12 w-12 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-green-600 mb-2">تم تسجيل زيارتك!</h1>
                  <p className="text-gray-600">{result.message}</p>
                </div>
                
                <div className="bg-green-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700">زيارتك رقم {result.visitNumberInMonth} هذا الشهر</span>
                  </div>
                  {result.visitNumberInMonth && result.visitNumberInMonth < requiredVisits && (
                    <p className="text-sm text-green-600">
                      باقي {requiredVisits - result.visitNumberInMonth} زيارات للحصول على خصم {discountPercent}%!
                    </p>
                  )}
                </div>

                <div className="bg-yellow-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-700">
                    ⏳ سيتم مراجعة زيارتك والموافقة عليها من قبل المشرف
                  </p>
                </div>
              </>
            )}

            <Button onClick={resetForm} variant="outline" className="w-full">
              تسجيل زيارة جديدة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl">تسجيل زيارة</CardTitle>
          <CardDescription>
            سجّل زيارتك واقترب من خصم {discountPercent}%!
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
              <Label>الفرع (اختياري)</Label>
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
                    <p className="text-xs text-gray-400">PNG, JPG حتى 5MB</p>
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
            </div>

            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-700 mb-1">💡 كيف يعمل برنامج الولاء؟</p>
              <ul className="text-blue-600 space-y-1">
                <li>• سجّل {requiredVisits - 1} زيارات في الشهر</li>
                <li>• احصل على خصم {discountPercent}% في الزيارة رقم {requiredVisits}!</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={visitMutation.isPending || isUploading}
            >
              {(visitMutation.isPending || isUploading) ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  {isUploading ? 'جاري رفع الصورة...' : 'جاري التسجيل...'}
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
