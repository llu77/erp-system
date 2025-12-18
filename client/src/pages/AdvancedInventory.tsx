import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Calendar
} from "lucide-react";

export default function AdvancedInventory() {
  const [selectedTab, setSelectedTab] = useState("batches");
  const utils = trpc.useUtils();

  // جلب المنتجات قريبة الانتهاء
  const { data: expiringProducts, isLoading: expiringLoading } = trpc.inventory.batches.expiring.useQuery({ daysAhead: 30 });

  // جلب اقتراحات إعادة الطلب
  const { data: reorderSuggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = trpc.inventory.reorderSuggestions.pending.useQuery();

  // جلب عمليات الجرد
  const { data: inventoryCounts, isLoading: countsLoading } = trpc.inventory.counts.list.useQuery();

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

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            إدارة المخزون المتقدمة
          </h1>
          <p className="text-muted-foreground">تتبع الدفعات، تواريخ الانتهاء، وإعادة الطلب التلقائي</p>
        </div>
      </div>

      {/* ملخص */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">منتجات قريبة الانتهاء</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{expiringProducts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">خلال 30 يوم</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">اقتراحات إعادة الطلب</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reorderSuggestions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">منتجات تحتاج إعادة طلب</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عمليات الجرد</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryCounts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">جرد مسجل</p>
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="batches">تتبع الدفعات</TabsTrigger>
          <TabsTrigger value="expiring">قريبة الانتهاء</TabsTrigger>
          <TabsTrigger value="reorder">إعادة الطلب</TabsTrigger>
          <TabsTrigger value="counts">الجرد الدوري</TabsTrigger>
        </TabsList>

        {/* المنتجات قريبة الانتهاء */}
        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <CardTitle>المنتجات قريبة الانتهاء</CardTitle>
              <CardDescription>المنتجات التي ستنتهي صلاحيتها خلال 30 يوم</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : expiringProducts?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد منتجات قريبة الانتهاء</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2 px-3">رقم الدفعة</th>
                        <th className="text-right py-2 px-3">الكمية المتبقية</th>
                        <th className="text-right py-2 px-3">تاريخ الانتهاء</th>
                        <th className="text-right py-2 px-3">الأيام المتبقية</th>
                        <th className="text-right py-2 px-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiringProducts?.map((batch) => {
                        const daysLeft = batch.expiryDate 
                          ? Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : 0;
                        return (
                          <tr key={batch.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3 font-medium">{batch.batchNumber}</td>
                            <td className="py-2 px-3">{batch.remainingQuantity}</td>
                            <td className="py-2 px-3">
                              {batch.expiryDate 
                                ? format(new Date(batch.expiryDate), 'dd/MM/yyyy', { locale: ar })
                                : '-'
                              }
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant={daysLeft <= 7 ? "destructive" : daysLeft <= 14 ? "secondary" : "outline"}>
                                {daysLeft} يوم
                              </Badge>
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant={batch.status === 'active' ? "default" : "secondary"}>
                                {batch.status === 'active' ? 'نشط' : batch.status}
                              </Badge>
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
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد اقتراحات لإعادة الطلب</p>
                  <p className="text-sm mt-2">جميع المنتجات فوق الحد الأدنى</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2 px-3">المنتج</th>
                        <th className="text-right py-2 px-3">الكمية الحالية</th>
                        <th className="text-right py-2 px-3">الحد الأدنى</th>
                        <th className="text-right py-2 px-3">الكمية المقترحة</th>
                        <th className="text-right py-2 px-3">آخر سعر شراء</th>
                        <th className="text-right py-2 px-3">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reorderSuggestions?.map((suggestion) => (
                        <tr key={suggestion.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3">
                            <div>
                              <div className="font-medium">{suggestion.productName}</div>
                              {suggestion.productSku && (
                                <div className="text-xs text-muted-foreground">{suggestion.productSku}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant="destructive">{suggestion.currentQuantity}</Badge>
                          </td>
                          <td className="py-2 px-3">{suggestion.minQuantity}</td>
                          <td className="py-2 px-3 font-medium">{suggestion.suggestedQuantity}</td>
                          <td className="py-2 px-3">
                            {suggestion.lastPurchasePrice 
                              ? formatCurrency(suggestion.lastPurchasePrice)
                              : '-'
                            }
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
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
              <Button>
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
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-right py-2 px-3">رقم الجرد</th>
                        <th className="text-right py-2 px-3">الفرع</th>
                        <th className="text-right py-2 px-3">التاريخ</th>
                        <th className="text-right py-2 px-3">المنتجات</th>
                        <th className="text-right py-2 px-3">الفروقات</th>
                        <th className="text-right py-2 px-3">قيمة الفرق</th>
                        <th className="text-right py-2 px-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryCounts?.map((count) => (
                        <tr key={count.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3 font-medium">{count.countNumber}</td>
                          <td className="py-2 px-3">{count.branchName || 'الرئيسي'}</td>
                          <td className="py-2 px-3">
                            {format(new Date(count.countDate), 'dd/MM/yyyy', { locale: ar })}
                          </td>
                          <td className="py-2 px-3">{count.totalProducts}</td>
                          <td className="py-2 px-3">
                            {count.discrepancyProducts > 0 ? (
                              <Badge variant="destructive">{count.discrepancyProducts}</Badge>
                            ) : (
                              <Badge variant="outline">0</Badge>
                            )}
                          </td>
                          <td className={`py-2 px-3 ${parseFloat(count.varianceValue) !== 0 ? 'text-red-600' : ''}`}>
                            {formatCurrency(count.varianceValue)}
                          </td>
                          <td className="py-2 px-3">
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
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
      </Tabs>
    </div>
  );
}
