import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { Gift, CheckCircle, Loader2, Calendar, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// أنواع الخدمات
const serviceTypes = [
  'قص شعر',
  'حلاقة ذقن',
  'قص + حلاقة',
  'صبغة شعر',
  'علاج شعر',
  'تنظيف بشرة',
  'مساج',
  'خدمة أخرى',
];

export default function LoyaltyVisit() {
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<{ id: number; name: string } | null>(null);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim() || phone.length < 10) {
      toast.error('الرجاء إدخال رقم جوال صحيح');
      return;
    }
    if (!serviceType) {
      toast.error('الرجاء اختيار نوع الخدمة');
      return;
    }

    visitMutation.mutate({
      phone: phone.trim(),
      serviceType,
      branchId: selectedBranch?.id,
      branchName: selectedBranch?.name,
    });
  };

  const resetForm = () => {
    setPhone('');
    setServiceType('');
    setResult(null);
  };

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
                    استمتع بخصم 50% على فاتورتك اليوم!
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
                  {result.visitNumberInMonth && result.visitNumberInMonth < 4 && (
                    <p className="text-sm text-green-600">
                      باقي {4 - result.visitNumberInMonth} زيارات للحصول على خصم 50%!
                    </p>
                  )}
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
            سجّل زيارتك واقترب من خصم 50%!
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
                  {serviceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
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

            <div className="bg-blue-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-700 mb-1">💡 كيف يعمل برنامج الولاء؟</p>
              <ul className="text-blue-600 space-y-1">
                <li>• سجّل 3 زيارات في الشهر</li>
                <li>• احصل على خصم 50% في الزيارة الرابعة!</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={visitMutation.isPending}
            >
              {visitMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
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
