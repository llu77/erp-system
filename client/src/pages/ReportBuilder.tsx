import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  FileText, Download, Save, Play, Plus, Trash2, Settings2,
  Table, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  Filter, SortAsc, SortDesc, Calendar, Building2, Eye, Copy,
  FileSpreadsheet, FileDown, Printer, Mail, Clock, Star, StarOff
} from "lucide-react";
import { toast } from "sonner";

// أنواع البيانات المتاحة
const DATA_SOURCES = [
  { id: 'invoices', name: 'الفواتير', icon: FileText },
  { id: 'products', name: 'المنتجات', icon: FileSpreadsheet },
  { id: 'customers', name: 'العملاء', icon: FileText },
  { id: 'expenses', name: 'المصروفات', icon: FileText },
  { id: 'employees', name: 'الموظفين', icon: FileText },
  { id: 'inventory', name: 'المخزون', icon: FileSpreadsheet },
];

// الأعمدة المتاحة لكل مصدر بيانات
const DATA_COLUMNS: Record<string, { id: string; name: string; type: 'string' | 'number' | 'date' }[]> = {
  invoices: [
    { id: 'invoiceNumber', name: 'رقم الفاتورة', type: 'string' },
    { id: 'date', name: 'التاريخ', type: 'date' },
    { id: 'customerName', name: 'اسم العميل', type: 'string' },
    { id: 'total', name: 'الإجمالي', type: 'number' },
    { id: 'discount', name: 'الخصم', type: 'number' },
    { id: 'tax', name: 'الضريبة', type: 'number' },
    { id: 'status', name: 'الحالة', type: 'string' },
    { id: 'branchName', name: 'الفرع', type: 'string' },
    { id: 'employeeName', name: 'الموظف', type: 'string' },
  ],
  products: [
    { id: 'name', name: 'اسم المنتج', type: 'string' },
    { id: 'sku', name: 'الرمز', type: 'string' },
    { id: 'categoryName', name: 'الفئة', type: 'string' },
    { id: 'price', name: 'السعر', type: 'number' },
    { id: 'cost', name: 'التكلفة', type: 'number' },
    { id: 'quantity', name: 'الكمية', type: 'number' },
    { id: 'minQuantity', name: 'الحد الأدنى', type: 'number' },
  ],
  customers: [
    { id: 'name', name: 'اسم العميل', type: 'string' },
    { id: 'phone', name: 'الهاتف', type: 'string' },
    { id: 'email', name: 'البريد', type: 'string' },
    { id: 'totalPurchases', name: 'إجمالي المشتريات', type: 'number' },
    { id: 'lastVisit', name: 'آخر زيارة', type: 'date' },
  ],
  expenses: [
    { id: 'date', name: 'التاريخ', type: 'date' },
    { id: 'category', name: 'الفئة', type: 'string' },
    { id: 'description', name: 'الوصف', type: 'string' },
    { id: 'amount', name: 'المبلغ', type: 'number' },
    { id: 'branchName', name: 'الفرع', type: 'string' },
  ],
  employees: [
    { id: 'name', name: 'اسم الموظف', type: 'string' },
    { id: 'position', name: 'المنصب', type: 'string' },
    { id: 'branchName', name: 'الفرع', type: 'string' },
    { id: 'salary', name: 'الراتب', type: 'number' },
    { id: 'hireDate', name: 'تاريخ التعيين', type: 'date' },
  ],
  inventory: [
    { id: 'productName', name: 'المنتج', type: 'string' },
    { id: 'branchName', name: 'الفرع', type: 'string' },
    { id: 'quantity', name: 'الكمية', type: 'number' },
    { id: 'value', name: 'القيمة', type: 'number' },
  ],
};

// أنواع التجميع
const AGGREGATIONS = [
  { id: 'sum', name: 'المجموع' },
  { id: 'avg', name: 'المتوسط' },
  { id: 'count', name: 'العدد' },
  { id: 'min', name: 'الأدنى' },
  { id: 'max', name: 'الأعلى' },
];

// أنواع الرسوم البيانية
const CHART_TYPES = [
  { id: 'table', name: 'جدول', icon: Table },
  { id: 'bar', name: 'أعمدة', icon: BarChart3 },
  { id: 'line', name: 'خطي', icon: LineChartIcon },
  { id: 'pie', name: 'دائري', icon: PieChartIcon },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// دالة تنسيق العملة
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(amount);
}

