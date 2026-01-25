import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, Bell, Shield, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface EmailSetupModalProps {
  isOpen: boolean;
  employeeId: number;
  employeeName: string;
  onSuccess: () => void;
}

export function EmailSetupModal({ isOpen, employeeId, employeeName, onSuccess }: EmailSetupModalProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setupEmailMutation = trpc.employeePortal.setupEmail.useMutation();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('الرجاء إدخال البريد الإلكتروني');
      return;
    }

    if (!validateEmail(email)) {
      setError('الرجاء إدخال بريد إلكتروني صحيح');
      return;
    }

    setIsSubmitting(true);

    try {
      await setupEmailMutation.mutateAsync({
        employeeId,
        email: email.trim(),
      });

      toast.success('تم حفظ البريد الإلكتروني بنجاح');
      onSuccess();
    } catch (err) {
      setError('حدث خطأ أثناء حفظ البريد الإلكتروني');
      toast.error('فشل في حفظ البريد الإلكتروني');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md bg-slate-800 border-slate-700 text-white"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-xl text-white text-center">
            مرحباً {employeeName}! 👋
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-center mt-2">
            للاستمرار في استخدام بوابة الموظفين، يرجى إدخال بريدك الإلكتروني لاستلام الإشعارات المهمة
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* مميزات البريد الإلكتروني */}
          <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Bell className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-slate-300">استلام إشعارات الموافقة على الطلبات</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-slate-300">تنبيهات أمنية لحسابك</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-slate-300">كشوف الرواتب الشهرية</span>
            </div>
          </div>

          {/* حقل البريد الإلكتروني */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
              البريد الإلكتروني <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="example@email.com"
                className="pr-10 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500"
                dir="ltr"
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
          </div>

          {/* زر الحفظ */}
          <Button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white h-11"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 ml-2" />
                حفظ والمتابعة
              </>
            )}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            بريدك الإلكتروني محمي ولن يتم مشاركته مع أي جهة خارجية
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
