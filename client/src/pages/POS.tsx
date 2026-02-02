import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { 
  ShoppingCart, 
  User, 
  CreditCard, 
  Banknote, 
  Split, 
  Gift,
  Plus,
  Minus,
  Trash2,
  Printer,
  Search,
  Clock,
  Store,
  Scissors,
  Sparkles,
  Check,
  X,
  BarChart3,
  Settings,
  LogOut,
  Trophy,
  Users,
  ChevronLeft,
  ChevronRight,
  Crown,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Link } from 'wouter';

// Types
interface CartItem {
  serviceId: number;
  serviceName: string;
  serviceNameAr: string;
  price: number;
  quantity: number;
  total: number;
}

interface LoyaltyCustomer {
  id: number;
  name: string;
  phone: string;
}

export default function POS() {
  const { user, logout } = useAuth();
  
  // State
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'split' | 'loyalty'>('cash');
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<LoyaltyCustomer | null>(null);
  const [loyaltySearchQuery, setLoyaltySearchQuery] = useState<string>('');
  const [showLoyaltyDialog, setShowLoyaltyDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{ invoiceNumber: string; total: number } | null>(null);
  const [showEmployeeSidebar, setShowEmployeeSidebar] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  
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
  const { data: employees = [] } = trpc.pos.employees.byBranch.useQuery(
    { branchId: selectedBranchId! },
    { enabled: !!selectedBranchId }
  );
  const { data: categories = [] } = trpc.pos.categories.list.useQuery();
  const { data: services = [] } = trpc.pos.services.list.useQuery();
  const { data: loyaltySearchResults = [] } = trpc.pos.loyaltyCustomers.search.useQuery(
    { query: loyaltySearchQuery },
    { enabled: loyaltySearchQuery.length >= 2 }
  );
  const { data: loyaltyDiscount } = trpc.pos.loyaltyCustomers.checkDiscount.useQuery(
    { customerId: loyaltyCustomer?.id! },
    { enabled: !!loyaltyCustomer }
  );
  
  // Query for employee ranking by revenue
  const { data: employeesRanking = [] } = trpc.pos.employees.rankingByRevenue.useQuery(
    { branchId: selectedBranchId!, year: selectedYear, month: selectedMonth },
    { enabled: !!selectedBranchId }
  );
  
  // Mutations
  const createInvoiceMutation = trpc.pos.invoices.create.useMutation({
    onSuccess: (data) => {
      setLastInvoice({ invoiceNumber: data.invoiceNumber, total: data.total });
      setShowPaymentDialog(false);
      setShowSuccessDialog(true);
      clearCart();
      toast.success('تم إنشاء الفاتورة بنجاح');
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    },
  });
  
  // Computed values
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);
  
  const total = useMemo(() => {
    return subtotal - discountAmount;
  }, [subtotal, discountAmount]);
  
  const filteredServices = useMemo(() => {
    if (!selectedCategoryId) return services;
    return services.filter(s => s.categoryId === selectedCategoryId);
  }, [services, selectedCategoryId]);
  
  // Effects
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setCashAmount(total);
      setCardAmount(0);
    } else if (paymentMethod === 'card') {
      setCashAmount(0);
      setCardAmount(total);
    } else if (paymentMethod === 'split') {
      // Keep current values for split
    } else if (paymentMethod === 'loyalty') {
      setCashAmount(0);
      setCardAmount(0);
    }
  }, [paymentMethod, total]);
  
  // Auto-apply loyalty discount
  useEffect(() => {
    if (loyaltyDiscount?.eligible && paymentMethod === 'loyalty') {
      const discount = subtotal * 0.4; // 40% discount
      setDiscountAmount(discount);
      setDiscountReason('خصم برنامج الولاء (40%)');
    }
  }, [loyaltyDiscount, paymentMethod, subtotal]);
  
  // Functions
  const addToCart = (service: typeof services[0]) => {
    const existingItem = cart.find(item => item.serviceId === service.id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item.serviceId === service.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        serviceId: service.id,
        serviceName: service.name,
        serviceNameAr: service.nameAr,
        price: Number(service.price),
        quantity: 1,
        total: Number(service.price),
      }]);
    }
    toast.success(`تمت إضافة ${service.nameAr}`);
  };
  
  const updateQuantity = (serviceId: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.serviceId === serviceId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity, total: newQuantity * item.price };
      }
      return item;
    }));
  };
  
  const removeFromCart = (serviceId: number) => {
    setCart(cart.filter(item => item.serviceId !== serviceId));
  };
  
  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountReason('');
    setNotes('');
    setLoyaltyCustomer(null);
    setPaymentMethod('cash');
    setCashAmount(0);
    setCardAmount(0);
  };
  
  const selectLoyaltyCustomer = (customer: LoyaltyCustomer) => {
    setLoyaltyCustomer(customer);
    setShowLoyaltyDialog(false);
    setLoyaltySearchQuery('');
  };
  
  const handleCheckout = () => {
    if (!selectedBranchId) {
      toast.error('يرجى اختيار الفرع');
      return;
    }
    if (!selectedEmployeeId) {
      toast.error('يرجى اختيار الموظف');
      return;
    }
    if (cart.length === 0) {
      toast.error('السلة فارغة');
      return;
    }
    
    setShowPaymentDialog(true);
  };
  
  const handlePayment = () => {
    if (paymentMethod === 'split' && (cashAmount + cardAmount) !== total) {
      toast.error('مجموع الكاش والشبكة يجب أن يساوي الإجمالي');
      return;
    }
    
    if (paymentMethod === 'loyalty' && !loyaltyCustomer) {
      toast.error('يرجى اختيار عميل الولاء');
      return;
    }
    
    createInvoiceMutation.mutate({
      branchId: selectedBranchId!,
      employeeId: selectedEmployeeId!,
      loyaltyCustomerId: loyaltyCustomer?.id,
      items: cart.map(item => ({
        serviceId: item.serviceId,
        quantity: item.quantity,
      })),
      paymentMethod,
      cashAmount: paymentMethod === 'cash' ? total : cashAmount,
      cardAmount: paymentMethod === 'card' ? total : cardAmount,
      discountAmount,
      discountReason: discountReason || undefined,
      notes: notes || undefined,
    });
  };
  
  const handlePrint = () => {
    if (!lastInvoice) return;
    
    const branchName = branches.find(b => b.id === selectedBranchId)?.nameAr || 'غير محدد';
    const branchPhone = '0500000000'; // سيتم إضافة رقم الهاتف للفروع لاحقاً
    const employeeName = employees.find(e => e.id === selectedEmployeeId)?.name || 'غير محدد';
    
    // تنسيق التاريخ بالميلادي
    const dateStr = currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // إنشاء بيانات QR Code للتحقق
    const qrData = JSON.stringify({
      inv: lastInvoice.invoiceNumber,
      total: lastInvoice.total,
      date: dateStr,
      branch: branchName
    });
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}`;
    
    // تصميم فاتورة حرارية متوافقة مع طابعات 80mm (أبيض وأسود) - محسنة
    const receiptHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة - ${lastInvoice.invoiceNumber}</title>
        <style>
          /* إعدادات الطباعة الحرارية 80mm */
          @page {
            size: 80mm auto;
            margin: 0;
          }
          @media print {
            html, body {
              width: 80mm;
              margin: 0;
              padding: 0;
            }
            .no-print { display: none !important; }
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Courier New', 'Lucida Console', monospace;
            width: 80mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 2mm;
            font-size: 11px;
            line-height: 1.4;
            direction: rtl;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .receipt {
            width: 100%;
          }
          /* الشعار والهيدر */
          .header {
            text-align: center;
            padding-bottom: 6px;
            border-bottom: 2px double #000;
            margin-bottom: 6px;
          }
          .logo {
            width: 50px;
            height: 50px;
            margin: 0 auto 4px;
            border: 2px solid #000;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: bold;
          }
          .header h1 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 2px;
            letter-spacing: 2px;
          }
          .header .branch {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .header .phone {
            font-size: 11px;
            margin-bottom: 4px;
          }
          .header .invoice-num {
            font-size: 11px;
            font-weight: bold;
            background: #000;
            color: #fff;
            padding: 3px 10px;
            display: inline-block;
            margin-top: 4px;
            letter-spacing: 1px;
          }
          /* قسم المعلومات */
          .info-section {
            padding: 6px 0;
            border-bottom: 1px dashed #000;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 11px;
          }
          .info-row span:first-child {
            font-weight: bold;
          }
          /* قسم الخدمات */
          .items-section {
            padding: 6px 0;
            border-bottom: 1px dashed #000;
          }
          .items-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 11px;
            padding-bottom: 4px;
            border-bottom: 1px solid #000;
            margin-bottom: 4px;
            background: #f0f0f0;
            padding: 4px 2px;
          }
          .item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 5px 0;
            font-size: 11px;
            padding: 2px 0;
            border-bottom: 1px dotted #ccc;
          }
          .item:last-child {
            border-bottom: none;
          }
          .item-name {
            flex: 1;
            text-align: right;
            font-weight: 500;
          }
          .item-qty {
            width: 30px;
            text-align: center;
            font-weight: bold;
          }
          .item-price {
            width: 55px;
            text-align: left;
            font-weight: bold;
          }
          /* قسم المجاميع */
          .totals-section {
            padding: 8px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            font-size: 11px;
          }
          .total-row.discount {
            color: #000;
          }
          .total-row.grand-total {
            font-size: 16px;
            font-weight: bold;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 8px 0;
            margin-top: 6px;
            background: #f5f5f5;
          }
          /* طريقة الدفع */
          .payment-method {
            text-align: center;
            margin: 8px 0;
            padding: 6px;
            border: 2px solid #000;
            font-size: 12px;
            font-weight: bold;
            background: #f9f9f9;
          }
          /* عميل الولاء */
          .loyalty-section {
            text-align: center;
            margin: 6px 0;
            padding: 4px;
            border: 1px dashed #000;
            font-size: 10px;
            background: #fffef0;
          }
          /* QR Code */
          .qr-section {
            text-align: center;
            padding: 8px 0;
            border-top: 1px dashed #000;
            margin-top: 6px;
          }
          .qr-section img {
            width: 70px;
            height: 70px;
            margin: 4px auto;
          }
          .qr-section p {
            font-size: 8px;
            color: #666;
          }
          /* الفوتر */
          .footer {
            text-align: center;
            padding-top: 8px;
            border-top: 2px double #000;
            font-size: 10px;
          }
          .footer .thanks {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 4px;
          }
          .footer .welcome {
            font-size: 11px;
            margin: 4px 0;
            font-style: italic;
          }
          .footer .brand {
            font-size: 9px;
            margin-top: 6px;
            padding-top: 4px;
            border-top: 1px dashed #000;
          }
          /* أزرار التحكم */
          .print-controls {
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            z-index: 1000;
          }
          .print-btn {
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }
          .print-btn.primary {
            background: #000;
            color: #fff;
          }
          .print-btn.secondary {
            background: #f0f0f0;
            color: #000;
            border: 1px solid #000;
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Header مع الشعار -->
          <div class="header">
            <div class="logo">✂</div>
            <h1>Symbol AI</h1>
            <div class="branch">${branchName}</div>
            <div class="phone">هاتف: ${branchPhone}</div>
            <div class="invoice-num">${lastInvoice.invoiceNumber}</div>
          </div>
          
          <!-- معلومات الفاتورة -->
          <div class="info-section">
            <div class="info-row">
              <span>التاريخ:</span>
              <span>${dateStr}</span>
            </div>
            <div class="info-row">
              <span>الوقت:</span>
              <span>${timeStr}</span>
            </div>
            <div class="info-row">
              <span>الموظف:</span>
              <span>${employeeName}</span>
            </div>
          </div>
          
          <!-- الخدمات -->
          <div class="items-section">
            <div class="items-header">
              <span style="flex:1;text-align:right;">الخدمة</span>
              <span style="width:30px;text-align:center;">الكمية</span>
              <span style="width:55px;text-align:left;">السعر</span>
            </div>
            ${cart.map(item => `
              <div class="item">
                <span class="item-name">${item.serviceNameAr}</span>
                <span class="item-qty">${item.quantity}</span>
                <span class="item-price">${item.total.toFixed(0)} ر.س</span>
              </div>
            `).join('')}
          </div>
          
          <!-- المجاميع -->
          <div class="totals-section">
            <div class="total-row">
              <span>المجموع الفرعي:</span>
              <span>${subtotal.toFixed(2)} ر.س</span>
            </div>
            ${discountAmount > 0 ? `
              <div class="total-row discount">
                <span>الخصم${loyaltyCustomer ? ' (ولاء)' : ''}:</span>
                <span>- ${discountAmount.toFixed(2)} ر.س</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>الإجمالي:</span>
              <span>${lastInvoice.total.toFixed(2)} ر.س</span>
            </div>
          </div>
          
          <!-- طريقة الدفع -->
          <div class="payment-method">
            طريقة الدفع: ${paymentMethod === 'cash' ? 'نقدي (كاش)' : paymentMethod === 'card' ? 'شبكة (Card)' : paymentMethod === 'split' ? 'تقسيم' : 'برنامج الولاء'}
          </div>
          
          ${loyaltyCustomer ? `
            <div class="loyalty-section">
              <strong>عميل الولاء:</strong> ${loyaltyCustomer.name}<br/>
              <span>هاتف: ${loyaltyCustomer.phone}</span>
            </div>
          ` : ''}
          
          <!-- QR Code للتحقق -->
          <div class="qr-section">
            <img src="${qrCodeUrl}" alt="QR Code" />
            <p>امسح للتحقق من الفاتورة</p>
          </div>
          
          <!-- الفوتر مع الجملة الترحيبية -->
          <div class="footer">
            <p class="thanks">شكراً لزيارتكم ❤</p>
            <p class="welcome">نتشرف بخدمتكم دائماً</p>
            <p class="welcome">نتمنى لكم يوماً سعيداً</p>
            <p class="brand">Symbol AI - نظام نقاط البيع الذكي</p>
          </div>
        </div>
        
        <!-- أزرار التحكم -->
        <div class="print-controls no-print">
          <button class="print-btn primary" onclick="window.print();">🖨️ طباعة</button>
          <button class="print-btn secondary" onclick="window.close();">✕ إغلاق</button>
        </div>
        
        <script>
          // الطباعة التلقائية بعد تحميل الصفحة
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
          
          // إغلاق النافذة بعد الطباعة
          window.onafterprint = function() {
            setTimeout(function() {
              window.close();
            }, 100);
          };
        </script>
      </body>
      </html>
    `;
    
    // فتح نافذة الطباعة
    const printWindow = window.open('', '_blank', 'width=320,height=700,scrollbars=yes');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      toast.success('تم فتح نافذة الطباعة');
    } else {
      toast.error('فشل فتح نافذة الطباعة - تأكد من السماح بالنوافذ المنبثقة');
    }
  };
  
  // Current time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const getCategoryIcon = (categoryName: string) => {
    if (categoryName.includes('حلاقة') || categoryName.includes('Haircut')) return <Scissors className="h-6 w-6" />;
    if (categoryName.includes('خدمات') || categoryName.includes('Services')) return <Sparkles className="h-6 w-6" />;
    return <Store className="h-6 w-6" />;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === 'F3') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowLoyaltyDialog(true);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedBranchId, selectedEmployeeId]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" dir="rtl">
      {/* Header - Full Width with Logo */}
      <header className="h-20 bg-gradient-to-l from-primary/10 via-background to-background border-b flex items-center justify-between px-6 shrink-0">
        {/* Logo & Title with Welcome Message */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Symbol AI" 
              className="w-10 h-10 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">بوابة الكاشير</h1>
            <p className="text-sm text-muted-foreground">Symbol AI - نظام نقاط البيع</p>
          </div>
          
          {/* Welcome Message for Supervisor */}
          {user && (
            <div className="mr-6 pr-6 border-r flex items-center gap-3">
              {(user as any).photoUrl ? (
                <img 
                  src={(user as any).photoUrl} 
                  alt={user.name || ''}
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/30 shadow-md"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center border-2 border-primary/30">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <p className="text-lg font-bold text-primary">
                  هلا {user.name?.split(' ')[0] || 'بك'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {branches.find(b => b.id === selectedBranchId)?.nameAr || 'مرحباً بك'}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Clock - Large & Prominent */}
        <div className="flex items-center gap-3 bg-card px-6 py-3 rounded-xl border shadow-sm">
          <Clock className="h-8 w-8 text-primary" />
          <div className="text-right">
            <div className="text-3xl font-bold font-mono tracking-wider">
              {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
        
        {/* Branch & Employee Selection */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-xl border">
            <Store className="h-5 w-5 text-primary" />
            {isAdmin ? (
              <Select value={selectedBranchId?.toString() || ''} onValueChange={(v) => setSelectedBranchId(Number(v))}>
                <SelectTrigger className="w-[160px] border-0 bg-transparent h-10 text-base">
                  <SelectValue placeholder="اختر الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id.toString()} className="text-base">
                      {branch.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-base font-medium px-2">
                {branches.find(b => b.id === selectedBranchId)?.nameAr || 'الفرع'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-xl border">
            {/* صورة الموظف المحدد */}
            {selectedEmployeeId && employees.find(e => e.id === selectedEmployeeId)?.photoUrl ? (
              <img 
                src={employees.find(e => e.id === selectedEmployeeId)?.photoUrl || ''}
                alt={employees.find(e => e.id === selectedEmployeeId)?.name || ''}
                className="w-10 h-10 rounded-full object-cover border-2 border-primary/30 shadow-sm"
              />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
            <Select 
              value={selectedEmployeeId?.toString() || ''} 
              onValueChange={(v) => setSelectedEmployeeId(Number(v))}
              disabled={!selectedBranchId}
            >
              <SelectTrigger className="w-[160px] border-0 bg-transparent h-10 text-base">
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id.toString()} className="text-base">
                    <div className="flex items-center gap-2">
                      {emp.photoUrl ? (
                        <img src={emp.photoUrl} alt={emp.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-3 w-3" />
                        </div>
                      )}
                      {emp.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <Link href="/pos/daily-report">
            <Button variant="outline" size="lg" className="gap-2 h-12">
              <BarChart3 className="h-5 w-5" />
              تقرير اليوم
            </Button>
          </Link>
          <Link href="/pos/settings">
            <Button variant="outline" size="icon" className="h-12 w-12">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-12 w-12 text-muted-foreground" onClick={() => logout()}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Categories & Services */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Categories - Horizontal Scrollable */}
          <div className="h-24 bg-card border-b px-4 py-3 shrink-0">
            <ScrollArea className="h-full">
              <div className="flex gap-3 h-full">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className={`h-full px-6 rounded-xl flex flex-col items-center justify-center gap-1 transition-all min-w-[120px] ${
                    selectedCategoryId === null 
                      ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <Store className="h-7 w-7" />
                  <span className="text-sm font-medium">الكل</span>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`h-full px-6 rounded-xl flex flex-col items-center justify-center gap-1 transition-all min-w-[120px] ${
                      selectedCategoryId === cat.id 
                        ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    {getCategoryIcon(cat.nameAr)}
                    <span className="text-sm font-medium">{cat.nameAr}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          {/* Services Grid */}
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredServices.map(service => (
                <button
                  key={service.id}
                  onClick={() => addToCart(service)}
                  className="group bg-card hover:bg-primary/5 border-2 border-transparent hover:border-primary rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-95 min-h-[140px] flex flex-col items-center justify-center text-center"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    {getCategoryIcon(service.categoryName || '')}
                  </div>
                  <div className="font-bold text-lg mb-1 line-clamp-2">{service.nameAr}</div>
                  <div className="text-2xl font-bold text-primary">
                    {Number(service.price).toFixed(0)} <span className="text-base">ر.س</span>
                  </div>
                </button>
              ))}
            </div>
            
            {filteredServices.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Store className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-xl">لا توجد خدمات في هذا القسم</p>
                <Link href="/pos/settings">
                  <Button variant="link" className="mt-2">
                    إضافة خدمات جديدة
                  </Button>
                </Link>
              </div>
            )}
          </ScrollArea>
          
          {/* Keyboard Shortcuts Bar */}
          <div className="h-12 bg-muted/50 border-t px-4 flex items-center gap-6 text-sm text-muted-foreground shrink-0">
            <span><kbd className="px-2 py-1 bg-background rounded border text-xs">F2</kbd> الدفع</span>
            <span><kbd className="px-2 py-1 bg-background rounded border text-xs">F3</kbd> مسح السلة</span>
            <span><kbd className="px-2 py-1 bg-background rounded border text-xs">F4</kbd> عميل ولاء</span>
          </div>
        </div>
        
        {/* Employee Ranking Sidebar */}
        {showEmployeeSidebar && selectedBranchId && (
          <div className="w-[280px] bg-card border-r flex flex-col shrink-0">
            {/* Sidebar Header */}
            <div className="h-16 px-4 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center">
                  <Trophy className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">ترتيب الموظفين</h3>
                  <p className="text-xs text-muted-foreground">حسب الإيرادات</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setShowEmployeeSidebar(false)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Month Selector */}
            <div className="px-3 py-2 border-b bg-muted/30">
              <div className="flex items-center gap-2">
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 1, label: 'يناير' },
                      { value: 2, label: 'فبراير' },
                      { value: 3, label: 'مارس' },
                      { value: 4, label: 'أبريل' },
                      { value: 5, label: 'مايو' },
                      { value: 6, label: 'يونيو' },
                      { value: 7, label: 'يوليو' },
                      { value: 8, label: 'أغسطس' },
                      { value: 9, label: 'سبتمبر' },
                      { value: 10, label: 'أكتوبر' },
                      { value: 11, label: 'نوفمبر' },
                      { value: 12, label: 'ديسمبر' },
                    ].map(m => (
                      <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-8 text-xs w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Employee List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {employeesRanking.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">لا توجد بيانات</p>
                  </div>
                ) : (
                  employeesRanking.map((emp, index) => (
                    <div 
                      key={emp.employeeId}
                      className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${
                        index === 0 ? 'bg-amber-500/10 border border-amber-500/30' :
                        index === 1 ? 'bg-slate-400/10 border border-slate-400/30' :
                        index === 2 ? 'bg-orange-600/10 border border-orange-600/30' :
                        'bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      {/* Rank Badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        index === 0 ? 'bg-amber-500 text-white' :
                        index === 1 ? 'bg-slate-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index === 0 ? <Crown className="h-4 w-4" /> :
                         index === 1 ? <Medal className="h-4 w-4" /> :
                         index === 2 ? <Award className="h-4 w-4" /> :
                         <span className="text-xs font-bold">{emp.rank}</span>}
                      </div>
                      
                      {/* Employee Photo */}
                      {emp.photoUrl ? (
                        <img 
                          src={emp.photoUrl} 
                          alt={emp.employeeName}
                          className="w-8 h-8 rounded-full object-cover border-2 border-background"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      
                      {/* Employee Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{emp.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{emp.invoiceCount} فاتورة</p>
                      </div>
                      
                      {/* Revenue */}
                      <div className="text-left">
                        <p className={`font-bold text-sm ${
                          index === 0 ? 'text-amber-500' :
                          index === 1 ? 'text-slate-500' :
                          index === 2 ? 'text-orange-600' :
                          'text-foreground'
                        }`}>
                          {emp.totalRevenue.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1">
                          <p className="text-[10px] text-muted-foreground">ر.س</p>
                          {emp.changePercentage !== undefined && emp.changePercentage !== 0 && (
                            <span className={`text-[10px] font-medium flex items-center ${
                              emp.changePercentage > 0 ? 'text-emerald-500' : 'text-red-500'
                            }`}>
                              {emp.changePercentage > 0 ? (
                                <TrendingUp className="h-2.5 w-2.5 ml-0.5" />
                              ) : (
                                <TrendingDown className="h-2.5 w-2.5 ml-0.5" />
                              )}
                              {Math.abs(emp.changePercentage)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Toggle Sidebar Button (when hidden) */}
        {!showEmployeeSidebar && selectedBranchId && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-20 w-6 rounded-r-lg bg-card border border-l-0 hover:bg-muted z-10"
            onClick={() => setShowEmployeeSidebar(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        
        {/* Right Panel - Cart */}
        <div className="w-[420px] bg-card border-r flex flex-col shrink-0">
          {/* Cart Header */}
          <div className="h-16 px-4 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg">السلة</h2>
                <p className="text-sm text-muted-foreground">{cart.length} عنصر</p>
              </div>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 ml-1" />
                مسح
              </Button>
            )}
          </div>
          
          {/* Cart Items */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {cart.map(item => (
                <Card key={item.serviceId} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-base">{item.serviceNameAr}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeFromCart(item.serviceId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-9 w-9"
                          onClick={() => updateQuantity(item.serviceId, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-9 w-9"
                          onClick={() => updateQuantity(item.serviceId, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-left">
                        <div className="text-xs text-muted-foreground">{item.price.toFixed(0)} × {item.quantity}</div>
                        <div className="font-bold text-lg text-primary">{item.total.toFixed(2)} ر.س</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ShoppingCart className="h-16 w-16 mb-4 opacity-30" />
                  <p className="text-lg">السلة فارغة</p>
                  <p className="text-sm">اضغط على الخدمات لإضافتها</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Loyalty Customer */}
          {loyaltyCustomer && (
            <div className="px-4 py-3 border-t bg-green-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Gift className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <div className="font-semibold">{loyaltyCustomer.name}</div>
                    <div className="text-sm text-muted-foreground">{loyaltyCustomer.phone}</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setLoyaltyCustomer(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {loyaltyDiscount && (
                <div className={`mt-2 text-sm font-medium ${loyaltyDiscount.eligible ? 'text-green-600' : 'text-yellow-600'}`}>
                  {loyaltyDiscount.message}
                </div>
              )}
            </div>
          )}
          
          {/* Cart Summary & Payment */}
          <div className="border-t bg-muted/30 p-4 space-y-3 shrink-0">
            <div className="flex justify-between text-base">
              <span>المجموع الفرعي</span>
              <span className="font-semibold">{subtotal.toFixed(2)} ر.س</span>
            </div>
            
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>الخصم</span>
                <span className="font-semibold">- {discountAmount.toFixed(2)} ر.س</span>
              </div>
            )}
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold">الإجمالي</span>
              <span className="text-3xl font-bold text-primary">{total.toFixed(2)} ر.س</span>
            </div>
            
            {/* Loyalty Button */}
            <Button 
              variant="outline" 
              className="w-full h-12 gap-2 text-base"
              onClick={() => setShowLoyaltyDialog(true)}
            >
              <Gift className="h-5 w-5" />
              {loyaltyCustomer ? 'تغيير عميل الولاء' : 'إضافة عميل ولاء'}
            </Button>
            
            {/* Checkout Button */}
            <Button 
              className="w-full h-16 text-xl gap-3 shadow-lg"
              disabled={cart.length === 0 || !selectedBranchId || !selectedEmployeeId}
              onClick={handleCheckout}
            >
              <CreditCard className="h-6 w-6" />
              الدفع
            </Button>
          </div>
        </div>
      </div>
      
      {/* Loyalty Search Dialog */}
      <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Gift className="h-6 w-6 text-primary" />
              البحث عن عميل ولاء
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو رقم الجوال..."
                value={loyaltySearchQuery}
                onChange={(e) => setLoyaltySearchQuery(e.target.value)}
                className="pr-12 h-12 text-lg"
                autoFocus
              />
            </div>
            
            <ScrollArea className="h-[350px]">
              <div className="space-y-2">
                {loyaltySearchResults.map(customer => (
                  <Card 
                    key={customer.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => selectLoyaltyCustomer(customer)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">{customer.name}</div>
                          <div className="text-muted-foreground">{customer.phone}</div>
                        </div>
                      </div>
                      <Check className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100" />
                    </CardContent>
                  </Card>
                ))}
                
                {loyaltySearchQuery.length >= 2 && loyaltySearchResults.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg">لا توجد نتائج</p>
                  </div>
                )}
                
                {loyaltySearchQuery.length < 2 && (
                  <div className="text-center text-muted-foreground py-12">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg">أدخل حرفين على الأقل للبحث</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <CreditCard className="h-6 w-6 text-primary" />
              إتمام الدفع
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Payment Method - Large Buttons */}
            <div className="space-y-3">
              <Label className="text-base">طريقة الدفع</Label>
              <div className="grid grid-cols-4 gap-3">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  className="h-20 flex-col gap-2"
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Banknote className="h-8 w-8" />
                  <span className="text-base">كاش</span>
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  className="h-20 flex-col gap-2"
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard className="h-8 w-8" />
                  <span className="text-base">شبكة</span>
                </Button>
                <Button
                  variant={paymentMethod === 'split' ? 'default' : 'outline'}
                  className="h-20 flex-col gap-2"
                  onClick={() => setPaymentMethod('split')}
                >
                  <Split className="h-8 w-8" />
                  <span className="text-base">تقسيم</span>
                </Button>
                <Button
                  variant={paymentMethod === 'loyalty' ? 'default' : 'outline'}
                  className="h-20 flex-col gap-2"
                  onClick={() => setPaymentMethod('loyalty')}
                  disabled={!loyaltyCustomer}
                >
                  <Gift className="h-8 w-8" />
                  <span className="text-base">ولاء</span>
                </Button>
              </div>
            </div>
            
            {/* Split Payment Amounts */}
            {paymentMethod === 'split' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base">مبلغ الكاش</Label>
                  <Input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(Number(e.target.value))}
                    min={0}
                    max={total}
                    className="h-12 text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">مبلغ الشبكة</Label>
                  <Input
                    type="number"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(Number(e.target.value))}
                    min={0}
                    max={total}
                    className="h-12 text-lg"
                  />
                </div>
                {(cashAmount + cardAmount) !== total && (
                  <div className="col-span-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
                    المجموع ({(cashAmount + cardAmount).toFixed(2)}) يجب أن يساوي الإجمالي ({total.toFixed(2)})
                  </div>
                )}
              </div>
            )}
            
            {/* Discount */}
            <div className="space-y-2">
              <Label className="text-base">الخصم (اختياري)</Label>
              <div className="flex gap-3">
                <Input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  min={0}
                  max={subtotal}
                  placeholder="0.00"
                  className="flex-1 h-12 text-lg"
                />
                <Input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="سبب الخصم"
                  className="flex-1 h-12"
                />
              </div>
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-base">ملاحظات (اختياري)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية..."
                className="h-12"
              />
            </div>
            
            {/* Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-base">
                  <span>المجموع الفرعي</span>
                  <span className="font-semibold">{subtotal.toFixed(2)} ر.س</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>الخصم</span>
                    <span className="font-semibold">- {discountAmount.toFixed(2)} ر.س</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xl font-bold">الإجمالي</span>
                  <span className="text-3xl font-bold text-primary">{total.toFixed(2)} ر.س</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="h-12 px-6">
              إلغاء
            </Button>
            <Button 
              onClick={handlePayment}
              disabled={createInvoiceMutation.isPending}
              className="h-12 px-8 text-lg gap-2"
            >
              {createInvoiceMutation.isPending ? (
                <>جاري المعالجة...</>
              ) : (
                <>
                  <Check className="h-5 w-5" />
                  تأكيد الدفع
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md text-center">
          <div className="py-8">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Check className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-3">تم بنجاح!</h2>
            <p className="text-muted-foreground text-lg mb-4">
              تم إنشاء الفاتورة رقم
            </p>
            <Badge variant="outline" className="text-xl px-6 py-2 font-mono">
              {lastInvoice?.invoiceNumber}
            </Badge>
            <p className="text-4xl font-bold text-primary mt-6">
              {lastInvoice?.total.toFixed(2)} ر.س
            </p>
          </div>
          
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button onClick={handlePrint} className="w-full h-14 text-lg gap-2">
              <Printer className="h-5 w-5" />
              طباعة الفاتورة
            </Button>
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)} className="w-full h-12">
              فاتورة جديدة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
