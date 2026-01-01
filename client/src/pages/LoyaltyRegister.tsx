import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { Gift, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// أنواع الخدمات
const serviceTypes = [
  'قص شعر',
  'حلاقة ذقن',
  'قص + حلاقة',
  'حلاقة رأس + شعر',
  'صبغة شعر',
  'علاج شعر',
  'تنظيف بشرة',
  'مساج',
  'خدمة أخرى',
];

export default function LoyaltyRegister() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<{ id: number; name: string } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // جلب الفروع
  const { data: branches } = trpc.loyalty.branches.useQuery();

  // تسجيل العميل
  const registerMutation = trpc.loyalty.register.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setIsSuccess(true);
        setSuccessMessage(data.message || 'تم التسجيل بنجاح!');
        // إطلاق الكونفيتي
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
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

    registerMutation.mutate({
      name: name.trim(),
      phone: phone.trim(),
      serviceType,
      branchId: selectedBranch?.id,
      branchName: selectedBranch?.name,
    });
  };

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
                🎁 مع كل 3 زيارات في الشهر، تحصل على خصم 50% في الزيارة الرابعة!
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
            سجّل الآن واحصل على خصم 50% في زيارتك الرابعة كل شهر!
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
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التسجيل...
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
