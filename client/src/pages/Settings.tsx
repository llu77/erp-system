import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Building2,
  FileText,
  Wallet,
  Package,
  Save,
  RefreshCw,
  Globe,
  Phone,
  Mail,
  MapPin,
  Hash,
  DollarSign,
  Calendar,
  Percent,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface SettingValue {
  key: string;
  value: string | null;
  type: string;
  category: string;
  description: string | null;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: allSettings, isLoading: loadingSettings, refetch } = trpc.settings.list.useQuery();
  const bulkUpdateMutation = trpc.settings.bulkUpdate.useMutation();
  const initializeMutation = trpc.settings.initialize.useMutation();

  // تحميل الإعدادات إلى الحالة المحلية
  useEffect(() => {
    if (allSettings) {
      const settingsMap: Record<string, string> = {};
      allSettings.forEach((s: SettingValue) => {
        settingsMap[s.key] = s.value || "";
      });
      setSettings(settingsMap);
    }
  }, [allSettings]);

  // تحديث قيمة إعداد
  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // حفظ جميع التغييرات
  const saveAllSettings = async () => {
    setIsLoading(true);
    try {
      const settingsToUpdate = Object.entries(settings).map(([key, value]) => ({
        key,
        value: value || null,
      }));
      
      await bulkUpdateMutation.mutateAsync(settingsToUpdate);
      toast.success("تم حفظ الإعدادات بنجاح");
      setHasChanges(false);
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setIsLoading(false);
    }
  };

  // تهيئة الإعدادات الافتراضية
  const initializeSettings = async () => {
    try {
      await initializeMutation.mutateAsync();
      toast.success("تم تهيئة الإعدادات الافتراضية");
      refetch();
    } catch (error) {
      toast.error("حدث خطأ أثناء تهيئة الإعدادات");
    }
  };

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <CardTitle>إعدادات النظام</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={initializeSettings} disabled={initializeMutation.isPending}>
                <RefreshCw className={`h-4 w-4 ml-2 ${initializeMutation.isPending ? 'animate-spin' : ''}`} />
                استعادة الافتراضي
              </Button>
              <Button onClick={saveAllSettings} disabled={!hasChanges || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
                )}
                حفظ التغييرات
              </Button>
            </div>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2 text-yellow-600 text-sm mt-2">
              <AlertTriangle className="h-4 w-4" />
              <span>لديك تغييرات غير محفوظة</span>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Settings Tabs */}
      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">الشركة</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">النظام</span>
          </TabsTrigger>
          <TabsTrigger value="invoice" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">الفواتير</span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">الرواتب</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">المخزون</span>
          </TabsTrigger>
        </TabsList>

        {/* Company Settings */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                معلومات الشركة
              </CardTitle>
              <CardDescription>
                إعدادات معلومات الشركة الأساسية التي تظهر في الفواتير والتقارير
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    اسم الشركة (عربي)
                  </Label>
                  <Input
                    id="company_name"
                    value={settings.company_name || ""}
                    onChange={(e) => updateSetting("company_name", e.target.value)}
                    placeholder="أدخل اسم الشركة بالعربية"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name_en" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    اسم الشركة (إنجليزي)
                  </Label>
                  <Input
                    id="company_name_en"
                    value={settings.company_name_en || ""}
                    onChange={(e) => updateSetting("company_name_en", e.target.value)}
                    placeholder="Enter company name in English"
                    dir="ltr"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    رقم الهاتف
                  </Label>
                  <Input
                    id="company_phone"
                    value={settings.company_phone || ""}
                    onChange={(e) => updateSetting("company_phone", e.target.value)}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    البريد الإلكتروني
                  </Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={settings.company_email || ""}
                    onChange={(e) => updateSetting("company_email", e.target.value)}
                    placeholder="info@company.com"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  العنوان
                </Label>
                <Textarea
                  id="company_address"
                  value={settings.company_address || ""}
                  onChange={(e) => updateSetting("company_address", e.target.value)}
                  placeholder="أدخل عنوان الشركة الكامل"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_website" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  الموقع الإلكتروني
                </Label>
                <Input
                  id="company_website"
                  value={settings.company_website || ""}
                  onChange={(e) => updateSetting("company_website", e.target.value)}
                  placeholder="https://www.company.com"
                  dir="ltr"
                />
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_tax_number" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    الرقم الضريبي
                  </Label>
                  <Input
                    id="company_tax_number"
                    value={settings.company_tax_number || ""}
                    onChange={(e) => updateSetting("company_tax_number", e.target.value)}
                    placeholder="300xxxxxxxxx"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_cr_number" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    رقم السجل التجاري
                  </Label>
                  <Input
                    id="company_cr_number"
                    value={settings.company_cr_number || ""}
                    onChange={(e) => updateSetting("company_cr_number", e.target.value)}
                    placeholder="xxxxxxxxxx"
                    dir="ltr"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                إعدادات النظام
              </CardTitle>
              <CardDescription>
                إعدادات عامة للنظام مثل العملة والتاريخ واللغة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="currency" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    رمز العملة (ISO)
                  </Label>
                  <Input
                    id="currency"
                    value={settings.currency || "SAR"}
                    onChange={(e) => updateSetting("currency", e.target.value)}
                    placeholder="SAR"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency_symbol" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    رمز العملة (للعرض)
                  </Label>
                  <Input
                    id="currency_symbol"
                    value={settings.currency_symbol || "ر.س"}
                    onChange={(e) => updateSetting("currency_symbol", e.target.value)}
                    placeholder="ر.س"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date_format" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    تنسيق التاريخ
                  </Label>
                  <Input
                    id="date_format"
                    value={settings.date_format || "yyyy-MM-dd"}
                    onChange={(e) => updateSetting("date_format", e.target.value)}
                    placeholder="yyyy-MM-dd"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    المنطقة الزمنية
                  </Label>
                  <Input
                    id="timezone"
                    value={settings.timezone || "Asia/Riyadh"}
                    onChange={(e) => updateSetting("timezone", e.target.value)}
                    placeholder="Asia/Riyadh"
                    dir="ltr"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice Settings */}
        <TabsContent value="invoice">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                إعدادات الفواتير
              </CardTitle>
              <CardDescription>
                إعدادات ترقيم الفواتير والضريبة والملاحظات الافتراضية
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoice_prefix" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    بادئة رقم الفاتورة
                  </Label>
                  <Input
                    id="invoice_prefix"
                    value={settings.invoice_prefix || "INV-"}
                    onChange={(e) => updateSetting("invoice_prefix", e.target.value)}
                    placeholder="INV-"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_start_number" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    رقم بداية الفواتير
                  </Label>
                  <Input
                    id="invoice_start_number"
                    type="number"
                    value={settings.invoice_start_number || "1000"}
                    onChange={(e) => updateSetting("invoice_start_number", e.target.value)}
                    placeholder="1000"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_tax_rate" className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  نسبة الضريبة (%)
                </Label>
                <Input
                  id="invoice_tax_rate"
                  type="number"
                  value={settings.invoice_tax_rate || "15"}
                  onChange={(e) => updateSetting("invoice_tax_rate", e.target.value)}
                  placeholder="15"
                  dir="ltr"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="invoice_notes" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  ملاحظات الفاتورة الافتراضية
                </Label>
                <Textarea
                  id="invoice_notes"
                  value={settings.invoice_notes || ""}
                  onChange={(e) => updateSetting("invoice_notes", e.target.value)}
                  placeholder="أدخل ملاحظات تظهر في أسفل الفاتورة"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_terms" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  شروط وأحكام الفاتورة
                </Label>
                <Textarea
                  id="invoice_terms"
                  value={settings.invoice_terms || ""}
                  onChange={(e) => updateSetting("invoice_terms", e.target.value)}
                  placeholder="أدخل الشروط والأحكام"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Settings */}
        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                إعدادات الرواتب
              </CardTitle>
              <CardDescription>
                إعدادات حساب الرواتب والبدلات والحوافز
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payroll_base_salary" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    الراتب الأساسي الافتراضي
                  </Label>
                  <Input
                    id="payroll_base_salary"
                    type="number"
                    value={settings.payroll_base_salary || "2000"}
                    onChange={(e) => updateSetting("payroll_base_salary", e.target.value)}
                    placeholder="2000"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll_overtime_rate" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    بدل الساعات الإضافية
                  </Label>
                  <Input
                    id="payroll_overtime_rate"
                    type="number"
                    value={settings.payroll_overtime_rate || "1000"}
                    onChange={(e) => updateSetting("payroll_overtime_rate", e.target.value)}
                    placeholder="1000"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="payroll_supervisor_bonus" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    حوافز المشرف
                  </Label>
                  <Input
                    id="payroll_supervisor_bonus"
                    type="number"
                    value={settings.payroll_supervisor_bonus || "400"}
                    onChange={(e) => updateSetting("payroll_supervisor_bonus", e.target.value)}
                    placeholder="400"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payroll_day" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    يوم صرف الرواتب
                  </Label>
                  <Input
                    id="payroll_day"
                    type="number"
                    min="1"
                    max="28"
                    value={settings.payroll_day || "28"}
                    onChange={(e) => updateSetting("payroll_day", e.target.value)}
                    placeholder="28"
                    dir="ltr"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Settings */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                إعدادات المخزون
              </CardTitle>
              <CardDescription>
                إعدادات تنبيهات المخزون وإعادة الطلب
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="inventory_low_stock_alert" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  حد التنبيه لنفاد المخزون
                </Label>
                <Input
                  id="inventory_low_stock_alert"
                  type="number"
                  value={settings.inventory_low_stock_alert || "10"}
                  onChange={(e) => updateSetting("inventory_low_stock_alert", e.target.value)}
                  placeholder="10"
                  dir="ltr"
                />
                <p className="text-sm text-muted-foreground">
                  سيتم إرسال تنبيه عندما تقل كمية المنتج عن هذا الحد
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    إعادة الطلب التلقائي
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    إنشاء طلب شراء تلقائي عند نفاد المخزون
                  </p>
                </div>
                <Switch
                  checked={settings.inventory_auto_reorder === "true"}
                  onCheckedChange={(checked) =>
                    updateSetting("inventory_auto_reorder", checked ? "true" : "false")
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
