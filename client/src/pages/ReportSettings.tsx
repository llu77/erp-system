import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Mail, 
  Calendar, 
  Clock, 
  Send,
  FileText,
  Package,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";

export default function ReportSettings() {
  const [email, setEmail] = useState('info@symbolai.net');
  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [lowStockEnabled, setLowStockEnabled] = useState(true);
  const [monthlyEnabled, setMonthlyEnabled] = useState(true);

  // إرسال التقارير
  const sendWeekly = trpc.scheduledReports.sendWeekly.useMutation({
    onSuccess: () => toast.success('تم إرسال التقرير الأسبوعي بنجاح'),
    onError: (error) => toast.error(error.message),
  });

  const sendLowStock = trpc.scheduledReports.sendLowStock.useMutation({
    onSuccess: () => toast.success('تم إرسال تنبيه المخزون بنجاح'),
    onError: (error) => toast.error(error.message),
  });

  const sendMonthlyProfit = trpc.scheduledReports.sendMonthlyProfit.useMutation({
    onSuccess: () => toast.success('تم إرسال تقرير الأرباح بنجاح'),
    onError: (error) => toast.error(error.message),
  });

  const isAnyLoading = sendWeekly.isPending || sendLowStock.isPending || sendMonthlyProfit.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" />
          إعدادات التقارير الدورية
        </h1>
        <p className="text-muted-foreground">إدارة التقارير التلقائية والإشعارات بالبريد الإلكتروني</p>
      </div>

      {/* إعدادات البريد الإلكتروني */}
      <Card>
        <CardHeader>
          <CardTitle>البريد الإلكتروني المستلم</CardTitle>
          <CardDescription>عنوان البريد الإلكتروني الذي ستُرسل إليه التقارير</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                dir="ltr"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* أنواع التقارير */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* التقرير الأسبوعي */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                التقرير الأسبوعي
              </CardTitle>
              <Switch
                checked={weeklyEnabled}
                onCheckedChange={setWeeklyEnabled}
              />
            </div>
            <CardDescription>
              ملخص شامل للمبيعات والمخزون والأرباح
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>كل يوم أحد</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>الساعة 8:00 صباحاً</span>
              </div>
              <Separator />
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  ملخص المبيعات
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  أفضل المنتجات
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  أفضل العملاء
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  حالة المخزون
                </li>
              </ul>
              <Button 
                className="w-full mt-4"
                onClick={() => sendWeekly.mutate({ email })}
                disabled={isAnyLoading || !email}
              >
                {sendWeekly.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال الآن
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* تنبيه المخزون */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-500" />
                تنبيه المخزون
              </CardTitle>
              <Switch
                checked={lowStockEnabled}
                onCheckedChange={setLowStockEnabled}
              />
            </div>
            <CardDescription>
              تنبيه عند انخفاض المخزون أو قرب انتهاء الصلاحية
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>يومياً</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>الساعة 7:00 صباحاً</span>
              </div>
              <Separator />
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  منتجات تحت الحد الأدنى
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  منتجات قريبة الانتهاء
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  اقتراحات إعادة الطلب
                </li>
              </ul>
              <Button 
                className="w-full mt-4"
                variant="outline"
                onClick={() => sendLowStock.mutate({ email })}
                disabled={isAnyLoading || !email}
              >
                {sendLowStock.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال الآن
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* تقرير الأرباح الشهري */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                تقرير الأرباح
              </CardTitle>
              <Switch
                checked={monthlyEnabled}
                onCheckedChange={setMonthlyEnabled}
              />
            </div>
            <CardDescription>
              تقرير شهري مفصل للأرباح والخسائر
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>أول كل شهر</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>الساعة 9:00 صباحاً</span>
              </div>
              <Separator />
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  مؤشرات الأداء المالي
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  هامش الربح
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  العائد على الاستثمار
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  نسبة السيولة
                </li>
              </ul>
              <Button 
                className="w-full mt-4"
                variant="outline"
                onClick={() => sendMonthlyProfit.mutate({ email })}
                disabled={isAnyLoading || !email}
              >
                {sendMonthlyProfit.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال الآن
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* معلومات إضافية */}
      <Card>
        <CardHeader>
          <CardTitle>ملاحظات</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• يتم إرسال التقارير تلقائياً حسب الجدول المحدد عند تفعيل الخيار</li>
            <li>• يمكنك إرسال أي تقرير يدوياً في أي وقت بالضغط على "إرسال الآن"</li>
            <li>• تأكد من صحة عنوان البريد الإلكتروني قبل تفعيل التقارير</li>
            <li>• قد تستغرق التقارير بضع ثوانٍ للوصول إلى بريدك الإلكتروني</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
