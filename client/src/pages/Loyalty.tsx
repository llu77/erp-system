import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import { QrCode, Users, Gift, Calendar, Search, Eye, Printer } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useEffect } from 'react';

export default function Loyalty() {
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showVisitsDialog, setShowVisitsDialog] = useState(false);
  const [registerQR, setRegisterQR] = useState('');
  const [visitQR, setVisitQR] = useState('');

  // جلب البيانات
  const { data: stats, isLoading: statsLoading } = trpc.loyalty.stats.useQuery();
  const { data: customers, isLoading: customersLoading } = trpc.loyalty.list.useQuery();
  const { data: customerVisits } = trpc.loyalty.customerVisits.useQuery(
    { customerId: selectedCustomer?.id || 0 },
    { enabled: !!selectedCustomer }
  );

  // توليد باركود QR
  useEffect(() => {
    const baseUrl = window.location.origin;
    
    // باركود التسجيل الجديد
    QRCode.toDataURL(`${baseUrl}/loyalty/register`, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setRegisterQR);
    
    // باركود تسجيل الزيارة
    QRCode.toDataURL(`${baseUrl}/loyalty/visit`, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setVisitQR);
  }, []);

  // البحث عن عميل
  const filteredCustomers = customers?.filter(c => 
    !searchPhone || c.phone.includes(searchPhone) || c.name.includes(searchPhone)
  );

  // طباعة باركود
  const printQR = (type: 'register' | 'visit') => {
    const qr = type === 'register' ? registerQR : visitQR;
    const title = type === 'register' ? 'تسجيل عميل جديد' : 'تسجيل زيارة';
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <title>باركود ${title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .container {
              text-align: center;
              border: 3px solid #000;
              padding: 30px;
              border-radius: 20px;
              background: #fff;
            }
            h1 {
              font-size: 28px;
              margin-bottom: 10px;
              color: #333;
            }
            h2 {
              font-size: 22px;
              margin-bottom: 20px;
              color: #666;
            }
            img {
              width: 250px;
              height: 250px;
            }
            .instructions {
              margin-top: 20px;
              font-size: 16px;
              color: #555;
            }
            .logo {
              font-size: 36px;
              font-weight: bold;
              color: #6366f1;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">Symbol AI</div>
            <h1>برنامج الولاء</h1>
            <h2>${title}</h2>
            <img src="${qr}" alt="QR Code" />
            <div class="instructions">
              ${type === 'register' 
                ? 'امسح الباركود للتسجيل في برنامج الولاء والحصول على خصومات حصرية!'
                : 'امسح الباركود لتسجيل زيارتك والحصول على خصم 50% في الزيارة الرابعة!'
              }
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">برنامج الولاء</h1>
            <p className="text-muted-foreground">إدارة عملاء برنامج الولاء والخصومات</p>
          </div>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                  <p className="text-2xl font-bold">{stats?.totalCustomers || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الزيارات</p>
                  <p className="text-2xl font-bold">{stats?.totalVisits || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Gift className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">خصومات مُنحت</p>
                  <p className="text-2xl font-bold">{stats?.totalDiscountsGiven || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">عملاء هذا الشهر</p>
                  <p className="text-2xl font-bold">{stats?.customersThisMonth || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">زيارات هذا الشهر</p>
                  <p className="text-2xl font-bold">{stats?.visitsThisMonth || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* باركودات QR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                باركود التسجيل الجديد
              </CardTitle>
              <CardDescription>
                يقوم العميل الجديد بمسح هذا الباركود للتسجيل في برنامج الولاء
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {registerQR && (
                <img src={registerQR} alt="Register QR" className="w-48 h-48 border rounded-lg" />
              )}
              <Button onClick={() => printQR('register')} className="gap-2">
                <Printer className="h-4 w-4" />
                طباعة الباركود
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                باركود تسجيل الزيارة
              </CardTitle>
              <CardDescription>
                يقوم العميل المسجل بمسح هذا الباركود لتسجيل زيارته
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {visitQR && (
                <img src={visitQR} alt="Visit QR" className="w-48 h-48 border rounded-lg" />
              )}
              <Button onClick={() => printQR('visit')} className="gap-2">
                <Printer className="h-4 w-4" />
                طباعة الباركود
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* قائمة العملاء */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>قائمة العملاء</CardTitle>
                <CardDescription>جميع العملاء المسجلين في برنامج الولاء</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو رقم الجوال..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="pr-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>معرف العميل</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>رقم الجوال</TableHead>
                  <TableHead>الفرع</TableHead>
                  <TableHead>إجمالي الزيارات</TableHead>
                  <TableHead>الخصومات المستخدمة</TableHead>
                  <TableHead>تاريخ التسجيل</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customersLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      جاري التحميل...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      لا يوجد عملاء مسجلين
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers?.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-mono">{customer.customerId}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell dir="ltr">{customer.phone}</TableCell>
                      <TableCell>{customer.branchName || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{customer.totalVisits} زيارة</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.totalDiscountsUsed > 0 ? 'default' : 'outline'}>
                          {customer.totalDiscountsUsed} خصم
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(customer.createdAt).toLocaleDateString('ar-SA')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setShowVisitsDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* نافذة عرض الزيارات */}
        <Dialog open={showVisitsDialog} onOpenChange={setShowVisitsDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>زيارات العميل: {selectedCustomer?.name}</DialogTitle>
              <DialogDescription>
                رقم الجوال: {selectedCustomer?.phone}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الزيارة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>نوع الخدمة</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerVisits?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                        لا توجد زيارات
                      </TableCell>
                    </TableRow>
                  ) : (
                    customerVisits?.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell className="font-mono">{visit.visitId}</TableCell>
                        <TableCell>
                          {new Date(visit.visitDate).toLocaleDateString('ar-SA')}
                        </TableCell>
                        <TableCell>{visit.serviceType}</TableCell>
                        <TableCell>{visit.branchName || '-'}</TableCell>
                        <TableCell>
                          {visit.isDiscountVisit ? (
                            <Badge className="bg-green-500">خصم 50%</Badge>
                          ) : (
                            <Badge variant="outline">زيارة {visit.visitNumberInMonth}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
