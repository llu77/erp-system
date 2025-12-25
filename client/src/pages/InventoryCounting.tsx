import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  ClipboardList, 
  Package, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Play,
  Pause,
  Check,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  History,
  BarChart3,
  Calculator,
  Save,
  Loader2
} from "lucide-react";

export default function InventoryCounting() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [countedQuantity, setCountedQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");

  // جلب البيانات
  const { data: activeCount, refetch: refetchActive } = trpc.inventoryCounting.active.useQuery();
  const { data: countHistory } = trpc.inventoryCounting.list.useQuery();
  const { data: countItems, refetch: refetchItems } = trpc.inventoryCounting.items.useQuery(
    { countId: activeCount?.id || 0 },
    { enabled: !!activeCount?.id }
  );
  const { data: branches } = trpc.branches.list.useQuery();

  // Mutations
  const startCount = trpc.inventoryCounting.start.useMutation({
    onSuccess: () => {
      toast.success("تم بدء الجرد بنجاح");
      refetchActive();
      setShowStartDialog(false);
    },
    onError: (error) => {
      toast.error(error.message || "فشل في بدء الجرد");
    },
  });

  const updateQuantity = trpc.inventoryCounting.updateItemQuantity.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الكمية بنجاح");
      refetchItems();
      refetchActive();
      setSelectedItem(null);
      setCountedQuantity("");
      setReason("");
    },
    onError: (error) => {
      toast.error(error.message || "فشل في تحديث الكمية");
    },
  });

  const approveCount = trpc.inventoryCounting.approve.useMutation({
    onSuccess: () => {
      toast.success("تم اعتماد الجرد وتحديث المخزون بنجاح");
      refetchActive();
    },
    onError: (error) => {
      toast.error(error.message || "فشل في اعتماد الجرد");
    },
  });

  const cancelCount = trpc.inventoryCounting.cancel.useMutation({
    onSuccess: () => {
      toast.success("تم إلغاء الجرد");
      refetchActive();
    },
    onError: (error) => {
      toast.error(error.message || "فشل في إلغاء الجرد");
    },
  });

  // تصفية العناصر
  const filteredItems = useMemo(() => {
    if (!countItems) return [];
    
    let items = countItems;
    
    // تصفية حسب البحث
    if (searchTerm) {
      items = items.filter(item => 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productSku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // تصفية حسب التبويب
    switch (activeTab) {
      case "pending":
        items = items.filter(item => item.status === "pending");
        break;
      case "counted":
        items = items.filter(item => item.status === "counted");
        break;
      case "variance":
        items = items.filter(item => item.variance !== 0);
        break;
    }
    
    return items;
  }, [countItems, searchTerm, activeTab]);

  // حساب الإحصائيات
  const stats = useMemo(() => {
    if (!countItems) return { total: 0, counted: 0, pending: 0, variance: 0, progress: 0 };
    
    const total = countItems.length;
    const counted = countItems.filter(item => item.status === "counted").length;
    const pending = countItems.filter(item => item.status === "pending").length;
    const variance = countItems.filter(item => item.variance !== 0).length;
    const progress = total > 0 ? (counted / total) * 100 : 0;
    
    return { total, counted, pending, variance, progress };
  }, [countItems]);

  // بدء جرد جديد
  const handleStartCount = () => {
    const branch = branches?.find(b => b.id.toString() === selectedBranch);
    startCount.mutate({
      branchId: branch?.id || null,
      branchName: branch?.name || null,
    });
  };

  // تحديث كمية منتج
  const handleUpdateQuantity = () => {
    if (!selectedItem || countedQuantity === "") return;
    
    updateQuantity.mutate({
      itemId: selectedItem.id,
      countedQuantity: parseInt(countedQuantity),
      reason: reason || undefined,
    });
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

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الجرد الفعلي</h1>
          <p className="text-muted-foreground">تسجيل الكميات الفعلية ومقارنتها بالمخزون النظري</p>
        </div>
        
        {!activeCount && isManager && (
          <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Play className="h-4 w-4" />
                بدء جرد جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>بدء جرد جديد</DialogTitle>
                <DialogDescription>
                  سيتم تحميل جميع المنتجات للجرد. اختر الفرع إذا كنت تريد جرد فرع معين.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>الفرع (اختياري)</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="جميع الفروع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowStartDialog(false)}>إلغاء</Button>
                <Button onClick={handleStartCount} disabled={startCount.isPending}>
                  {startCount.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  بدء الجرد
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* الجرد الجاري */}
      {activeCount ? (
        <>
          {/* معلومات الجرد */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    {activeCount.countNumber}
                  </CardTitle>
                  <CardDescription>
                    بدأ في {new Date(activeCount.countDate).toLocaleDateString("ar-SA")} بواسطة {activeCount.createdByName}
                    {activeCount.branchName && ` - فرع ${activeCount.branchName}`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={activeCount.status === "in_progress" ? "default" : "secondary"}>
                    {activeCount.status === "in_progress" ? "جاري" : activeCount.status}
                  </Badge>
                  {isAdmin && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => cancelCount.mutate({ countId: activeCount.id })}
                        disabled={cancelCount.isPending}
                      >
                        <X className="h-4 w-4 ml-1" />
                        إلغاء
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => approveCount.mutate({ countId: activeCount.id, updateStock: true })}
                        disabled={approveCount.isPending || stats.pending > 0}
                      >
                        <Check className="h-4 w-4 ml-1" />
                        اعتماد وتحديث المخزون
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* شريط التقدم */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>التقدم</span>
                    <span>{stats.counted} / {stats.total} ({stats.progress.toFixed(0)}%)</span>
                  </div>
                  <Progress value={stats.progress} className="h-2" />
                </div>
                
                {/* الإحصائيات */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Package className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">إجمالي المنتجات</div>
                  </div>
                  <div className="text-center p-3 bg-green-500/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <div className="text-2xl font-bold text-green-500">{stats.counted}</div>
                    <div className="text-xs text-muted-foreground">تم جردها</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                    <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
                    <div className="text-xs text-muted-foreground">في الانتظار</div>
                  </div>
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
                    <div className="text-2xl font-bold text-red-500">{stats.variance}</div>
                    <div className="text-xs text-muted-foreground">فروقات</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* قائمة المنتجات */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>المنتجات</CardTitle>
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
                  <TabsTrigger value="all">الكل ({countItems?.length || 0})</TabsTrigger>
                  <TabsTrigger value="pending">في الانتظار ({stats.pending})</TabsTrigger>
                  <TabsTrigger value="counted">تم جردها ({stats.counted})</TabsTrigger>
                  <TabsTrigger value="variance">فروقات ({stats.variance})</TabsTrigger>
                </TabsList>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-right p-3 font-medium">المنتج</th>
                        <th className="text-center p-3 font-medium">الكمية النظرية</th>
                        <th className="text-center p-3 font-medium">الكمية الفعلية</th>
                        <th className="text-center p-3 font-medium">الفرق</th>
                        <th className="text-center p-3 font-medium">الحالة</th>
                        <th className="text-center p-3 font-medium">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => (
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
                          <td className="text-center p-3">
                            {item.status === "counted" ? item.countedQuantity : "-"}
                          </td>
                          <td className="text-center p-3">
                            <span className={`flex items-center justify-center gap-1 ${getVarianceColor(item.variance)}`}>
                              {getVarianceIcon(item.variance)}
                              {item.variance}
                            </span>
                          </td>
                          <td className="text-center p-3">
                            <Badge variant={item.status === "counted" ? "default" : "secondary"}>
                              {item.status === "counted" ? "تم الجرد" : "في الانتظار"}
                            </Badge>
                          </td>
                          <td className="text-center p-3">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(item);
                                setCountedQuantity(item.status === "counted" ? item.countedQuantity.toString() : "");
                                setReason(item.reason || "");
                              }}
                            >
                              <Calculator className="h-4 w-4 ml-1" />
                              {item.status === "counted" ? "تعديل" : "جرد"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-muted-foreground">
                            لا توجد منتجات
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* نافذة إدخال الكمية */}
          <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تسجيل الكمية الفعلية</DialogTitle>
                <DialogDescription>
                  {selectedItem?.productName}
                  {selectedItem?.productSku && ` (${selectedItem.productSku})`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">الكمية النظرية</div>
                    <div className="text-2xl font-bold">{selectedItem?.systemQuantity}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>الكمية الفعلية</Label>
                    <Input
                      type="number"
                      min="0"
                      value={countedQuantity}
                      onChange={(e) => setCountedQuantity(e.target.value)}
                      placeholder="أدخل الكمية الفعلية"
                      autoFocus
                    />
                  </div>
                </div>
                
                {countedQuantity !== "" && parseInt(countedQuantity) !== selectedItem?.systemQuantity && (
                  <div className={`p-3 rounded-lg ${parseInt(countedQuantity) > selectedItem?.systemQuantity ? "bg-blue-500/10" : "bg-red-500/10"}`}>
                    <div className="flex items-center justify-between">
                      <span>الفرق:</span>
                      <span className={`font-bold ${parseInt(countedQuantity) > selectedItem?.systemQuantity ? "text-blue-500" : "text-red-500"}`}>
                        {parseInt(countedQuantity) - (selectedItem?.systemQuantity || 0)}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>سبب الفرق (اختياري)</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="أدخل سبب الفرق إن وجد..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedItem(null)}>إلغاء</Button>
                <Button 
                  onClick={handleUpdateQuantity} 
                  disabled={updateQuantity.isPending || countedQuantity === ""}
                >
                  {updateQuantity.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
                  حفظ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        /* لا يوجد جرد جاري */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">لا يوجد جرد جاري</h3>
            <p className="text-muted-foreground text-center mb-4">
              ابدأ جرد جديد لتسجيل الكميات الفعلية ومقارنتها بالمخزون النظري
            </p>
            {isManager && (
              <Button onClick={() => setShowStartDialog(true)}>
                <Play className="h-4 w-4 ml-2" />
                بدء جرد جديد
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* سجل الجرد */}
      {countHistory && countHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              سجل الجرد السابق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-right p-3 font-medium">رقم الجرد</th>
                    <th className="text-center p-3 font-medium">التاريخ</th>
                    <th className="text-center p-3 font-medium">الفرع</th>
                    <th className="text-center p-3 font-medium">المنتجات</th>
                    <th className="text-center p-3 font-medium">الفروقات</th>
                    <th className="text-center p-3 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {countHistory.filter(c => c.status !== "in_progress").slice(0, 10).map((count) => (
                    <tr key={count.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 font-medium">{count.countNumber}</td>
                      <td className="text-center p-3">
                        {new Date(count.countDate).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="text-center p-3">{count.branchName || "جميع الفروع"}</td>
                      <td className="text-center p-3">{count.totalProducts}</td>
                      <td className="text-center p-3">
                        <span className={count.discrepancyProducts > 0 ? "text-red-500" : "text-green-500"}>
                          {count.discrepancyProducts}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <Badge variant={count.status === "approved" ? "default" : "secondary"}>
                          {count.status === "approved" ? "معتمد" : count.status === "completed" ? "مكتمل" : count.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