// مكون معاينة التقرير
function ReportPreview({ 
  config, 
  data, 
  loading 
}: { 
  config: ReportConfig; 
  data: any[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>لا توجد بيانات للعرض</p>
        <p className="text-sm">قم بتحديد مصدر البيانات والأعمدة ثم اضغط "تشغيل"</p>
      </div>
    );
  }

  // عرض جدول
  if (config.chartType === 'table') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted">
              {config.selectedColumns.map(col => (
                <th key={col} className="border p-2 text-right font-semibold">
                  {DATA_COLUMNS[config.dataSource]?.find(c => c.id === col)?.name || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((row, i) => (
              <tr key={i} className="hover:bg-muted/50">
                {config.selectedColumns.map(col => (
                  <td key={col} className="border p-2">
                    {typeof row[col] === 'number' 
                      ? formatCurrency(row[col])
                      : row[col] instanceof Date 
                        ? format(row[col], 'yyyy-MM-dd')
                        : row[col] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 100 && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            يتم عرض أول 100 صف من {data.length} صف
          </p>
        )}
      </div>
    );
  }

  // عرض رسم بياني أعمدة
  if (config.chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.slice(0, 20)}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={config.groupBy || config.selectedColumns[0]} className="text-xs" />
          <YAxis />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          {config.selectedColumns.filter(c => 
            DATA_COLUMNS[config.dataSource]?.find(col => col.id === c)?.type === 'number'
          ).map((col, i) => (
            <Bar 
              key={col} 
              dataKey={col} 
              name={DATA_COLUMNS[config.dataSource]?.find(c => c.id === col)?.name}
              fill={COLORS[i % COLORS.length]} 
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // عرض رسم بياني خطي
  if (config.chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.slice(0, 30)}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey={config.groupBy || config.selectedColumns[0]} className="text-xs" />
          <YAxis />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          {config.selectedColumns.filter(c => 
            DATA_COLUMNS[config.dataSource]?.find(col => col.id === c)?.type === 'number'
          ).map((col, i) => (
            <Line 
              key={col} 
              type="monotone"
              dataKey={col} 
              name={DATA_COLUMNS[config.dataSource]?.find(c => c.id === col)?.name}
              stroke={COLORS[i % COLORS.length]} 
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // عرض رسم بياني دائري
  if (config.chartType === 'pie') {
    const numericCol = config.selectedColumns.find(c => 
      DATA_COLUMNS[config.dataSource]?.find(col => col.id === c)?.type === 'number'
    );
    const labelCol = config.groupBy || config.selectedColumns.find(c => 
      DATA_COLUMNS[config.dataSource]?.find(col => col.id === c)?.type === 'string'
    );

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data.slice(0, 10)}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey={numericCol || 'value'}
            nameKey={labelCol || 'name'}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {data.slice(0, 10).map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

// نوع إعدادات التقرير
interface ReportConfig {
  name: string;
  dataSource: string;
  selectedColumns: string[];
  filters: { column: string; operator: string; value: string }[];
  groupBy: string;
  aggregation: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  chartType: string;
  dateRange: { start: string; end: string };
}

export default function ReportBuilder() {
  // حالة إعدادات التقرير
  const [config, setConfig] = useState<ReportConfig>({
    name: 'تقرير جديد',
    dataSource: '',
    selectedColumns: [],
    filters: [],
    groupBy: '',
    aggregation: 'sum',
    sortBy: '',
    sortOrder: 'desc',
    chartType: 'table',
    dateRange: {
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [savedReports, setSavedReports] = useState<{ id: string; name: string; config: ReportConfig; isFavorite: boolean }[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // الأعمدة المتاحة للمصدر المحدد
  const availableColumns = useMemo(() => {
    return DATA_COLUMNS[config.dataSource] || [];
  }, [config.dataSource]);

  // تشغيل التقرير
  const runReport = async () => {
    if (!config.dataSource || config.selectedColumns.length === 0) {
      toast.error('يرجى تحديد مصدر البيانات والأعمدة');
      return;
    }

    setIsRunning(true);
    
    // محاكاة جلب البيانات (في التطبيق الحقيقي سيتم استدعاء API)
    setTimeout(() => {
      // بيانات تجريبية
      const mockData = generateMockData(config);
      setPreviewData(mockData);
      setIsRunning(false);
      toast.success('تم تشغيل التقرير بنجاح');
    }, 1000);
  };

  // توليد بيانات تجريبية
  const generateMockData = (cfg: ReportConfig) => {
    const count = 20;
    const data = [];
    
    for (let i = 0; i < count; i++) {
      const row: Record<string, any> = {};
      cfg.selectedColumns.forEach(col => {
        const colDef = DATA_COLUMNS[cfg.dataSource]?.find(c => c.id === col);
        if (colDef?.type === 'number') {
          row[col] = Math.floor(Math.random() * 10000);
        } else if (colDef?.type === 'date') {
          row[col] = format(subDays(new Date(), Math.floor(Math.random() * 30)), 'yyyy-MM-dd');
        } else {
          row[col] = `${colDef?.name || col} ${i + 1}`;
        }
      });
      data.push(row);
    }
    
    return data;
  };

  // حفظ التقرير
  const saveReport = () => {
    const newReport = {
      id: Date.now().toString(),
      name: config.name,
      config: { ...config },
      isFavorite: false,
    };
    setSavedReports(prev => [...prev, newReport]);
    setShowSaveDialog(false);
    toast.success('تم حفظ التقرير بنجاح');
  };

  // تحميل تقرير محفوظ
  const loadReport = (report: typeof savedReports[0]) => {
    setConfig(report.config);
    toast.success(`تم تحميل التقرير: ${report.name}`);
  };

  // تصدير إلى Excel
  const exportToExcel = () => {
    if (previewData.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    
    // في التطبيق الحقيقي سيتم استخدام مكتبة مثل xlsx
    toast.success('جاري تصدير التقرير إلى Excel...');
  };

  // تصدير إلى PDF
  const exportToPDF = () => {
    if (previewData.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    
    toast.success('جاري تصدير التقرير إلى PDF...');
  };

  // إضافة فلتر
  const addFilter = () => {
    setConfig(prev => ({
      ...prev,
      filters: [...prev.filters, { column: '', operator: 'equals', value: '' }],
    }));
  };

  // حذف فلتر
  const removeFilter = (index: number) => {
    setConfig(prev => ({
      ...prev,
      filters: prev.filters.filter((_, i) => i !== index),
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-7 w-7" />
              منشئ التقارير المخصصة
            </h1>
            <p className="text-muted-foreground">أنشئ تقارير مخصصة بسهولة باستخدام السحب والإفلات</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
              <Save className="h-4 w-4 ml-2" />
              حفظ
            </Button>
            <Button onClick={runReport} disabled={isRunning}>
              <Play className="h-4 w-4 ml-2" />
              {isRunning ? 'جاري التشغيل...' : 'تشغيل'}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* إعدادات التقرير */}
          <div className="lg:col-span-1 space-y-4">
            {/* اسم التقرير */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">إعدادات التقرير</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>اسم التقرير</Label>
                  <Input
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="أدخل اسم التقرير"
                  />
                </div>

                <div className="space-y-2">
                  <Label>مصدر البيانات</Label>
                  <Select 
                    value={config.dataSource} 
                    onValueChange={(v) => setConfig(prev => ({ 
                      ...prev, 
                      dataSource: v, 
                      selectedColumns: [],
                      groupBy: '',
                      sortBy: '',
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر مصدر البيانات" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_SOURCES.map(source => (
                        <SelectItem key={source.id} value={source.id}>
                          <div className="flex items-center gap-2">
                            <source.icon className="h-4 w-4" />
                            {source.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* الفترة الزمنية */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>من تاريخ</Label>
                    <Input
                      type="date"
                      value={config.dateRange.start}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, start: e.target.value }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>إلى تاريخ</Label>
                    <Input
                      type="date"
                      value={config.dateRange.end}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, end: e.target.value }
                      }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* اختيار الأعمدة */}
            {config.dataSource && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">الأعمدة</CardTitle>
                  <CardDescription>اختر الأعمدة التي تريد عرضها</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {availableColumns.map(col => (
                      <div key={col.id} className="flex items-center gap-2">
                        <Checkbox
                          id={col.id}
                          checked={config.selectedColumns.includes(col.id)}
                          onCheckedChange={(checked) => {
                            setConfig(prev => ({
                              ...prev,
                              selectedColumns: checked
                                ? [...prev.selectedColumns, col.id]
                                : prev.selectedColumns.filter(c => c !== col.id)
                            }));
                          }}
                        />
                        <Label htmlFor={col.id} className="flex items-center gap-2 cursor-pointer">
                          {col.name}
                          <Badge variant="outline" className="text-xs">
                            {col.type === 'number' ? 'رقم' : col.type === 'date' ? 'تاريخ' : 'نص'}
                          </Badge>
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* التجميع والترتيب */}
            {config.selectedColumns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">التجميع والترتيب</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>تجميع حسب</Label>
                    <Select 
                      value={config.groupBy} 
                      onValueChange={(v) => setConfig(prev => ({ ...prev, groupBy: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="بدون تجميع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">بدون تجميع</SelectItem>
                        {config.selectedColumns
                          .filter(c => availableColumns.find(col => col.id === c)?.type === 'string')
                          .map(col => (
                            <SelectItem key={col} value={col}>
                              {availableColumns.find(c => c.id === col)?.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {config.groupBy && (
                    <div className="space-y-2">
                      <Label>نوع التجميع</Label>
                      <Select 
                        value={config.aggregation} 
                        onValueChange={(v) => setConfig(prev => ({ ...prev, aggregation: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGGREGATIONS.map(agg => (
                            <SelectItem key={agg.id} value={agg.id}>{agg.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>ترتيب حسب</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={config.sortBy} 
                        onValueChange={(v) => setConfig(prev => ({ ...prev, sortBy: v }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="اختر العمود" />
                        </SelectTrigger>
                        <SelectContent>
                          {config.selectedColumns.map(col => (
                            <SelectItem key={col} value={col}>
                              {availableColumns.find(c => c.id === col)?.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setConfig(prev => ({
                          ...prev,
                          sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
                        }))}
                      >
                        {config.sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* الفلاتر */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">الفلاتر</CardTitle>
                  <Button variant="ghost" size="sm" onClick={addFilter}>
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {config.filters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    لا توجد فلاتر. اضغط "إضافة" لإضافة فلتر.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {config.filters.map((filter, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Select
                          value={filter.column}
                          onValueChange={(v) => {
                            const newFilters = [...config.filters];
                            newFilters[index].column = v;
                            setConfig(prev => ({ ...prev, filters: newFilters }));
                          }}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="العمود" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map(col => (
                              <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={filter.value}
                          onChange={(e) => {
                            const newFilters = [...config.filters];
                            newFilters[index].value = e.target.value;
                            setConfig(prev => ({ ...prev, filters: newFilters }));
                          }}
                          placeholder="القيمة"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFilter(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* معاينة التقرير */}
          <div className="lg:col-span-2 space-y-4">
            {/* نوع العرض */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">نوع العرض</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                      <FileSpreadsheet className="h-4 w-4 ml-1" />
                      Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToPDF}>
                      <FileDown className="h-4 w-4 ml-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {CHART_TYPES.map(type => (
                    <Button
                      key={type.id}
                      variant={config.chartType === type.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setConfig(prev => ({ ...prev, chartType: type.id }))}
                    >
                      <type.icon className="h-4 w-4 ml-1" />
                      {type.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* المعاينة */}
            <Card className="min-h-[400px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  معاينة التقرير
                </CardTitle>
                <CardDescription>{config.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <ReportPreview config={config} data={previewData} loading={isRunning} />
              </CardContent>
            </Card>

            {/* التقارير المحفوظة */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Save className="h-5 w-5" />
                  التقارير المحفوظة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {savedReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    لا توجد تقارير محفوظة
                  </p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {savedReports.map(report => (
                      <div 
                        key={report.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => loadReport(report)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">{report.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSavedReports(prev => 
                                prev.map(r => r.id === report.id ? { ...r, isFavorite: !r.isFavorite } : r)
                              );
                            }}
                          >
                            {report.isFavorite ? (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            ) : (
                              <StarOff className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSavedReports(prev => prev.filter(r => r.id !== report.id));
                              toast.success('تم حذف التقرير');
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* حوار حفظ التقرير */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>حفظ التقرير</DialogTitle>
              <DialogDescription>
                أدخل اسمًا للتقرير لحفظه واستخدامه لاحقًا
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اسم التقرير</Label>
                <Input
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="أدخل اسم التقرير"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                إلغاء
              </Button>
              <Button onClick={saveReport}>
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
