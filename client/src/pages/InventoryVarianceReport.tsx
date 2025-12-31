import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  PDF_BASE_STYLES, 
  getPDFHeader, 
  getPDFFooter, 
  getPDFInfoSection, 
  getPDFSummarySection, 
  openPrintWindow,
  formatCurrency 
} from "@/utils/pdfTemplates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle2,
  Download,
  Search,
  FileBarChart,
  Loader2,
  Save,
  ArrowLeft,
  FileDown
} from "lucide-react";
import { Link } from "wouter";

export default function InventoryVarianceReport() {
  const { user } = useAuth();
  const [selectedCountId, setSelectedCountId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [reason, setReason] = useState("");

  // جلب البيانات
  const { data: countHistory } = trpc.inventoryCounting.list.useQuery();
  const { data: varianceReport, refetch: refetchReport } = trpc.inventoryCounting.varianceReport.useQuery(
    { countId: selectedCountId || 0 },
    { enabled: !!selectedCountId }
  );

  // Mutations
  const updateReason = trpc.inventoryCounting.updateItemReason.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ السبب بنجاح");
      refetchReport();
      setSelectedItem(null);
      setReason("");
    },
    onError: (error) => {
      toast.error(error.message || "فشل في حفظ السبب");
    },
  });

  // تصفية العناصر
  const filteredItems = () => {
    if (!varianceReport?.items) return [];
    
    let items = varianceReport.items;
    
    // تصفية حسب البحث
    if (searchTerm) {
      items = items.filter(item => 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productSku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // تصفية حسب التبويب
    switch (activeTab) {
      case "shortages":
        items = items.filter(item => item.variance < 0);
        break;
      case "surpluses":
        items = items.filter(item => item.variance > 0);
        break;
      case "matched":
        items = items.filter(item => item.variance === 0);
        break;
    }
    
    return items;
  };

  // الحصول على لون الفرق
  const getVarianceColor = (variance: number) => {
    if (variance === 0) return "text-green-500";
    if (variance > 0) return "text-blue-500";
    return "text-red-500";
  };

  // الحصول على أيقونة الفرق
  const getVarianceIcon = (variance: number) => {
    if (variance === 0) return <Minus className="h-4 w-4" />;
    if (variance > 0) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  // حفظ سبب الفرق
  const handleSaveReason = () => {
    if (!selectedItem) return;
    updateReason.mutate({
      itemId: selectedItem.id,
      reason,
    });
  };

  // تصدير التقرير CSV
  const handleExportCSV = () => {
    if (!varianceReport) return;
    
    // إنشاء محتوى CSV
    let csv = "المنتج,الرمز,الكمية النظرية,الكمية الفعلية,الفرق,قيمة الفرق,السبب\n";
    
    varianceReport.items.forEach(item => {
      csv += `"${item.productName}","${item.productSku || ''}",${item.systemQuantity},${item.countedQuantity},${item.variance},${item.varianceValue},"${item.reason || ''}"\n`;
    });
    
    // تحميل الملف
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `variance-report-${varianceReport.count?.countNumber || 'unknown'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("تم تصدير التقرير بنجاح");
  };

  // تصدير التقرير PDF
  const handleExportPDF = () => {
    if (!varianceReport) return;
    
    const countDate = varianceReport.count?.countDate 
      ? new Date(varianceReport.count.countDate).toLocaleDateString('ar-SA')
      : 'غير محدد';
    
    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير فروقات الجرد - ${varianceReport.count?.countNumber || ''}</title>
  <style>
    ${PDF_BASE_STYLES}
    .variance-positive { color: #000; font-weight: 700; }
    .variance-negative { color: #cc0000; font-weight: 700; }
    .variance-zero { color: #333; font-weight: 600; }
  </style>
</head>
<body>
  ${getPDFHeader('تقرير فروقات الجرد', { reportNumber: varianceReport.count?.countNumber })}
  
  ${getPDFInfoSection([
    { label: 'رقم الجرد', value: varianceReport.count?.countNumber || '-' },
    { label: 'تاريخ الجرد', value: countDate },
    { label: 'الفرع', value: varianceReport.count?.branchName || 'جميع الفروع' },
    { label: 'إجمالي المنتجات', value: varianceReport.summary.totalProducts },
  ])}
  
  ${getPDFSummarySection([
    { label: 'نواقص', value: varianceReport.summary.shortages },
    { label: 'زيادات', value: varianceReport.summary.surpluses },
    { label: 'متطابق', value: varianceReport.summary.matched },
    { label: 'صافي الفروقات', value: formatCurrency(varianceReport.summary.netVariance) },
    { label: 'قيمة النواقص', value: formatCurrency(-varianceReport.summary.totalShortageValue) },
  ])}
  
  <table class="pdf-table">
    <thead>
      <tr>
        <th>#</th>
        <th>المنتج</th>
        <th>SKU</th>
        <th>كمية النظام</th>
        <th>الكمية الفعلية</th>
        <th>الفرق</th>
        <th>القيمة</th>
        <th>السبب</th>
      </tr>
    </thead>
    <tbody>
      ${varianceReport.items.map((item, index) => {
        const varianceClass = item.variance > 0 ? 'variance-positive' : item.variance < 0 ? 'variance-negative' : 'variance-zero';
        return `
          <tr>
            <td>${index + 1}</td>
            <td class="text-right">${item.productName}</td>
            <td>${item.productSku || '-'}</td>
            <td>${item.systemQuantity}</td>
            <td>${item.countedQuantity}</td>
            <td class="${varianceClass}">${item.variance > 0 ? '+' : ''}${item.variance}</td>
            <td class="${varianceClass}">${formatCurrency(item.varianceValue)}</td>
            <td class="text-right">${item.reason || '-'}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>
  
  ${getPDFFooter()}
</body>
</html>
    `;
    
    openPrintWindow(htmlContent);
    toast.success("تم فتح تقرير فروقات الجرد للطباعة أو الحفظ كـ PDF");
  };

  // جميع عمليات الجرد (بما فيها الجارية)
  const allCounts = countHistory || [];
  const completedCounts = allCounts.filter(c => c.status === "approved" || c.status === "completed" || c.status === "in_progress");

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inventory-counting">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">تقرير فروقات الجرد</h1>
            <p className="text-muted-foreground">مقارنة الكميات الفعلية بالنظرية وتحليل الفروقات</p>
          </div>
        </div>
        
        {varianceReport && (
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} variant="default" className="gap-2">
              <FileDown className="h-4 w-4" />
              تصدير PDF
            </Button>
            <Button onClick={handleExportCSV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              تصدير CSV
            </Button>
          </div>
        )}
      </div>

      {/* اختيار الجرد */}
      <Card>
        <CardHeader>
          <CardTitle>اختر عملية الجرد</CardTitle>
          <CardDescription>اختر عملية جرد سابقة لعرض تقرير الفروقات</CardDescription>
        </CardHeader>
        <CardContent>
          <Select 
            value={selectedCountId?.toString() || ""} 
            onValueChange={(v) => setSelectedCountId(parseInt(v))}
          >
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="اختر عملية جرد..." />
            </SelectTrigger>
            <SelectContent>
              {completedCounts.map(count => (
                <SelectItem key={count.id} value={count.id.toString()}>
                  {count.countNumber} - {new Date(count.countDate).toLocaleDateString("ar-SA")}
                  {count.branchName && ` (${count.branchName})`}
                  {count.status === "in_progress" && " (جاري)"}
                  {count.status === "approved" && " (معتمد)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* تقرير الفروقات */}
      {varianceReport && (
        <>
          {/* ملخص التقرير */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileBarChart className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <div className="text-2xl font-bold">{varianceReport.summary.totalProducts}</div>
                  <div className="text-sm text-muted-foreground">إجمالي المنتجات</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingDown className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <div className="text-2xl font-bold text-red-500">{varianceReport.summary.shortages}</div>
                  <div className="text-sm text-muted-foreground">نقص</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold text-blue-500">{varianceReport.summary.surpluses}</div>
                  <div className="text-sm text-muted-foreground">زيادة</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold text-green-500">{varianceReport.summary.matched}</div>
                  <div className="text-sm text-muted-foreground">متطابق</div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <div className={`text-2xl font-bold ${varianceReport.summary.netVariance >= 0 ? "text-blue-500" : "text-red-500"}`}>
                    {varianceReport.summary.netVariance.toFixed(2)} ر.س
                  </div>
                  <div className="text-sm text-muted-foreground">صافي الفروقات</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ملخص القيم */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">إجمالي قيمة النقص</div>
                    <div className="text-2xl font-bold text-red-500">
                      -{varianceReport.summary.totalShortageValue.toFixed(2)} ر.س
                    </div>
                  </div>
                  <TrendingDown className="h-12 w-12 text-red-500/50" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">إجمالي قيمة الزيادة</div>
                    <div className="text-2xl font-bold text-blue-500">
                      +{varianceReport.summary.totalSurplusValue.toFixed(2)} ر.س
                    </div>
                  </div>
                  <TrendingUp className="h-12 w-12 text-blue-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* جدول الفروقات */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>تفاصيل الفروقات</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو الرمز..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">الكل ({varianceReport.items.length})</TabsTrigger>
                  <TabsTrigger value="shortages">نقص ({varianceReport.summary.shortages})</TabsTrigger>
                  <TabsTrigger value="surpluses">زيادة ({varianceReport.summary.surpluses})</TabsTrigger>
                  <TabsTrigger value="matched">متطابق ({varianceReport.summary.matched})</TabsTrigger>
                </TabsList>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-right p-3 font-medium">المنتج</th>
                        <th className="text-center p-3 font-medium">الكمية النظرية</th>
                        <th className="text-center p-3 font-medium">الكمية الفعلية</th>
                        <th className="text-center p-3 font-medium">الفرق</th>
                        <th className="text-center p-3 font-medium">قيمة الفرق</th>
                        <th className="text-right p-3 font-medium">السبب</th>
                        <th className="text-center p-3 font-medium">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems().map((item) => (
                        <tr key={item.id} className="border-t hover:bg-muted/50">
                          <td className="p-3">
                            <div>
                              <div className="font-medium">{item.productName}</div>
                              {item.productSku && (
                                <div className="text-xs text-muted-foreground">{item.productSku}</div>
                              )}
                            </div>
                          </td>
                          <td className="text-center p-3">{item.systemQuantity}</td>
                          <td className="text-center p-3">{item.countedQuantity}</td>
                          <td className="text-center p-3">
                            <span className={`flex items-center justify-center gap-1 ${getVarianceColor(item.variance)}`}>
                              {getVarianceIcon(item.variance)}
                              {item.variance}
                            </span>
                          </td>
                          <td className="text-center p-3">
                            <span className={getVarianceColor(parseFloat(item.varianceValue as string))}>
                              {parseFloat(item.varianceValue as string).toFixed(2)} ر.س
                            </span>
                          </td>
                          <td className="p-3 max-w-xs">
                            <span className="text-sm text-muted-foreground truncate block">
                              {item.reason || "-"}
                            </span>
                          </td>
                          <td className="text-center p-3">
                            {item.variance !== 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setReason(item.reason || "");
                                }}
                              >
                                <FileText className="h-4 w-4 ml-1" />
                                {item.reason ? "تعديل السبب" : "إضافة سبب"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredItems().length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center p-8 text-muted-foreground">
                            لا توجد بيانات
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {/* نافذة إضافة السبب */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>سبب الفرق</DialogTitle>
            <DialogDescription>
              {selectedItem?.productName} - الفرق: {selectedItem?.variance}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>سبب الفرق</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="أدخل سبب الفرق..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>إلغاء</Button>
            <Button onClick={handleSaveReason} disabled={updateReason.isPending}>
              {updateReason.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
