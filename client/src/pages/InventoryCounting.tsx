import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  History,
  Save,
  Loader2,
  Printer,
  CheckSquare,
  AlertCircle,
  Edit3
} from "lucide-react";

export default function InventoryCounting() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [countedQuantity, setCountedQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
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
      setShowApproveDialog(false);
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
    
    if (searchTerm) {
      items = items.filter(item => 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.productSku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
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

  // فتح نافذة الجرد
  const openCountDialog = (item: any) => {
    setSelectedItem(item);
    setCountedQuantity(item.status === "counted" ? item.countedQuantity.toString() : "");
    setReason(item.reason || "");
  };

  // طباعة تقرير الجرد
  const handlePrintReport = () => {
    if (!activeCount || !countItems) return;

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير الجرد - ${activeCount.countNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 10px; }
          .header p { color: #666; }
          .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .info-box { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
          .info-box .value { font-size: 24px; font-weight: bold; }
          .info-box .label { font-size: 12px; color: #666; }
          .info-box.green .value { color: #22c55e; }
          .info-box.yellow .value { color: #eab308; }
          .info-box.red .value { color: #ef4444; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background: #333; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .variance-positive { color: #3b82f6; }
          .variance-negative { color: #ef4444; }
          .status-counted { background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; }
          .status-pending { background: #eab308; color: white; padding: 2px 8px; border-radius: 4px; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>تقرير الجرد الفعلي</h1>
          <p>رقم الجرد: ${activeCount.countNumber}</p>
          <p>التاريخ: ${new Date(activeCount.countDate).toLocaleDateString("ar-SA")}</p>
          <p>الفرع: ${activeCount.branchName || "جميع الفروع"}</p>
          <p>بواسطة: ${activeCount.createdByName}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <div class="value">${stats.total}</div>
            <div class="label">إجمالي المنتجات</div>
          </div>
          <div class="info-box green">
            <div class="value">${stats.counted}</div>
            <div class="label">تم جردها</div>
          </div>
          <div class="info-box yellow">
            <div class="value">${stats.pending}</div>
            <div class="label">في الانتظار</div>
          </div>
          <div class="info-box red">
            <div class="value">${stats.variance}</div>
            <div class="label">فروقات</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>المنتج</th>
              <th>الرمز</th>
              <th>الكمية النظرية</th>
              <th>الكمية الفعلية</th>
              <th>الفرق</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${countItems.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td style="text-align: right;">${item.productName}</td>
                <td>${item.productSku || "-"}</td>
                <td>${item.systemQuantity}</td>
                <td>${item.status === "counted" ? item.countedQuantity : "-"}</td>
                <td class="${item.variance > 0 ? 'variance-positive' : item.variance < 0 ? 'variance-negative' : ''}">
                  ${item.variance}
                </td>
                <td><span class="${item.status === 'counted' ? 'status-counted' : 'status-pending'}">${item.status === "counted" ? "تم الجرد" : "في الانتظار"}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="footer">
          <p>تم الطباعة في: ${new Date().toLocaleString("ar-SA")}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
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
  const isSupervisor = user?.role === "supervisor";
  
  const canStartCount = isManager || isSupervisor;
  const canApproveCount = isAdmin || isManager || (isSupervisor && activeCount && 
    (activeCount.createdBy === user?.id || activeCount.branchId === user?.branchId));
  const canCancelCount = canApproveCount;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">الجرد الفعلي</h1>
          <p className="text-sm text-muted-foreground">تسجيل الكميات الفعلية ومقارنتها بالمخزون النظري</p>
        </div>
        
        {!activeCount && canStartCount && (
          <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Play className="h-4 w-4" />
                بدء جرد جديد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>بدء جرد جديد</DialogTitle>
                <DialogDescription>
                  سيتم تحميل جميع المنتجات للجرد
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
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setShowStartDialog(false)} className="w-full sm:w-auto">إلغاء</Button>
                <Button onClick={handleStartCount} disabled={startCount.isPending} className="w-full sm:w-auto">
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
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      {activeCount.countNumber}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      بدأ في {new Date(activeCount.countDate).toLocaleDateString("ar-SA")} 
                      {activeCount.branchName && ` - ${activeCount.branchName}`}
                    </CardDescription>
                  </div>
                  <Badge variant={activeCount.status === "in_progress" ? "default" : "secondary"}>
                    {activeCount.status === "in_progress" ? "جاري" : activeCount.status}
                  </Badge>
                </div>
                
                {/* أزرار الإجراءات - متجاوبة */}
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handlePrintReport}
                    className="flex-1 sm:flex-none gap-1"
                  >
                    <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline">طباعة</span>
                  </Button>
                  
                  {canCancelCount && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        if (confirm("هل أنت متأكد من إلغاء الجرد؟")) {
                          cancelCount.mutate({ countId: activeCount.id });
                        }
                      }}
                      disabled={cancelCount.isPending}
                      className="flex-1 sm:flex-none gap-1 text-red-500 hover:text-red-600"
                    >
                      {cancelCount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      <span className="hidden sm:inline">إلغاء</span>
                    </Button>
                  )}
                  
                  {canApproveCount && (
                    <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm"
                          className="flex-1 sm:flex-none gap-1 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4" />
                          اعتماد
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>اعتماد الجرد</DialogTitle>
                          <DialogDescription>
                            سيتم تحديث كميات المخزون
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          {stats.pending > 0 && (
                            <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-yellow-600 text-sm">تنبيه: {stats.pending} منتج لم يتم جردها</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  سيتم اعتماد المنتجات المجرودة فقط
                                </p>
                              </div>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <div className="text-xl font-bold text-green-500">{stats.counted}</div>
                              <div className="text-xs text-muted-foreground">تم جرده</div>
                            </div>
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <div className="text-xl font-bold text-red-500">{stats.variance}</div>
                              <div className="text-xs text-muted-foreground">فروقات</div>
                            </div>
                          </div>
                        </div>
                        <DialogFooter className="flex-col sm:flex-row gap-2">
                          <Button variant="outline" onClick={() => setShowApproveDialog(false)} className="w-full sm:w-auto">
                            إلغاء
                          </Button>
                          <Button 
                            onClick={() => approveCount.mutate({ countId: activeCount.id, updateStock: true })}
                            disabled={approveCount.isPending || stats.counted === 0}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                          >
                            {approveCount.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin ml-2" />
                            ) : (
                              <CheckSquare className="h-4 w-4 ml-2" />
                            )}
                            تأكيد الاعتماد
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
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
                
                {/* الإحصائيات - متجاوبة */}
                <div className="grid grid-cols-4 gap-2 md:gap-4">
                  <div className="text-center p-2 md:p-3 bg-muted rounded-lg">
                    <Package className="h-4 w-4 md:h-5 md:w-5 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-lg md:text-2xl font-bold">{stats.total}</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">إجمالي</div>
                  </div>
                  <div className="text-center p-2 md:p-3 bg-green-500/10 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 mx-auto mb-1 text-green-500" />
                    <div className="text-lg md:text-2xl font-bold text-green-500">{stats.counted}</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">تم جردها</div>
                  </div>
                  <div className="text-center p-2 md:p-3 bg-yellow-500/10 rounded-lg">
                    <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 mx-auto mb-1 text-yellow-500" />
                    <div className="text-lg md:text-2xl font-bold text-yellow-500">{stats.pending}</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">انتظار</div>
                  </div>
                  <div className="text-center p-2 md:p-3 bg-red-500/10 rounded-lg">
                    <XCircle className="h-4 w-4 md:h-5 md:w-5 mx-auto mb-1 text-red-500" />
                    <div className="text-lg md:text-2xl font-bold text-red-500">{stats.variance}</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">فروقات</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* قائمة المنتجات */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <CardTitle className="text-lg">المنتجات</CardTitle>
                <div className="relative">
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
                <TabsList className="mb-4 w-full grid grid-cols-4 h-auto">
                  <TabsTrigger value="all" className="text-xs px-1 py-2">الكل ({countItems?.length || 0})</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs px-1 py-2">انتظار ({stats.pending})</TabsTrigger>
                  <TabsTrigger value="counted" className="text-xs px-1 py-2">تم ({stats.counted})</TabsTrigger>
                  <TabsTrigger value="variance" className="text-xs px-1 py-2">فروقات ({stats.variance})</TabsTrigger>
                </TabsList>

                {/* عرض البطاقات للموبايل */}
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div 
                      key={item.id} 
                      className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{item.productName}</div>
                          {item.productSku && (
                            <div className="text-xs text-muted-foreground">{item.productSku}</div>
                          )}
                        </div>
                        <Badge 
                          variant={item.status === "counted" ? "default" : "secondary"}
                          className="flex-shrink-0 text-xs"
                        >
                          {item.status === "counted" ? "تم" : "انتظار"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                        <div className="bg-muted/50 rounded p-2">
                          <div className="text-xs text-muted-foreground">النظرية</div>
                          <div className="font-bold">{item.systemQuantity}</div>
                        </div>
                        <div className="bg-muted/50 rounded p-2">
                          <div className="text-xs text-muted-foreground">الفعلية</div>
                          <div className="font-bold">
                            {item.status === "counted" ? item.countedQuantity : "-"}
                          </div>
                        </div>
                        <div className={`rounded p-2 ${item.variance < 0 ? 'bg-red-500/10' : item.variance > 0 ? 'bg-blue-500/10' : 'bg-green-500/10'}`}>
                          <div className="text-xs text-muted-foreground">الفرق</div>
                          <div className={`font-bold flex items-center justify-center gap-1 ${getVarianceColor(item.variance)}`}>
                            {getVarianceIcon(item.variance)}
                            {item.variance}
                          </div>
                        </div>
                      </div>
                      
                      {/* زر الجرد - كبير وواضح */}
                      <Button 
                        onClick={() => openCountDialog(item)}
                        className="w-full gap-2"
                        variant={item.status === "counted" ? "outline" : "default"}
                      >
                        {item.status === "counted" ? (
                          <>
                            <Edit3 className="h-4 w-4" />
                            تعديل الجرد
                          </>
                        ) : (
                          <>
                            <CheckSquare className="h-4 w-4" />
                            جرد المنتج
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                  
                  {filteredItems.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                      لا توجد منتجات
                    </div>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* نافذة إدخال الكمية */}
          <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تسجيل الكمية الفعلية</DialogTitle>
                <DialogDescription className="text-right">
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
                      placeholder="أدخل الكمية"
                      autoFocus
                      className="text-lg text-center"
                    />
                  </div>
                </div>
                
                {countedQuantity !== "" && parseInt(countedQuantity) !== selectedItem?.systemQuantity && (
                  <div className={`p-3 rounded-lg ${parseInt(countedQuantity) > selectedItem?.systemQuantity ? "bg-blue-500/10" : "bg-red-500/10"}`}>
                    <div className="flex items-center justify-between">
                      <span>الفرق:</span>
                      <span className={`font-bold text-lg ${parseInt(countedQuantity) > selectedItem?.systemQuantity ? "text-blue-500" : "text-red-500"}`}>
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
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setSelectedItem(null)} className="w-full sm:w-auto">إلغاء</Button>
                <Button 
                  onClick={handleUpdateQuantity} 
                  disabled={updateQuantity.isPending || countedQuantity === ""}
                  className="w-full sm:w-auto"
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
            <p className="text-muted-foreground text-center mb-4 text-sm px-4">
              ابدأ جرد جديد لتسجيل الكميات الفعلية
            </p>
            {canStartCount && (
              <Button onClick={() => setShowStartDialog(true)} className="w-full max-w-xs">
                <Play className="h-4 w-4 ml-2" />
                بدء جرد جديد
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* سجل الجرد */}
      {countHistory && countHistory.filter(c => c.status !== "in_progress").length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              سجل الجرد السابق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {countHistory.filter(c => c.status !== "in_progress").slice(0, 5).map((count) => (
                <div key={count.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{count.countNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(count.countDate).toLocaleDateString("ar-SA")}
                      {count.branchName && ` - ${count.branchName}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${count.discrepancyProducts > 0 ? "text-red-500" : "text-green-500"}`}>
                      {count.discrepancyProducts} فروقات
                    </span>
                    <Badge variant={count.status === "approved" ? "default" : "secondary"} className="text-xs">
                      {count.status === "approved" ? "معتمد" : "مكتمل"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
