import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
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
  ArrowRight,
  Clock,
  Calendar,
  Printer,
  FileDown,
} from 'lucide-react';
import { Link } from 'wouter';

export default function POSDailyReport() {
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  
  // Queries
  const { data: branches = [] } = trpc.pos.branches.list.useQuery();
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
  const formattedDate = currentDate.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/pos">
              <Button variant="ghost" size="icon">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                تقرير اليوم
              </h1>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                {formattedDate}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Branch Selection */}
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
              <Select value={selectedBranchId?.toString() || ''} onValueChange={(v) => setSelectedBranchId(Number(v))}>
                <SelectTrigger className="w-[200px]">
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
            </div>
            
            {/* Export Buttons */}
            <Button variant="outline" className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
            <Button variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              تصدير
            </Button>
          </div>
        </div>
        
        {!selectedBranchId ? (
          <Card className="p-12 text-center">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">اختر الفرع</h2>
            <p className="text-muted-foreground">يرجى اختيار الفرع لعرض تقرير اليوم</p>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    إجمالي الفواتير
                  </CardTitle>
                  <Receipt className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dailyReport?.totalInvoices || 0}</div>
                  <p className="text-sm text-muted-foreground mt-1">فاتورة</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    إجمالي الإيرادات
                  </CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-500">
                    {(dailyReport?.totalRevenue || 0).toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">ريال سعودي</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    إجمالي الكاش
                  </CardTitle>
                  <Banknote className="h-5 w-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-500">
                    {(dailyReport?.totalCash || 0).toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">ريال سعودي</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    إجمالي الشبكة
                  </CardTitle>
                  <CreditCard className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-500">
                    {(dailyReport?.totalCard || 0).toFixed(2)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">ريال سعودي</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Employee Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  أداء الموظفين
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employeeStats.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">#</TableHead>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-center">عدد الفواتير</TableHead>
                        <TableHead className="text-left">الإيرادات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeStats.map((emp, index) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{emp.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{emp.invoiceCount}</Badge>
                          </TableCell>
                          <TableCell className="text-left font-bold text-primary">
                            {emp.totalRevenue.toFixed(2)} ر.س
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    لا توجد فواتير اليوم
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Today's Invoices */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  فواتير اليوم
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayInvoices.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">رقم الفاتورة</TableHead>
                          <TableHead className="text-right">الوقت</TableHead>
                          <TableHead className="text-right">الموظف</TableHead>
                          <TableHead className="text-center">طريقة الدفع</TableHead>
                          <TableHead className="text-left">الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todayInvoices.map(invoice => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(invoice.createdAt).toLocaleTimeString('ar-SA', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: false 
                                })}
                              </div>
                            </TableCell>
                            <TableCell>{invoice.employeeName}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={
                                invoice.paymentMethod === 'cash' ? 'secondary' :
                                invoice.paymentMethod === 'card' ? 'default' :
                                invoice.paymentMethod === 'split' ? 'outline' : 'destructive'
                              }>
                                {invoice.paymentMethod === 'cash' ? 'كاش' :
                                 invoice.paymentMethod === 'card' ? 'شبكة' :
                                 invoice.paymentMethod === 'split' ? 'تقسيم' : 'ولاء'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-left font-bold">
                              {Number(invoice.total).toFixed(2)} ر.س
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    لا توجد فواتير اليوم
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
