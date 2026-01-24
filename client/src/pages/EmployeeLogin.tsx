import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc';
import { Loader2, Sparkles, User, Lock, AlertCircle, ArrowLeft } from 'lucide-react';

export default function EmployeeLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loginMutation = trpc.employeeAuth.login.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await loginMutation.mutateAsync({
        username: username.trim(),
        password,
      });

      if (result.success && result.employee) {
        // حفظ معلومات الموظف في localStorage
        localStorage.setItem('employeeInfo', JSON.stringify(result.employee));
        localStorage.setItem('employeeToken', 'employee-session');
        
        // التوجيه لبوابة الموظفين
        setLocation('/employee-portal');
      } else {
        setError(result.error || 'حدث خطأ في تسجيل الدخول');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ في تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" dir="rtl">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMjIiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTR2Mkgy NHYtMmgxMnptMC00djJIMjR2LTJoMTJ6bTAtNHYySDI0di0yaDEyem0wLTR2MkgyNHYtMmgxMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
      
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-2xl mb-4 shadow-lg shadow-amber-500/20">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Symbol AI</h1>
          <p className="text-slate-400">بوابة الموظفين</p>
        </div>

        <Card className="bg-slate-800/80 backdrop-blur-sm border-slate-700 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl text-white">تسجيل الدخول</CardTitle>
            <CardDescription className="text-slate-400">
              أدخل بيانات حسابك للوصول إلى البوابة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">اسم المستخدم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="أدخل اسم المستخدم"
                    className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور"
                    className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-amber-500"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium py-5"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  'تسجيل الدخول'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <Button
                variant="ghost"
                className="w-full text-slate-400 hover:text-white hover:bg-slate-700"
                onClick={() => setLocation('/login')}
              >
                <ArrowLeft className="h-4 w-4 ml-2" />
                العودة لتسجيل دخول المشرفين
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © 2024 Symbol AI - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
