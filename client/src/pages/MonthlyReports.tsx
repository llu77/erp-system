import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, DollarSign, Receipt, Award, Download, Loader2 } from 'lucide-react';

const MONTHS = [
  { value: '1', label: 'يناير' },
  { value: '2', label: 'فبراير' },
  { value: '3', label: 'مارس' },
  { value: '4', label: 'أبريل' },
  { value: '5', label: 'مايو' },
  { value: '6', label: 'يونيو' },
  { value: '7', label: 'يوليو' },
  { value: '8', label: 'أغسطس' },
  { value: '9', label: 'سبتمبر' },
  { value: '10', label: 'أكتوبر' },
  { value: '11', label: 'نوفمبر' },
  { value: '12', label: 'ديسمبر' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => ({
  value: String(currentYear - i),
  label: String(currentYear - i),
}));

export default function MonthlyReports() {
  const { toast } = useToast();
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const revenueReport = trpc.scheduledReports.generateRevenueReport.useMutation();
  const expenseReport = trpc.scheduledReports.generateExpenseReport.useMutation();
  const bonusReport = trpc.scheduledReports.generateBonusReport.useMutation();

  const downloadPDF = (base64: string, filename: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async (reportType: 'revenue' | 'expense' | 'bonus') => {
    setLoadingReport(reportType);
    try {
      const input = { month: parseInt(month), year: parseInt(year) };
      let result;
      
      switch (reportType) {
        case 'revenue':
          result = await revenueReport.mutateAsync(input);
          break;
        case 'expense':
          result = await expenseReport.mutateAsync(input);
          break;
        case 'bonus':
          result = await bonusReport.mutateAsync(input);
          break;
      }

      if (result.success) {
        downloadPDF(result.pdf, result.filename);
        toast({
          title: 'تم توليد التقرير',
          description: `تم تحميل ${result.filename}`,
        });
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في توليد التقرير',
        variant: 'destructive',
      });
    } finally {
      setLoadingReport(null);
    }
  };

  const reports = [
    {
      id: 'revenue',
      title: 'تقرير الإيرادات الشهري',
      description: 'إجمالي الإيرادات (كاش + شبكة) حسب الفرع والموظف مع الرسوم البيانية',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      id: 'expense',
      title: 'تقرير المصاريف الشهري',
      description: 'تفاصيل المصاريف حسب الفئة والحالة مع إجمالي المعتمد والمصروف',
      icon: Receipt,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      id: 'bonus',
      title: 'تقرير البونص الشهري',
      description: 'تفاصيل البونص الأسبوعي للموظفين حسب المستوى والفرع',
      icon: Award,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="container py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          التقارير المحاسبية الشهرية
        </h1>
        <p className="text-muted-foreground mt-2">
          توليد وتحميل التقارير المحاسبية الاحترافية بصيغة PDF
        </p>
      </div>

      {/* اختيار الفترة */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>اختر الفترة</CardTitle>
          <CardDescription>حدد الشهر والسنة للتقرير المطلوب</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">الشهر</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشهر" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <label className="text-sm font-medium mb-2 block">السنة</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر السنة" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* قائمة التقارير */}
      <div className="grid md:grid-cols-3 gap-6">
        {reports.map((report) => (
          <Card key={report.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className={`w-12 h-12 rounded-lg ${report.bgColor} flex items-center justify-center mb-4`}>
                <report.icon className={`h-6 w-6 ${report.color}`} />
              </div>
              <CardTitle className="text-lg">{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => handleGenerateReport(report.id as 'revenue' | 'expense' | 'bonus')}
                disabled={loadingReport !== null}
              >
                {loadingReport === report.id ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري التوليد...
                  </>
                ) : (
                  <>
                    <Download className="ml-2 h-4 w-4" />
                    توليد وتحميل PDF
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* معلومات إضافية */}
      <Card className="mt-8 bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">معايير الجودة في التقارير:</h3>
          <ul className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <li>✅ شعار Symbol الرسمي</li>
            <li>✅ ختم الشركة المعتمد</li>
            <li>✅ توقيع المشرف العام</li>
            <li>✅ توقيع المدير</li>
            <li>✅ تصميم احترافي موحد</li>
            <li>✅ رسوم بيانية توضيحية</li>
            <li>✅ جداول مفصلة</li>
            <li>✅ ملخص تنفيذي</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
