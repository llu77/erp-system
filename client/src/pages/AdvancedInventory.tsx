import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { 
  Package, 
  AlertTriangle,
  Clock,
  RefreshCw,
  Plus,
  ShoppingCart,
  ClipboardList,
  Check,
  X,
  Calendar,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Bell,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Eye,
  Boxes,
  Timer,
  Warehouse
} from "lucide-react";

export default function AdvancedInventory() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewCountDialog, setShowNewCountDialog] = useState(false);
  const [newCountData, setNewCountData] = useState({
    branchId: "",
    countDate: new Date().toISOString().split('T')[0],
    notes: "",
  });
  const utils = trpc.useUtils();

  // جلب المنتجات قريبة الانتهاء
  const { data: expiringProducts, isLoading: expiringLoading } = trpc.inventory.batches.expiring.useQuery({ daysAhead: 30 });

  // جلب اقتراحات إعادة الطلب
  const { data: reorderSuggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = trpc.inventory.reorderSuggestions.pending.useQuery();

  // جلب عمليات الجرد
  const { data: inventoryCounts, isLoading: countsLoading } = trpc.inventory.counts.list.useQuery();

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // جلب المنتجات منخفضة المخزون
  const { data: lowStockProducts } = trpc.products.list.useQuery();
  const lowStockCount = useMemo(() => {
    if (!lowStockProducts) return 0;
    return lowStockProducts.filter(p => p.quantity <= (p.minQuantity || 0)).length;
  }, [lowStockProducts]);

  // فحص وإنشاء اقتراحات جديدة
  const checkReorder = trpc.inventory.reorderSuggestions.check.useMutation({
    onSuccess: (data) => {
      utils.inventory.reorderSuggestions.pending.invalidate();
      toast.success(data.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // تحديث حالة الاقتراح
  const updateSuggestion = trpc.inventory.reorderSuggestions.updateStatus.useMutation({
    onSuccess: () => {
      utils.inventory.reorderSuggestions.pending.invalidate();
      toast.success('تم تحديث حالة الاقتراح');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // إنشاء جرد جديد
  const createCount = trpc.inventory.counts.create.useMutation({
    onSuccess: () => {
      utils.inventory.counts.list.invalidate();
      toast.success('تم إنشاء الجرد بنجاح');
      setShowNewCountDialog(false);
      setNewCountData({ branchId: "", countDate: new Date().toISOString().split('T')[0], notes: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // حساب إحصائيات الجرد
  const countStats = useMemo(() => {
    if (!inventoryCounts) return { total: 0, completed: 0, pending: 0, approved: 0 };
    return {
      total: inventoryCounts.length,
      completed: inventoryCounts.filter(c => c.status === 'completed').length,
      pending: inventoryCounts.filter(c => c.status === 'in_progress' || c.status === 'draft').length,
      approved: inventoryCounts.filter(c => c.status === 'approved').length,
    };
  }, [inventoryCounts]);

  // التحقق من موعد الجرد القادم
  const nextInventoryDate = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    let nextDate: Date;
    if (currentDay < 12) {
      nextDate = new Date(currentYear, currentMonth, 12);
    } else if (currentDay < 27) {
      nextDate = new Date(currentYear, currentMonth, 27);
    } else {
      nextDate = new Date(currentYear, currentMonth + 1, 12);
    }
    
    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { date: nextDate, daysUntil };
  }, []);

  // تصفية المنتجات قريبة الانتهاء
  const filteredExpiringProducts = useMemo(() => {
    if (!expiringProducts) return [];
    return expiringProducts.filter(batch => {
      if (searchTerm && !batch.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [expiringProducts, searchTerm]);

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Warehouse className="h-6 w-6" />
            إدارة المخزون المتقدمة
          </h1>
          <p className="text-muted-foreground">تتبع الدفعات، تواريخ الانتهاء، الجرد الدوري، وإعادة الطلب التلقائي</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetchSuggestions()}>
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
        </div>
      </div>

      {/* تنبيه موعد الجرد */}
      {nextInventoryDate.daysUntil <= 3 && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="flex items-center gap-4 py-4">
            <Bell className="h-8 w-8 text-amber-500 animate-pulse" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400">تذكير: موعد الجرد الدوري قريب!</h3>
              <p className="text-sm text-muted-foreground">
                الجرد القادم يوم {format(nextInventoryDate.date, 'EEEE dd MMMM yyyy', { locale: ar })} 
                ({nextInventoryDate.daysUntil === 0 ? 'اليوم' : `بعد ${nextInventoryDate.daysUntil} يوم`})
              </p>
            </div>
            <Button onClick={() => setShowNewCountDialog(true)}>
              <Plus className="h-4 w-4 ml-2" />
              بدء الجرد
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ملخص شامل */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المنتجات</CardTitle>
            <Boxes className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">منتج في المخزون</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">منخفض المخزون</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">تحت الحد الأدنى</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">قريبة الانتهاء</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{expiringProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">خلال 30 يوم</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">اقتراحات الطلب</CardTitle>
            <ShoppingCart className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reorderSuggestions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">تحتاج إعادة طلب</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الجرد القادم</CardTitle>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nextInventoryDate.daysUntil}</div>
            <p className="text-xs text-muted-foreground">يوم متبقي</p>
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">نظرة عامة</span>
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">الدفعات</span>
          </TabsTrigger>
          <TabsTrigger value="expiring" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">قريبة الانتهاء</span>
          </TabsTrigger>
          <TabsTrigger value="reorder" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">إعادة الطلب</span>
          </TabsTrigger>
          <TabsTrigger value="counts" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">الجرد</span>
          </TabsTrigger>
        </TabsList>

        {/* نظرة عامة */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            {/* حالة المخزون */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  حالة المخزون
                </CardTitle>
                <CardDescription>ملخص حالة المخزون الحالية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>المنتجات الطبيعية</span>
                    <span className="font-medium text-emerald-600">
                      {(lowStockProducts?.length || 0) - lowStockCount}
                    </span>
                  </div>
                  <Progress 
                    value={lowStockProducts?.length ? (((lowStockProducts.length - lowStockCount) / lowStockProducts.length) * 100) : 0} 
                    className="h-2 bg-emerald-100"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>منخفض المخزون</span>
                    <span className="font-medium text-red-600">{lowStockCount}</span>
                  </div>
                  <Progress 
                    value={lowStockProducts?.length ? ((lowStockCount / lowStockProducts.length) * 100) : 0} 
                    className="h-2 bg-red-100"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>قريبة الانتهاء</span>
                    <span className="font-medium text-amber-600">{expiringProducts?.length || 0}</span>
                  </div>
                  <Progress 
                    value={lowStockProducts?.length ? (((expiringProducts?.length || 0) / lowStockProducts.length) * 100) : 0} 
                    className="h-2 bg-amber-100"
                  />
                </div>
              </CardContent>
            </Card>

            {/* إحصائيات الجرد */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  إحصائيات الجرد
                </CardTitle>
                <CardDescription>ملخص عمليات الجرد</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{countStats.total}</div>
                    <div className="text-xs text-muted-foreground">إجمالي الجرد</div>
                  </div>
                  <div className="text-center p-4 bg-emerald-500/10 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-600">{countStats.approved}</div>
                    <div className="text-xs text-muted-foreground">معتمد</div>
                  </div>
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{countStats.completed}</div>
                    <div className="text-xs text-muted-foreground">مكتمل</div>
                  </div>
                  <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                    <div className="text-2xl font-bold text-amber-600">{countStats.pending}</div>
                    <div className="text-xs text-muted-foreground">قيد التنفيذ</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* مواعيد الجرد */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  جدول الجرد الدوري
                </CardTitle>
                <CardDescription>مواعيد الجرد المحددة: يوم 12 و 27 من كل شهر</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-blue-600">12</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">جرد منتصف الشهر</h4>
                      <p className="text-sm text-muted-foreground">يوم 12 من كل شهر</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-purple-600">27</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">جرد نهاية الشهر</h4>
                      <p className="text-sm text-muted-foreground">يوم 27 من كل شهر</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">الجرد القادم:</span>
                  </div>
                  <p className="text-lg">
                    {format(nextInventoryDate.date, 'EEEE dd MMMM yyyy', { locale: ar })}
                    <Badge variant={nextInventoryDate.daysUntil <= 3 ? "destructive" : "secondary"} className="mr-2">
                      {nextInventoryDate.daysUntil === 0 ? 'اليوم' : `بعد ${nextInventoryDate.daysUntil} يوم`}
                    </Badge>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* تتبع الدفعات */}
        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle>تتبع الدفعات (Batch Tracking)</CardTitle>
              <CardDescription>تتبع دفعات المنتجات وتواريخ الصلاحية وتطبيق FIFO</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>اختر منتج من صفحة المنتجات لعرض دفعاته</p>
                <p className="text-sm mt-2">يتم إنشاء الدفعات تلقائياً عند استلام أوامر الشراء</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* المنتجات قريبة الانتهاء */}
        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle>المنتجات قريبة الانتهاء</CardTitle>
                  <CardDescription>المنتجات التي ستنتهي صلاحيتها خلال 30 يوم</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث برقم الدفعة..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10 w-[200px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {expiringLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredExpiringProducts?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-50" />
                  <p>لا توجد منتجات قريبة الانتهاء</p>
                  <p className="text-sm mt-2">جميع المنتجات في حالة جيدة</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-right py-3 px-3 font-medium">رقم الدفعة</th>
                        <th className="text-right py-3 px-3 font-medium">الكمية المتبقية</th>
                        <th className="text-right py-3 px-3 font-medium">تاريخ الانتهاء</th>
                        <th className="text-right py-3 px-3 font-medium">الأيام المتبقية</th>
                        <th className="text-right py-3 px-3 font-medium">الحالة</th>
                        <th className="text-right py-3 px-3 font-medium">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpiringProducts?.map((batch) => {
                        const daysLeft = batch.expiryDate 
                          ? Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : 0;
                        return (
                          <tr key={batch.id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="py-3 px-3 font-medium">{batch.batchNumber}</td>
                            <td className="py-3 px-3">{batch.remainingQuantity}</td>
                            <td className="py-3 px-3">
                              {batch.expiryDate 
                                ? format(new Date(batch.expiryDate), 'dd/MM/yyyy', { locale: ar })
                                : '-'
                              }
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant={daysLeft <= 7 ? "destructive" : daysLeft <= 14 ? "secondary" : "outline"}>
                                {daysLeft <= 0 ? 'منتهي' : `${daysLeft} يوم`}
                              </Badge>
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant={batch.status === 'active' ? "default" : "secondary"}>
                                {batch.status === 'active' ? 'نشط' : batch.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-3">
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* اقتراحات إعادة الطلب */}
        <TabsContent value="reorder">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>اقتراحات إعادة الطلب</CardTitle>
                <CardDescription>المنتجات التي وصلت للحد الأدنى وتحتاج إعادة طلب</CardDescription>
              </div>
              <Button 
                onClick={() => checkReorder.mutate()}
                disabled={checkReorder.isPending}
              >
                <RefreshCw className={`h-4 w-4 ml-2 ${checkReorder.isPending ? 'animate-spin' : ''}`} />
                فحص المخزون
              </Button>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : reorderSuggestions?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-50" />
                  <p>لا توجد اقتراحات لإعادة الطلب</p>
                  <p className="text-sm mt-2">جميع المنتجات فوق الحد الأدنى</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-right py-3 px-3 font-medium">المنتج</th>
                        <th className="text-right py-3 px-3 font-medium">الكمية الحالية</th>
                        <th className="text-right py-3 px-3 font-medium">الحد الأدنى</th>
                        <th className="text-right py-3 px-3 font-medium">الكمية المقترحة</th>
                        <th className="text-right py-3 px-3 font-medium">آخر سعر شراء</th>
                        <th className="text-right py-3 px-3 font-medium">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reorderSuggestions?.map((suggestion) => (
                        <tr key={suggestion.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-3">
                            <div>
                              <div className="font-medium">{suggestion.productName}</div>
                              {suggestion.productSku && (
                                <div className="text-xs text-muted-foreground">{suggestion.productSku}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="destructive">{suggestion.currentQuantity}</Badge>
                          </td>
                          <td className="py-3 px-3">{suggestion.minQuantity}</td>
                          <td className="py-3 px-3 font-medium">{suggestion.suggestedQuantity}</td>
                          <td className="py-3 px-3">
                            {suggestion.lastPurchasePrice 
                              ? formatCurrency(suggestion.lastPurchasePrice)
                              : '-'
                            }
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 hover:text-emerald-700"
                                onClick={() => updateSuggestion.mutate({ 
                                  id: suggestion.id, 
                                  status: 'approved' 
                                })}
                                disabled={updateSuggestion.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => updateSuggestion.mutate({ 
                                  id: suggestion.id, 
                                  status: 'dismissed' 
                                })}
                                disabled={updateSuggestion.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* الجرد الدوري */}
        <TabsContent value="counts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>الجرد الدوري</CardTitle>
                <CardDescription>سجل عمليات الجرد ومقارنة الفروقات</CardDescription>
              </div>
              <Button onClick={() => setShowNewCountDialog(true)}>
                <Plus className="h-4 w-4 ml-2" />
                جرد جديد
              </Button>
            </CardHeader>
            <CardContent>
              {countsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : inventoryCounts?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد عمليات جرد مسجلة</p>
                  <Button className="mt-4" onClick={() => setShowNewCountDialog(true)}>
                    <Plus className="h-4 w-4 ml-2" />
                    بدء جرد جديد
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-right py-3 px-3 font-medium">رقم الجرد</th>
                        <th className="text-right py-3 px-3 font-medium">الفرع</th>
                        <th className="text-right py-3 px-3 font-medium">التاريخ</th>
                        <th className="text-right py-3 px-3 font-medium">المنتجات</th>
                        <th className="text-right py-3 px-3 font-medium">الفروقات</th>
                        <th className="text-right py-3 px-3 font-medium">قيمة الفرق</th>
                        <th className="text-right py-3 px-3 font-medium">الحالة</th>
                        <th className="text-right py-3 px-3 font-medium">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryCounts?.map((count) => (
                        <tr key={count.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-3 font-medium">{count.countNumber}</td>
                          <td className="py-3 px-3">{count.branchName || 'الرئيسي'}</td>
                          <td className="py-3 px-3">
                            {format(new Date(count.countDate), 'dd/MM/yyyy', { locale: ar })}
                          </td>
                          <td className="py-3 px-3">{count.totalProducts}</td>
                          <td className="py-3 px-3">
                            {count.discrepancyProducts > 0 ? (
                              <Badge variant="destructive">{count.discrepancyProducts}</Badge>
                            ) : (
                              <Badge variant="outline">0</Badge>
                            )}
                          </td>
                          <td className={`py-3 px-3 ${parseFloat(count.varianceValue) !== 0 ? 'text-red-600' : ''}`}>
                            {formatCurrency(count.varianceValue)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={
                              count.status === 'approved' ? 'default' :
                              count.status === 'completed' ? 'secondary' :
                              count.status === 'in_progress' ? 'outline' :
                              'secondary'
                            }>
                              {count.status === 'draft' ? 'مسودة' :
                               count.status === 'in_progress' ? 'جاري' :
                               count.status === 'completed' ? 'مكتمل' :
                               count.status === 'approved' ? 'معتمد' : count.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* نافذة إنشاء جرد جديد */}
      <Dialog open={showNewCountDialog} onOpenChange={setShowNewCountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إنشاء جرد جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات الجرد الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select
                value={newCountData.branchId}
                onValueChange={(value) => setNewCountData({ ...newCountData, branchId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">الرئيسي</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تاريخ الجرد</Label>
              <Input
                type="date"
                value={newCountData.countDate}
                onChange={(e) => setNewCountData({ ...newCountData, countDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                placeholder="أضف ملاحظات..."
                value={newCountData.notes}
                onChange={(e) => setNewCountData({ ...newCountData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCountDialog(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={() => {
                const branchId = newCountData.branchId ? parseInt(newCountData.branchId) : undefined;
                const branchName = branches?.find(b => b.id === branchId)?.name;
                createCount.mutate({
                  branchId,
                  branchName,
                  countDate: newCountData.countDate,
                  notes: newCountData.notes || undefined,
                });
              }}
              disabled={createCount.isPending}
            >
              {createCount.isPending ? 'جاري الإنشاء...' : 'إنشاء الجرد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
