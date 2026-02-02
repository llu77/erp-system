import { useState, useMemo, useEffect } from 'react';
import DailyConfirmationDialog from '@/components/DailyConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import { 
  BarChart3, 
  Store, 
  Receipt, 
  Banknote, 
  CreditCard, 
  Users,
  TrendingUp,
  Clock,
  Calendar,
  Printer,
  FileDown,
  CheckCircle2,
  Send,
} from 'lucide-react';
import POSNavHeader from '@/components/POSNavHeader';
import { useAuth } from '@/_core/hooks/useAuth';

export default function POSDailyReport() {
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  
  // Filter branches based on user permissions
  const userBranchId = user?.branchId;
  const isAdmin = user?.role === 'admin';
  
  // Queries
  const { data: allBranches = [] } = trpc.pos.branches.list.useQuery();
  
  // Filter branches: Admin sees all, supervisors see only their branch
  const branches = useMemo(() => {
    if (isAdmin) return allBranches;
    if (userBranchId) return allBranches.filter(b => b.id === userBranchId);
    return allBranches;
  }, [allBranches, isAdmin, userBranchId]);
  
  // Auto-select branch for supervisors
  useEffect(() => {
    if (!isAdmin && userBranchId && !selectedBranchId) {
      setSelectedBranchId(userBranchId);
    }
  }, [isAdmin, userBranchId, selectedBranchId]);
  const { data: todayInvoices = [] } = trpc.pos.invoices.today.useQuery(
    { branchId: selectedBranchId! },
    { enabled: !!selectedBranchId }
  );
  
  // Daily report will be calculated from invoices
  const dailyReport = useMemo(() => {
    if (!todayInvoices || todayInvoices.length === 0) return null;
    return {
      totalInvoices: todayInvoices.length,
      totalRevenue: todayInvoices.reduce((sum, inv) => sum + Number(inv.total), 0),
      totalCash: todayInvoices.filter(inv => inv.paymentMethod === 'cash').reduce((sum, inv) => sum + Number(inv.total), 0) +
                 todayInvoices.filter(inv => inv.paymentMethod === 'split').reduce((sum, inv) => sum + Number(inv.cashAmount || 0), 0),
      totalCard: todayInvoices.filter(inv => inv.paymentMethod === 'card').reduce((sum, inv) => sum + Number(inv.total), 0) +
                 todayInvoices.filter(inv => inv.paymentMethod === 'split').reduce((sum, inv) => sum + Number(inv.cardAmount || 0), 0),
    };
  }, [todayInvoices]);
  
  // Computed values
  const employeeStats = useMemo(() => {
    if (!todayInvoices.length) return [];
    
    const stats: Record<number, { name: string; invoiceCount: number; totalRevenue: number }> = {};
    
    todayInvoices.forEach(invoice => {
      if (!stats[invoice.employeeId]) {
        stats[invoice.employeeId] = {
          name: invoice.employeeName || 'غير معروف',
          invoiceCount: 0,
          totalRevenue: 0,
        };
      }
      stats[invoice.employeeId].invoiceCount++;
      stats[invoice.employeeId].totalRevenue += Number(invoice.total);
    });
    
    return Object.entries(stats)
      .map(([id, data]) => ({ id: Number(id), ...data }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [todayInvoices]);
  
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedDateShort = currentDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  const handlePrint = () => {
    const branchName = branches.find(b => b.id === selectedBranchId)?.nameAr || 'غير محدد';
    
    const printHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير اليوم - ${formattedDate}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0; color: #666; }
          .summary { display: flex; justify-content: space-around; margin: 20px 0; }
          .summary-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 120px; }
          .summary-item h3 { margin: 0; font-size: 14px; color: #666; }
          .summary-item p { margin: 10px 0 0; font-size: 24px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #f5f5f5; }
          .section-title { font-size: 18px; margin: 20px 0 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Symbol AI - تقرير اليوم</h1>
          <p>الفرع: ${branchName}</p>
          <p>${formattedDate}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <h3>إجمالي الفواتير</h3>
            <p>${dailyReport?.totalInvoices || 0}</p>
          </div>
          <div class="summary-item">
            <h3>إجمالي الإيرادات</h3>
            <p style="color: green;">${(dailyReport?.totalRevenue || 0).toFixed(2)} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>إجمالي الكاش</h3>
            <p style="color: orange;">${(dailyReport?.totalCash || 0).toFixed(2)} ر.س</p>
          </div>
          <div class="summary-item">
            <h3>إجمالي الشبكة</h3>
            <p style="color: blue;">${(dailyReport?.totalCard || 0).toFixed(2)} ر.س</p>
          </div>
        </div>
        
        <h2 class="section-title">أداء الموظفين</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الموظف</th>
              <th>عدد الفواتير</th>
              <th>الإيرادات</th>
            </tr>
          </thead>
          <tbody>
            ${employeeStats.map((emp, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${emp.name}</td>
                <td>${emp.invoiceCount}</td>
                <td>${emp.totalRevenue.toFixed(2)} ر.س</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h2 class="section-title">فواتير اليوم</h2>
        <table>
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>الوقت</th>
              <th>الموظف</th>
              <th>طريقة الدفع</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${todayInvoices.map(inv => `
              <tr>
                <td>${inv.invoiceNumber}</td>
                <td>${new Date(inv.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                <td>${inv.employeeName}</td>
                <td>${inv.paymentMethod === 'cash' ? 'كاش' : inv.paymentMethod === 'card' ? 'شبكة' : inv.paymentMethod === 'split' ? 'تقسيم' : 'ولاء'}</td>
                <td>${Number(inv.total).toFixed(2)} ر.س</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" dir="rtl">
      {/* POS Navigation Header */}
      <POSNavHeader 
        title="تقرير اليوم" 
        subtitle={formattedDate}
        icon={<BarChart3 className="h-5 w-5 text-primary" />}
      />
      
      {/* Sub Header with Branch Selection & Actions */}
      <div className="h-14 bg-card/50 border-b flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-primary" />
          {isAdmin ? (
            <Select value={selectedBranchId?.toString() || ''} onValueChange={(v) => setSelectedBranchId(Number(v))}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.nameAr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium">
              {branches.find(b => b.id === selectedBranchId)?.nameAr || 'الفرع'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            size="sm" 
            className="gap-2 bg-green-600 hover:bg-green-700" 
            onClick={() => setShowConfirmationDialog(true)} 
            disabled={!selectedBranchId || !dailyReport || dailyReport.totalInvoices === 0}
          >
            <Send className="h-4 w-4" />
            تأكيد وإرسال
          </Button>
          
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint} disabled={!selectedBranchId}>
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedBranchId ? (
          <div className="h-full flex items-center justify-center">
            <Card className="p-12 text-center max-w-md">
              <Store className="h-20 w-20 mx-auto mb-6 text-muted-foreground opacity-30" />
              <h2 className="text-2xl font-bold mb-3">اختر الفرع</h2>
              <p className="text-muted-foreground text-lg">يرجى اختيار الفرع من القائمة أعلاه لعرض تقرير اليوم</p>
            </Card>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Summary Cards - Large & Prominent */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-primary/20 rounded-xl flex items-center justify-center">
                      <Receipt className="h-7 w-7 text-primary" />
                    </div>
                    <Badge variant="secondary" className="text-sm">اليوم</Badge>
                  </div>
                  <div className="text-4xl font-bold mb-1">{dailyReport?.totalInvoices || 0}</div>
                  <p className="text-muted-foreground">إجمالي الفواتير</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="h-7 w-7 text-green-500" />
                    </div>
                    <Badge variant="secondary" className="text-sm bg-green-500/10 text-green-600">إيرادات</Badge>
                  </div>
                  <div className="text-4xl font-bold text-green-600 mb-1">
                    {(dailyReport?.totalRevenue || 0).toFixed(2)}
                  </div>
                  <p className="text-muted-foreground">ريال سعودي</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border-yellow-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                      <Banknote className="h-7 w-7 text-yellow-600" />
                    </div>
                    <Badge variant="secondary" className="text-sm bg-yellow-500/10 text-yellow-600">كاش</Badge>
                  </div>
                  <div className="text-4xl font-bold text-yellow-600 mb-1">
                    {(dailyReport?.totalCash || 0).toFixed(2)}
                  </div>
                  <p className="text-muted-foreground">ريال سعودي</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <CreditCard className="h-7 w-7 text-blue-500" />
                    </div>
                    <Badge variant="secondary" className="text-sm bg-blue-500/10 text-blue-600">شبكة</Badge>
                  </div>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    {(dailyReport?.totalCard || 0).toFixed(2)}
                  </div>
                  <p className="text-muted-foreground">ريال سعودي</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Employee Performance */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    أداء الموظفين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {employeeStats.length > 0 ? (
                    <div className="space-y-3">
                      {employeeStats.map((emp, index) => (
                        <div key={emp.id} className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            index === 0 ? 'bg-yellow-500 text-white' :
                            index === 1 ? 'bg-gray-400 text-white' :
                            index === 2 ? 'bg-amber-700 text-white' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-lg">{emp.name}</div>
                            <div className="text-sm text-muted-foreground">{emp.invoiceCount} فاتورة</div>
                          </div>
                          <div className="text-left">
                            <div className="text-2xl font-bold text-primary">{emp.totalRevenue.toFixed(2)}</div>
                            <div className="text-sm text-muted-foreground">ر.س</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">لا توجد فواتير اليوم</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Today's Invoices */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    فواتير اليوم
                    {todayInvoices.length > 0 && (
                      <Badge variant="secondary">{todayInvoices.length}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {todayInvoices.length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {todayInvoices.map(invoice => (
                          <div key={invoice.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex-1">
                              <div className="font-mono text-sm text-muted-foreground">{invoice.invoiceNumber}</div>
                              <div className="font-medium">{invoice.employeeName}</div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              {new Date(invoice.createdAt).toLocaleTimeString('en-GB', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                hour12: false 
                              })}
                            </div>
                            <Badge variant={
                              invoice.paymentMethod === 'cash' ? 'secondary' :
                              invoice.paymentMethod === 'card' ? 'default' :
                              invoice.paymentMethod === 'split' ? 'outline' : 'destructive'
                            } className="min-w-[60px] justify-center">
                              {invoice.paymentMethod === 'cash' ? 'كاش' :
                               invoice.paymentMethod === 'card' ? 'شبكة' :
                               invoice.paymentMethod === 'split' ? 'تقسيم' : 'ولاء'}
                            </Badge>
                            <div className="text-left min-w-[80px]">
                              <div className="font-bold text-primary">{Number(invoice.total).toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">ر.س</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      <Receipt className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">لا توجد فواتير اليوم</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
      
      {/* Daily Confirmation Dialog */}
      {selectedBranchId && (
        <DailyConfirmationDialog
          open={showConfirmationDialog}
          onOpenChange={setShowConfirmationDialog}
          branchId={selectedBranchId}
          branchName={branches.find(b => b.id === selectedBranchId)?.nameAr || 'الفرع'}
          dailyReport={dailyReport}
          onSuccess={() => {
            // Refresh data after confirmation
          }}
        />
      )}
    </div>
  );
}
