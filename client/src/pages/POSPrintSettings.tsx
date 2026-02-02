/**
 * POSPrintSettings - صفحة إعدادات الطباعة الحرارية
 * 
 * تتيح للأدمن تخصيص:
 * - حجم الورق (58mm / 80mm)
 * - حجم الخط
 * - الشعار والرسائل
 * - إعدادات الطباعة التلقائية
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Printer, Save, Eye, Settings2, Type, Image, MessageSquare } from 'lucide-react';
import { Link } from 'wouter';
import { useThermalPrinter, DEFAULT_SETTINGS, type PrinterSettings, type ReceiptData } from '@/components/ThermalReceiptPrinter';

export default function POSPrintSettings() {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  
  // جلب الفروع
  const { data: branches } = trpc.pos.branches.list.useQuery();
  
  // جلب إعدادات الطباعة للفرع المحدد
  const { data: savedSettings, refetch: refetchSettings } = trpc.pos.printSettings.get.useQuery(
    { branchId: selectedBranchId! },
    { enabled: !!selectedBranchId }
  );
  
  // حفظ الإعدادات
  const saveMutation = trpc.pos.printSettings.save.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ إعدادات الطباعة بنجاح');
      refetchSettings();
    },
    onError: (error) => {
      toast.error(`فشل حفظ الإعدادات: ${error.message}`);
    },
  });
  
  // تحديث الإعدادات عند تحميلها
  useEffect(() => {
    if (savedSettings) {
      setSettings({
        autoPrint: savedSettings.autoPrint ?? DEFAULT_SETTINGS.autoPrint,
        showQRCode: savedSettings.showQRCode ?? DEFAULT_SETTINGS.showQRCode,
        paperWidth: (savedSettings.paperWidth as '58mm' | '80mm') ?? DEFAULT_SETTINGS.paperWidth,
        fontSize: (savedSettings.fontSize as 'small' | 'medium' | 'large') ?? DEFAULT_SETTINGS.fontSize,
        showLogo: savedSettings.showLogo ?? DEFAULT_SETTINGS.showLogo,
        showBranchPhone: savedSettings.showBranchPhone ?? DEFAULT_SETTINGS.showBranchPhone,
        showEmployeeName: savedSettings.showEmployeeName ?? DEFAULT_SETTINGS.showEmployeeName,
        storeName: savedSettings.storeName ?? DEFAULT_SETTINGS.storeName,
        storePhone: savedSettings.storePhone ?? DEFAULT_SETTINGS.storePhone,
        storeAddress: savedSettings.storeAddress ?? DEFAULT_SETTINGS.storeAddress,
        headerMessage: savedSettings.headerMessage ?? DEFAULT_SETTINGS.headerMessage,
        footerMessage: savedSettings.footerMessage ?? DEFAULT_SETTINGS.footerMessage,
        welcomeMessage: savedSettings.welcomeMessage ?? DEFAULT_SETTINGS.welcomeMessage,
        logoUrl: savedSettings.logoUrl ?? DEFAULT_SETTINGS.logoUrl,
        printCopies: savedSettings.printCopies ?? DEFAULT_SETTINGS.printCopies,
      });
    }
  }, [savedSettings]);
  
  // تحديد الفرع الأول تلقائياً
  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);
  
  // Hook للطباعة
  const { printReceipt } = useThermalPrinter(settings);
  
  // حفظ الإعدادات
  const handleSave = async () => {
    if (!selectedBranchId) {
      toast.error('يرجى اختيار الفرع أولاً');
      return;
    }
    
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync({
        branchId: selectedBranchId,
        ...settings,
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // معاينة الفاتورة
  const handlePreview = () => {
    const sampleData: ReceiptData = {
      invoiceNumber: 'INV-2024-001234',
      branchName: branches?.find(b => b.id === selectedBranchId)?.name || 'الفرع الرئيسي',
      branchPhone: settings.storePhone || '0500000000',
      employeeName: 'أحمد محمد',
      date: new Date(),
      items: [
        { serviceName: 'Haircut', serviceNameAr: 'قص شعر', quantity: 1, price: 50, total: 50 },
        { serviceName: 'Beard Trim', serviceNameAr: 'تهذيب اللحية', quantity: 1, price: 30, total: 30 },
        { serviceName: 'Hair Wash', serviceNameAr: 'غسيل شعر', quantity: 2, price: 15, total: 30 },
      ],
      subtotal: 110,
      discountAmount: 10,
      discountReason: 'خصم الولاء',
      total: 100,
      paymentMethod: 'split',
      cashAmount: 50,
      cardAmount: 50,
      loyaltyCustomer: {
        name: 'خالد العمري',
        phone: '0551234567',
      },
      notes: 'عميل مميز - خصم خاص',
    };
    
    printReceipt(sampleData);
  };
  
  // التحقق من صلاحية الأدمن
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold mb-2">صلاحية غير كافية</h2>
            <p className="text-gray-600 mb-4">هذه الصفحة متاحة للمسؤولين فقط</p>
            <Link href="/pos-login">
              <Button>العودة لبوابة الكاشير</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/pos-settings">
                <Button variant="ghost" size="icon">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Printer className="h-6 w-6" />
                  إعدادات الطباعة الحرارية
                </h1>
                <p className="text-sm text-gray-500">تخصيص شكل ومحتوى الفاتورة المطبوعة</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="h-4 w-4 ml-2" />
                معاينة
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !selectedBranchId}>
                <Save className="h-4 w-4 ml-2" />
                {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* العمود الأيسر - الإعدادات */}
          <div className="lg:col-span-2 space-y-6">
            {/* اختيار الفرع */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  الفرع
                </CardTitle>
                <CardDescription>اختر الفرع لتخصيص إعدادات الطباعة الخاصة به</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedBranchId?.toString() || ''}
                  onValueChange={(value) => setSelectedBranchId(parseInt(value))}
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
              </CardContent>
            </Card>
            
            {/* إعدادات الورق والخط */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  إعدادات الورق والخط
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>حجم الورق</Label>
                    <Select
                      value={settings.paperWidth}
                      onValueChange={(value: '58mm' | '80mm') => 
                        setSettings(prev => ({ ...prev, paperWidth: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="58mm">58mm (صغير)</SelectItem>
                        <SelectItem value="80mm">80mm (قياسي)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>حجم الخط</Label>
                    <Select
                      value={settings.fontSize}
                      onValueChange={(value: 'small' | 'medium' | 'large') => 
                        setSettings(prev => ({ ...prev, fontSize: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">صغير</SelectItem>
                        <SelectItem value="medium">متوسط</SelectItem>
                        <SelectItem value="large">كبير</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>عدد النسخ</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={settings.printCopies}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      printCopies: parseInt(e.target.value) || 1 
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* معلومات المتجر */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  معلومات المتجر والشعار
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>اسم المتجر</Label>
                  <Input
                    value={settings.storeName}
                    onChange={(e) => setSettings(prev => ({ ...prev, storeName: e.target.value }))}
                    placeholder="Symbol AI"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={settings.storePhone || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, storePhone: e.target.value }))}
                      placeholder="0500000000"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>رابط الشعار (اختياري)</Label>
                    <Input
                      value={settings.logoUrl || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, logoUrl: e.target.value || null }))}
                      placeholder="https://..."
                      dir="ltr"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input
                    value={settings.storeAddress || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, storeAddress: e.target.value }))}
                    placeholder="الرياض - حي النخيل"
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* الرسائل */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  الرسائل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>رسالة الهيدر (اختياري)</Label>
                  <Input
                    value={settings.headerMessage || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, headerMessage: e.target.value }))}
                    placeholder="مرحباً بكم في متجرنا"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>رسالة الشكر (الفوتر)</Label>
                  <Input
                    value={settings.footerMessage}
                    onChange={(e) => setSettings(prev => ({ ...prev, footerMessage: e.target.value }))}
                    placeholder="شكراً لزيارتكم ❤"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>رسالة الترحيب</Label>
                  <Input
                    value={settings.welcomeMessage}
                    onChange={(e) => setSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                    placeholder="نتشرف بخدمتكم دائماً"
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* خيارات العرض */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">خيارات العرض</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>إظهار الشعار</Label>
                    <p className="text-sm text-gray-500">عرض شعار المتجر في أعلى الفاتورة</p>
                  </div>
                  <Switch
                    checked={settings.showLogo}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showLogo: checked }))}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>إظهار QR Code</Label>
                    <p className="text-sm text-gray-500">رمز QR للتحقق من الفاتورة</p>
                  </div>
                  <Switch
                    checked={settings.showQRCode}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showQRCode: checked }))}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>إظهار رقم الهاتف</Label>
                    <p className="text-sm text-gray-500">عرض رقم هاتف الفرع</p>
                  </div>
                  <Switch
                    checked={settings.showBranchPhone}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showBranchPhone: checked }))}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>إظهار اسم الموظف</Label>
                    <p className="text-sm text-gray-500">عرض اسم الكاشير في الفاتورة</p>
                  </div>
                  <Switch
                    checked={settings.showEmployeeName}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showEmployeeName: checked }))}
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>طباعة تلقائية</Label>
                    <p className="text-sm text-gray-500">طباعة الفاتورة تلقائياً بعد فتح النافذة</p>
                  </div>
                  <Switch
                    checked={settings.autoPrint}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoPrint: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* العمود الأيمن - المعاينة */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  معاينة الفاتورة
                </CardTitle>
                <CardDescription>شكل الفاتورة المطبوعة</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 mx-auto"
                  style={{ 
                    width: settings.paperWidth === '58mm' ? '200px' : '280px',
                    minHeight: '400px',
                    fontFamily: 'Courier New, monospace',
                    fontSize: settings.fontSize === 'small' ? '8px' : settings.fontSize === 'large' ? '10px' : '9px',
                  }}
                  dir="rtl"
                >
                  {/* معاينة مصغرة */}
                  <div className="text-center border-b-2 border-double border-black pb-2 mb-2">
                    {settings.showLogo && (
                      <div className="w-10 h-10 mx-auto mb-1 border-2 border-black rounded-full flex items-center justify-center text-lg font-bold">
                        S
                      </div>
                    )}
                    <div className="font-bold text-sm">{settings.storeName || 'Symbol AI'}</div>
                    <div className="bg-black text-white text-xs px-2 py-0.5 inline-block mt-1">الفرع الرئيسي</div>
                    {settings.showBranchPhone && settings.storePhone && (
                      <div className="text-xs mt-1">📞 {settings.storePhone}</div>
                    )}
                  </div>
                  
                  <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
                    <div className="flex justify-between text-xs">
                      <span>التاريخ:</span>
                      <span>01/01/2024</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>الوقت:</span>
                      <span>12:00</span>
                    </div>
                    {settings.showEmployeeName && (
                      <div className="flex justify-between text-xs">
                        <span>الموظف:</span>
                        <span>أحمد</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-b border-black pb-2 mb-2">
                    <div className="bg-gray-100 text-center text-xs font-bold py-1 mb-1">═══ الخدمات ═══</div>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>قص شعر</span>
                        <span>50 ر.س</span>
                      </div>
                      <div className="flex justify-between">
                        <span>تهذيب اللحية</span>
                        <span>30 ر.س</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-2 border-black p-2 text-center mb-2">
                    <div className="text-xs">الإجمالي</div>
                    <div className="font-bold text-lg">80 ر.س</div>
                  </div>
                  
                  {settings.showQRCode && (
                    <div className="text-center border-t border-dashed border-gray-400 pt-2 mb-2">
                      <div className="w-12 h-12 mx-auto border border-black bg-gray-100 flex items-center justify-center text-xs">
                        QR
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center border-t-2 border-double border-black pt-2">
                    <div className="font-bold text-xs">{settings.footerMessage}</div>
                    <div className="text-xs italic">{settings.welcomeMessage}</div>
                  </div>
                </div>
                
                <Button 
                  className="w-full mt-4" 
                  variant="outline"
                  onClick={handlePreview}
                >
                  <Eye className="h-4 w-4 ml-2" />
                  معاينة كاملة
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
