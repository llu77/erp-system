import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/trpc';
import { QrCode, Users, Gift, Calendar, Search, Eye, Printer, CheckCircle, XCircle, Clock, Image as ImageIcon, BarChart3, Settings, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { useAuth } from '@/_core/hooks/useAuth';

export default function Loyalty() {
  const { user } = useAuth();
  const [searchPhone, setSearchPhone] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showVisitsDialog, setShowVisitsDialog] = useState(false);
  const [registerQR, setRegisterQR] = useState('');
  const [visitQR, setVisitQR] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteVisitId, setDeleteVisitId] = useState<number | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState<string>('');

  const utils = trpc.useUtils();

  // حالة اسم العميل للإيصال
  const [customerNameForReceipt, setCustomerNameForReceipt] = useState<string>('');

  // دالة طباعة إيصال الخصم
  const handlePrintReceipt = async () => {
    const amount = parseFloat(invoiceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const discountAmount = amount * 0.6;
    const finalAmount = amount * 0.4;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-SA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      calendar: 'islamic-umalqura'
    });
    const timeStr = now.toLocaleTimeString('ar-SA', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // حفظ سجل الخصم في قاعدة البيانات
    try {
      await createDiscountRecordMutation.mutateAsync({
        customerName: customerNameForReceipt || undefined,
        originalAmount: amount,
        discountPercentage: 60,
        discountAmount: discountAmount,
        finalAmount: finalAmount,
        isPrinted: true,
      });
    } catch (error) {
      console.error('فشل حفظ سجل الخصم:', error);
    }

    const printWindow = window.open('', '_blank', 'width=420,height=800');
    if (!printWindow) {
      toast.error('تعذر فتح نافذة الطباعة');
      return;
    }

    const customerDisplay = customerNameForReceipt 
      ? `<div class="customer-section">
           <div class="customer-label">العميل الكريم</div>
           <div class="customer-name">${customerNameForReceipt}</div>
         </div>` 
      : '';

    // رقم الإيصال الفريد
    const receiptNumber = `DR-${Date.now().toString(36).toUpperCase()}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>إيصال خصم - Symbol AI</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: 'Tajawal', sans-serif;
            padding: 0;
            background: #fff;
            color: #000;
            max-width: 380px;
            margin: 0 auto;
            font-size: 14px;
            line-height: 1.5;
          }
          
          .receipt-container {
            border: 3px solid #000;
            border-radius: 12px;
            overflow: hidden;
            margin: 10px;
          }
          
          /* الهيدر */
          .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            padding: 20px;
            text-align: center;
          }
          
          .logo-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-bottom: 10px;
          }
          
          .logo-img {
            width: 60px;
            height: 60px;
            border-radius: 12px;
            background: #fff;
            padding: 5px;
          }
          
          .logo-text {
            text-align: right;
          }
          
          .logo-title {
            font-size: 28px;
            font-weight: 800;
            color: #f97316;
            letter-spacing: 1px;
          }
          
          .logo-subtitle {
            font-size: 12px;
            color: #94a3b8;
            margin-top: 2px;
          }
          
          /* عنوان الإيصال */
          .receipt-header {
            background: #f97316;
            color: #fff;
            padding: 12px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .receipt-title {
            font-size: 18px;
            font-weight: 700;
          }
          
          .receipt-number {
            font-size: 11px;
            background: rgba(255,255,255,0.2);
            padding: 4px 10px;
            border-radius: 20px;
          }
          
          /* قسم العميل */
          .customer-section {
            background: #f8fafc;
            padding: 15px 20px;
            border-bottom: 2px dashed #e2e8f0;
          }
          
          .customer-label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 4px;
          }
          
          .customer-name {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
          }
          
          /* قسم الخصم */
          .discount-section {
            padding: 20px;
            text-align: center;
            background: #fef2f2;
            border-bottom: 2px dashed #e2e8f0;
          }
          
          .discount-badge {
            display: inline-block;
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: #fff;
            padding: 10px 30px;
            border-radius: 30px;
            font-size: 24px;
            font-weight: 800;
            box-shadow: 0 4px 15px rgba(220, 38, 38, 0.3);
          }
          
          .discount-text {
            margin-top: 8px;
            font-size: 13px;
            color: #991b1b;
          }
          
          /* قسم المعلومات */
          .info-section {
            padding: 15px 20px;
            background: #fff;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f1f5f9;
          }
          
          .info-row:last-child {
            border-bottom: none;
          }
          
          .info-label {
            color: #64748b;
            font-size: 13px;
          }
          
          .info-value {
            font-weight: 700;
            font-size: 14px;
            color: #000;
          }
          
          /* قسم المبالغ */
          .amount-section {
            padding: 20px;
            background: #f8fafc;
          }
          
          .amount-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
          }
          
          .amount-label {
            font-size: 14px;
            color: #000;
          }
          
          .amount-value {
            font-size: 18px;
            font-weight: 700;
            color: #000;
          }
          
          .amount-row.original .amount-value {
            text-decoration: line-through;
            color: #94a3b8;
          }
          
          .amount-row.discount {
            color: #dc2626;
          }
          
          .amount-row.discount .amount-value {
            color: #dc2626;
          }
          
          .amount-row.final {
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            color: #fff;
            margin: 15px -20px -20px;
            padding: 20px;
            border-radius: 0 0 9px 9px;
          }
          
          .amount-row.final .amount-label {
            font-size: 16px;
            color: #fff;
          }
          
          .amount-row.final .amount-value {
            font-size: 32px;
            font-weight: 800;
            color: #fff;
          }
          
          /* قسم الختم */
          .stamp-section {
            padding: 20px;
            text-align: center;
            background: #fff;
            border-top: 2px dashed #e2e8f0;
          }
          
          .stamp {
            display: inline-block;
            border: 3px solid #16a34a;
            border-radius: 50%;
            padding: 15px 25px;
            color: #16a34a;
            font-size: 18px;
            font-weight: 800;
            transform: rotate(-5deg);
            position: relative;
          }
          
          .stamp::before {
            content: '✓';
            position: absolute;
            top: -8px;
            right: -8px;
            background: #16a34a;
            color: #fff;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
          }
          
          /* الفوتر */
          .footer {
            background: #1a1a2e;
            color: #94a3b8;
            padding: 15px 20px;
            text-align: center;
            font-size: 12px;
          }
          
          .footer-thanks {
            color: #f97316;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 5px;
          }
          
          .footer-contact {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #334155;
            font-size: 11px;
          }
          
          /* طباعة */
          @media print {
            body { 
              padding: 0; 
              margin: 0;
            }
            .receipt-container {
              margin: 0;
              border: 2px solid #000;
            }
            .no-print { display: none; }
          }
          
          /* متجاوب للجوال */
          @media screen and (max-width: 400px) {
            body {
              max-width: 100%;
            }
            .receipt-container {
              margin: 5px;
              border-radius: 8px;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- الهيدر مع الشعار -->
          <div class="header">
            <div class="logo-container">
              <img src="/symbol-ai-logo.png" alt="Symbol AI" class="logo-img" onerror="this.style.display='none'" />
              <div class="logo-text">
                <div class="logo-title">Symbol AI</div>
                <div class="logo-subtitle">نظام إدارة الأعمال الذكي</div>
              </div>
            </div>
          </div>
          
          <!-- عنوان الإيصال -->
          <div class="receipt-header">
            <div class="receipt-title">إيصال خصم برنامج الولاء</div>
            <div class="receipt-number">${receiptNumber}</div>
          </div>
          
          <!-- قسم العميل -->
          ${customerDisplay}
          
          <!-- قسم الخصم -->
          <div class="discount-section">
            <div class="discount-badge">خصم 60%</div>
            <div class="discount-text">خصم خاص لعملاء برنامج الولاء</div>
          </div>
          
          <!-- قسم المعلومات -->
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">التاريخ:</span>
              <span class="info-value">${dateStr}</span>
            </div>
            <div class="info-row">
              <span class="info-label">الوقت:</span>
              <span class="info-value">${timeStr}</span>
            </div>
          </div>
          
          <!-- قسم المبالغ -->
          <div class="amount-section">
            <div class="amount-row original">
              <span class="amount-label">المبلغ الأصلي:</span>
              <span class="amount-value">${amount.toFixed(2)} ر.س</span>
            </div>
            <div class="amount-row discount">
              <span class="amount-label">قيمة الخصم (60%):</span>
              <span class="amount-value">- ${discountAmount.toFixed(2)} ر.س</span>
            </div>
            <div class="amount-row final">
              <span class="amount-label">المبلغ المطلوب:</span>
              <span class="amount-value">${finalAmount.toFixed(2)} ر.س</span>
            </div>
          </div>
          
          <!-- قسم الختم -->
          <div class="stamp-section">
            <div class="stamp">معتمد</div>
          </div>
          
          <!-- الفوتر -->
          <div class="footer">
            <div class="footer-thanks">شكراً لولائكم الكريم</div>
            <div>نتمنى لكم يوماً سعيداً</div>
            <div class="footer-contact">Symbol AI - نظام إدارة الأعمال الذكي</div>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // جلب البيانات
  const { data: stats, isLoading: statsLoading } = trpc.loyalty.stats.useQuery();
  
  // استخدام API جديد يعتمد على فرع المستخدم
  const { data: customers, isLoading: customersLoading } = trpc.loyalty.branchCustomers.useQuery();
  const { data: pendingVisits, isLoading: pendingLoading } = trpc.loyalty.pendingVisits.useQuery();
  const { data: allVisits, isLoading: visitsLoading } = trpc.loyalty.branchVisits.useQuery();
  
  const { data: customerVisits } = trpc.loyalty.customerVisits.useQuery(
    { customerId: selectedCustomer?.id || 0 },
    { enabled: !!selectedCustomer }
  );

  // الموافقة على زيارة
  const approveMutation = trpc.loyalty.approveVisit.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('تمت الموافقة على الزيارة');
        utils.loyalty.pendingVisits.invalidate();
        utils.loyalty.branchVisits.invalidate();
        utils.loyalty.stats.invalidate();
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // رفض زيارة
  const rejectMutation = trpc.loyalty.rejectVisit.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('تم رفض الزيارة');
        setShowRejectDialog(false);
        setRejectionReason('');
        setSelectedVisitId(null);
        utils.loyalty.pendingVisits.invalidate();
        utils.loyalty.branchVisits.invalidate();
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  // إنشاء سجل خصم
  const createDiscountRecordMutation = trpc.loyalty.createDiscountRecord.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ سجل الخصم بنجاح');
    },
    onError: (error) => {
      console.error('فشل حفظ سجل الخصم:', error);
    },
  });

  // طلب حذف زيارة
  const deletionMutation = trpc.loyalty.requestVisitDeletion.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('تم إرسال طلب الحذف بنجاح - بانتظار موافقة الأدمن');
        setShowDeleteDialog(false);
        setDeletionReason('');
        setDeleteVisitId(null);
        utils.loyalty.branchVisits.invalidate();
        utils.loyalty.pendingVisits.invalidate();
      }
    },
    onError: (error) => {
      toast.error(error.message || 'فشل إرسال طلب الحذف');
    },
  });

  // حذف زيارة مباشر (للأدمن فقط)
  const directDeleteMutation = trpc.loyalty.deleteVisit.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('تم حذف الزيارة بنجاح');
        setShowDeleteDialog(false);
        setDeletionReason('');
        setDeleteVisitId(null);
        utils.loyalty.branchVisits.invalidate();
        utils.loyalty.pendingVisits.invalidate();
        utils.loyalty.stats.invalidate();
      }
    },
    onError: (error) => {
      toast.error(error.message || 'فشل حذف الزيارة');
    },
  });

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
                : 'امسح الباركود لتسجيل زيارتك والحصول على خصم 60% في الزيارة الثالثة!'
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

  const handleApprove = (visitId: number) => {
    approveMutation.mutate({ visitId });
  };

  const handleReject = () => {
    if (!selectedVisitId || !rejectionReason.trim()) {
      toast.error('الرجاء إدخال سبب الرفض');
      return;
    }
    rejectMutation.mutate({ visitId: selectedVisitId, reason: rejectionReason });
  };

  const openRejectDialog = (visitId: number) => {
    setSelectedVisitId(visitId);
    setShowRejectDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 ml-1" />معلق</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="h-3 w-3 ml-1" />موافق</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="h-3 w-3 ml-1" />مرفوض</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">برنامج الولاء</h1>
              {user?.role !== 'admin' && user?.branchId && (
                <Badge variant="secondary" className="text-sm">
                  فرعي
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {user?.role === 'admin' ? 'إدارة جميع عملاء برنامج الولاء' : 'إدارة عملاء فرعك - يمكنك قبول أو رفض الزيارات'}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/loyalty/report">
              <Button variant="outline" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                التقارير
              </Button>
            </Link>
            {user?.role === 'admin' && (
              <Link href="/loyalty/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  الإعدادات
                </Button>
              </Link>
            )}
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
                  <p className="text-2xl font-bold">{customers?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">زيارات معلقة</p>
                  <p className="text-2xl font-bold">{pendingVisits?.length || 0}</p>
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
                  <p className="text-2xl font-bold">{allVisits?.length || 0}</p>
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

        {/* حاسبة الخصم */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-5 w-5 text-primary" />
              حاسبة الخصم (60%)
            </CardTitle>
            <CardDescription>
              أدخل مبلغ الفاتورة لحساب المبلغ المطلوب بعد الخصم
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="customerNameReceipt">اسم العميل (اختياري)</Label>
                  <Input
                    id="customerNameReceipt"
                    type="text"
                    placeholder="أدخل اسم العميل..."
                    value={customerNameForReceipt}
                    onChange={(e) => setCustomerNameForReceipt(e.target.value)}
                    className="text-lg"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="invoiceAmount">مبلغ الفاتورة (ر.س)</Label>
                  <Input
                    id="invoiceAmount"
                    type="number"
                    placeholder="أدخل مبلغ الفاتورة..."
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    className="text-lg font-semibold"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-muted-foreground mb-1">المبلغ بعد الخصم (40%)</p>
                <p className="text-3xl font-bold text-green-600">
                  {invoiceAmount && !isNaN(parseFloat(invoiceAmount))
                    ? (parseFloat(invoiceAmount) * 0.4).toFixed(2)
                    : '0.00'}
                  <span className="text-lg mr-1">ر.س</span>
                </p>
                {invoiceAmount && !isNaN(parseFloat(invoiceAmount)) && parseFloat(invoiceAmount) > 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    الخصم: {(parseFloat(invoiceAmount) * 0.6).toFixed(2)} ر.س
                  </p>
                )}
              </div>
              {invoiceAmount && parseFloat(invoiceAmount) > 0 && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handlePrintReceipt()}
                    className="gap-1"
                  >
                    <Printer className="h-4 w-4" />
                    طباعة الإيصال
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setInvoiceAmount(''); setCustomerNameForReceipt(''); }}
                  >
                    مسح
                  </Button>
                </div>
              )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* التبويبات */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              الزيارات المعلقة
              {pendingVisits && pendingVisits.length > 0 && (
                <Badge variant="destructive" className="mr-1">{pendingVisits.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="h-4 w-4" />
              العملاء
            </TabsTrigger>
            <TabsTrigger value="visits" className="gap-2">
              <Calendar className="h-4 w-4" />
              جميع الزيارات
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-2">
              <QrCode className="h-4 w-4" />
              باركود QR
            </TabsTrigger>
          </TabsList>

          {/* الزيارات المعلقة */}
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>الزيارات المعلقة</CardTitle>
                <CardDescription>زيارات تنتظر الموافقة أو الرفض</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العميل</TableHead>
                      <TableHead>رقم الجوال</TableHead>
                      <TableHead>الخدمة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>صورة الفاتورة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : pendingVisits?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          لا توجد زيارات معلقة
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingVisits?.map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell className="font-medium">{visit.customerName}</TableCell>
                          <TableCell dir="ltr">{visit.customerPhone}</TableCell>
                          <TableCell>{visit.serviceType}</TableCell>
                          <TableCell>
                            {new Date(visit.visitDate).toLocaleDateString('ar-SA')}
                          </TableCell>
                          <TableCell>{visit.branchName || '-'}</TableCell>
                          <TableCell>
                            {visit.invoiceImageUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedImageUrl(visit.invoiceImageUrl!);
                                  setShowImageDialog(true);
                                }}
                              >
                                <ImageIcon className="h-4 w-4 ml-1" />
                                عرض
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-50 text-green-700 hover:bg-green-100"
                                onClick={() => handleApprove(visit.id)}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 ml-1" />
                                موافقة
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-50 text-red-700 hover:bg-red-100"
                                onClick={() => openRejectDialog(visit.id)}
                              >
                                <XCircle className="h-4 w-4 ml-1" />
                                رفض
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* العملاء */}
          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>قائمة العملاء</CardTitle>
                    <CardDescription>
                      {user?.role === 'admin' ? 'جميع العملاء المسجلين' : 'عملاء فرعك فقط'}
                    </CardDescription>
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
          </TabsContent>

          {/* جميع الزيارات */}
          <TabsContent value="visits">
            <Card>
              <CardHeader>
                <CardTitle>جميع الزيارات</CardTitle>
                <CardDescription>سجل جميع الزيارات</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>معرف الزيارة</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>الخدمة</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الفرع</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>صورة الفاتورة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          جاري التحميل...
                        </TableCell>
                      </TableRow>
                    ) : allVisits?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          لا توجد زيارات
                        </TableCell>
                      </TableRow>
                    ) : (
                      allVisits?.map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell className="font-mono">{visit.visitId}</TableCell>
                          <TableCell className="font-medium">{visit.customerName}</TableCell>
                          <TableCell>{visit.serviceType}</TableCell>
                          <TableCell>
                            {new Date(visit.visitDate).toLocaleDateString('ar-SA')}
                          </TableCell>
                          <TableCell>{visit.branchName || '-'}</TableCell>
                          <TableCell>{getStatusBadge(visit.status)}</TableCell>
                          <TableCell>
                            {visit.invoiceImageUrl ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedImageUrl(visit.invoiceImageUrl!);
                                  setShowImageDialog(true);
                                }}
                              >
                                <ImageIcon className="h-4 w-4 ml-1" />
                                عرض
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setDeleteVisitId(visit.id);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 ml-1" />
                              طلب حذف
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* باركودات QR */}
          <TabsContent value="qr">
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
          </TabsContent>
        </Tabs>

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
                            <Badge className="bg-green-500">خصم 60%</Badge>
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

        {/* نافذة الرفض */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>رفض الزيارة</DialogTitle>
              <DialogDescription>
                الرجاء إدخال سبب رفض الزيارة
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>سبب الرفض</Label>
                <Textarea
                  placeholder="أدخل سبب الرفض..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                إلغاء
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
              >
                {rejectMutation.isPending ? 'جاري الرفض...' : 'رفض الزيارة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نافذة عرض صورة الفاتورة */}
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>صورة الفاتورة</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img 
                src={selectedImageUrl} 
                alt="صورة الفاتورة" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* نافذة حذف الزيارة */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                {user?.role === 'admin' ? 'حذف زيارة' : 'طلب حذف زيارة'}
              </DialogTitle>
              <DialogDescription>
                {user?.role === 'admin' 
                  ? 'سيتم حذف الزيارة نهائياً. يرجى كتابة سبب الحذف.'
                  : 'سيتم إرسال طلب الحذف للأدمن للموافقة عليه. يرجى كتابة سبب الحذف.'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>سبب الحذف <span className="text-red-500">*</span></Label>
                <Textarea
                  placeholder="أدخل سبب الحذف (على الأقل 5 أحرف)..."
                  value={deletionReason}
                  onChange={(e) => setDeletionReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  مثال: زيارة مكررة بالخطأ، العميل طلب الإلغاء، إلخ.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletionReason('');
                  setDeleteVisitId(null);
                }}
              >
                إلغاء
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (deleteVisitId && deletionReason.trim().length >= 5) {
                    if (user?.role === 'admin') {
                      // الأدمن يحذف مباشرة
                      directDeleteMutation.mutate({
                        visitId: deleteVisitId,
                        reason: deletionReason.trim(),
                      });
                    } else {
                      // المشرف يرسل طلب
                      deletionMutation.mutate({
                        visitId: deleteVisitId,
                        deletionReason: deletionReason.trim(),
                      });
                    }
                  }
                }}
                disabled={(deletionMutation.isPending || directDeleteMutation.isPending) || deletionReason.trim().length < 5}
              >
                {(deletionMutation.isPending || directDeleteMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  user?.role === 'admin' ? 'حذف الزيارة' : 'إرسال طلب الحذف'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
