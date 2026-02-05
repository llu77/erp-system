import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, User, Store, Users } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.auth.localLogin.useMutation({
    onSuccess: (data) => {
      toast.success("تم تسجيل الدخول بنجاح");
      // إعادة تحميل الصفحة لتحديث حالة المصادقة
      window.location.href = "/";
    },
    onError: (error) => {
      toast.error(error.message || "فشل تسجيل الدخول");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast.error("الرجاء إدخال اسم المستخدم");
      return;
    }
    
    if (!password.trim()) {
      toast.error("الرجاء إدخال كلمة المرور");
      return;
    }

    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4" dir="rtl">
      {/* خلفية زخرفية */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-slate-700 bg-slate-800/50 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          {/* اللوجو تم إزالته للاختبار */}
          <div>
            <CardTitle className="text-2xl font-bold text-white">Symbol AI</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              نظام إدارة الأعمال الذكي
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">اسم المستخدم</Label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="username"
                  type="text"
                  placeholder="أدخل اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                  disabled={loginMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="أدخل كلمة المرور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                  disabled={loginMutation.isPending}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700 space-y-3">
            {/* بوابات الدخول الأخرى */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white h-12"
                onClick={() => setLocation('/employee-login')}
              >
                <Users className="ml-2 h-4 w-4" />
                بوابة الموظفين
              </Button>
              
              <Button
                variant="outline"
                className="border-amber-600/50 text-amber-400 hover:bg-amber-600/20 hover:text-amber-300 hover:border-amber-500 h-12"
                onClick={() => setLocation('/pos-login')}
              >
                <Store className="ml-2 h-4 w-4" />
                بوابة الكاشير
              </Button>
            </div>
            
            <p className="text-center text-sm text-slate-500 pt-2">
              Symbol AI - جميع الحقوق محفوظة
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
