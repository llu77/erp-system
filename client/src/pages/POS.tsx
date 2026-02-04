import { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
  Package,
  Heart,
  Gem,
  Palette,
  Wind,
  Flower2,
  Hand,
} from 'lucide-react';
import { Link } from 'wouter';
import usePOSKeyboard from '@/hooks/usePOSKeyboard';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';
import { Keyboard } from 'lucide-react';

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
  // معلومات الخصم (اختياري)
  totalApprovedVisits?: number;
  isEligibleForDiscount?: boolean;
  discountPercentage?: number;
  visitsInCycle?: number;
  nextDiscountAt?: number;
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
  const [paidBy, setPaidBy] = useState<string>(''); // خانة مدفوع - اسم العميل
  
  // قائمة العملاء للفواتير المدفوعة
  const PAID_INVOICE_CUSTOMERS = [
    { id: 'omar', name: 'عمر المطيري' },
    { id: 'salem', name: 'سالم الوادعي' },
    { id: 'saud', name: 'سعود الجريسي' },
  ];
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<LoyaltyCustomer | null>(null);
  const [loyaltySearchQuery, setLoyaltySearchQuery] = useState<string>('');
  const [showLoyaltyDialog, setShowLoyaltyDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{ invoiceNumber: string; total: number } | null>(null);
  const [lastCartItems, setLastCartItems] = useState<CartItem[]>([]);
  const [lastSubtotal, setLastSubtotal] = useState<number>(0);
  const [lastDiscountAmount, setLastDiscountAmount] = useState<number>(0);
  const [lastPaymentMethod, setLastPaymentMethod] = useState<'cash' | 'card' | 'split' | 'loyalty'>('cash');
  const [lastCashAmount, setLastCashAmount] = useState<number>(0);
  const [lastCardAmount, setLastCardAmount] = useState<number>(0);
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
  // جلب معلومات الخصم للعميل المختار (بناءً على الزيارات الموافق عليها)
  const { data: loyaltyDiscount } = trpc.pos.loyaltyCustomers.getApprovedVisits.useQuery(
    { customerId: loyaltyCustomer?.id! },
    { enabled: !!loyaltyCustomer }
  );

  // جلب عملاء الولاء المؤهلين للخصم (للقائمة المنسدلة)
  const { data: eligibleCustomers = [] } = trpc.pos.loyaltyCustomers.getEligibleForDiscount.useQuery(
    { branchId: selectedBranchId || undefined },
    { enabled: !!selectedBranchId }
  );
  
  // Query for employee ranking by revenue
  const { data: employeesRanking = [] } = trpc.pos.employees.rankingByRevenue.useQuery(
    { branchId: selectedBranchId!, year: selectedYear, month: selectedMonth },
    { enabled: !!selectedBranchId }
  );
  
  // Mutations
  const createInvoiceMutation = trpc.pos.invoices.create.useMutation({
    onSuccess: (data) => {
      // حفظ بيانات السلة وطريقة الدفع قبل مسحها للطباعة
      setLastCartItems([...cart]);
      setLastSubtotal(subtotal);
      setLastDiscountAmount(discountAmount);
      setLastPaymentMethod(paymentMethod);
      setLastCashAmount(paymentMethod === 'cash' ? total : cashAmount);
      setLastCardAmount(paymentMethod === 'card' ? total : cardAmount);
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
  
  // Auto-apply loyalty discount (60% للزيارة الثالثة الموافق عليها)
  useEffect(() => {
    if (loyaltyDiscount?.isEligibleForDiscount && paymentMethod === 'loyalty') {
      const discountPercent = loyaltyDiscount.discountPercentage || 60;
      const discount = subtotal * (discountPercent / 100);
      setDiscountAmount(discount);
      setDiscountReason(`خصم برنامج الولاء (${discountPercent}%) - الزيارة ${loyaltyDiscount.totalApproved}`);
    } else if (paymentMethod === 'loyalty' && loyaltyCustomer && !loyaltyDiscount?.isEligibleForDiscount) {
      // إذا كان العميل غير مؤهل للخصم، لا يطبق خصم
      setDiscountAmount(0);
      setDiscountReason('');
    }
  }, [loyaltyDiscount, paymentMethod, subtotal, loyaltyCustomer]);
  
  // Functions - Optimized with useCallback
  const addToCart = useCallback((service: typeof services[0]) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.serviceId === service.id);
      
      if (existingItem) {
        return prevCart.map(item => 
          item.serviceId === service.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      } else {
        return [...prevCart, {
          serviceId: service.id,
          serviceName: service.name,
          serviceNameAr: service.nameAr,
          price: Number(service.price),
          quantity: 1,
          total: Number(service.price),
        }];
      }
    });
    toast.success(`تمت إضافة ${service.nameAr}`);
  }, []);
  
  const updateQuantity = useCallback((serviceId: number, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.serviceId === serviceId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity, total: newQuantity * item.price };
      }
      return item;
    }));
  }, []);
  
  const removeFromCart = useCallback((serviceId: number) => {
    setCart(prevCart => prevCart.filter(item => item.serviceId !== serviceId));
  }, []);
  
  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountReason('');
    setNotes('');
    setLoyaltyCustomer(null);
    setPaymentMethod('cash');
    setCashAmount(0);
    setCardAmount(0);
  }, []);
  
  // Keyboard Shortcuts
  const { shortcuts } = usePOSKeyboard({
    onPaymentCash: () => {
      setPaymentMethod('cash');
      toast.info('تم اختيار الدفع نقداً');
    },
    onPaymentCard: () => {
      setPaymentMethod('card');
      toast.info('تم اختيار الدفع بالبطاقة');
    },
    onPaymentMixed: () => {
      setPaymentMethod('split');
      toast.info('تم اختيار الدفع المختلط');
    },
    onConfirm: () => {
      if (showPaymentDialog) {
        handlePayment();
      } else if (cart.length > 0) {
        handleCheckout();
      }
    },
    onCancel: () => {
      if (showPaymentDialog) setShowPaymentDialog(false);
      else if (showSuccessDialog) setShowSuccessDialog(false);
      else if (showLoyaltyDialog) setShowLoyaltyDialog(false);
    },
    onNewInvoice: () => {
      clearCart();
      toast.info('تم تجهيز فاتورة جديدة');
    },
    onPrint: () => {
      if (lastInvoice) handlePrint();
    },
    enabled: true,
  });
  
  const selectLoyaltyCustomer = useCallback((customer: LoyaltyCustomer) => {
    setLoyaltyCustomer(customer);
    setShowLoyaltyDialog(false);
    setLoyaltySearchQuery('');
  }, []);
  
  const handleCheckout = useCallback(() => {
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
  }, [selectedBranchId, selectedEmployeeId, cart.length]);
  
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
      paidBy: paidBy && paidBy !== 'none' ? paidBy : undefined, // خانة مدفوع
    });
  };
  
  const handlePrint = () => {
    if (!lastInvoice) return;
    
    const branchName = branches.find(b => b.id === selectedBranchId)?.nameAr || 'غير محدد';
    const branchPhone = ''; // سيتم إضافة رقم الهاتف للفروع لاحقاً
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
            ${lastCartItems.map(item => `
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
              <span>${lastSubtotal.toFixed(2)} ر.س</span>
            </div>
            ${lastDiscountAmount > 0 ? `
              <div class="total-row discount">
                <span>الخصم${loyaltyCustomer ? ' (ولاء)' : ''}:</span>
                <span>- ${lastDiscountAmount.toFixed(2)} ر.س</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>الإجمالي:</span>
              <span>${lastInvoice.total.toFixed(2)} ر.س</span>
            </div>
          </div>
          
          <!-- طريقة الدفع -->
          <div class="payment-method">
            طريقة الدفع: ${lastPaymentMethod === 'cash' ? 'نقدي (كاش)' : lastPaymentMethod === 'card' ? 'شبكة (Card)' : lastPaymentMethod === 'split' ? 'تقسيم (كاش + شبكة)' : 'برنامج الولاء'}
          </div>
          ${lastPaymentMethod === 'split' ? `
            <div class="split-details" style="text-align:center;font-size:10px;margin-top:4px;padding:4px;border:1px dashed #000;">
              <span>كاش: ${lastCashAmount.toFixed(2)} ر.س</span> |
              <span>شبكة: ${lastCardAmount.toFixed(2)} ر.س</span>
            </div>
          ` : ''}
          
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
  
  const getCategoryIcon = (categoryName: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'h-5 w-5',
      md: 'h-8 w-8',
      lg: 'h-10 w-10'
    };
    const className = sizeClasses[size];
    if (categoryName.includes('حلاقة') || categoryName.includes('Haircut')) return <Scissors className={className} />;
    if (categoryName.includes('خدمات') || categoryName.includes('Services')) return <Sparkles className={className} />;
    if (categoryName.includes('عناية') || categoryName.includes('Care')) return <Heart className={className} />;
    if (categoryName.includes('تجميل') || categoryName.includes('Beauty')) return <Gem className={className} />;
    if (categoryName.includes('صبغة') || categoryName.includes('Color')) return <Palette className={className} />;
    if (categoryName.includes('تصفيف') || categoryName.includes('Styling')) return <Wind className={className} />;
    if (categoryName.includes('سبا') || categoryName.includes('Spa')) return <Flower2 className={className} />;
    if (categoryName.includes('أظافر') || categoryName.includes('Nails')) return <Hand className={className} />;
    return <Store className={className} />;
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
      <header className="h-[72px] bg-gradient-to-l from-primary/10 via-background to-background border-b border-border/50 flex items-center justify-between px-5 shrink-0 shadow-sm">
        {/* Logo & Title with Welcome Message */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
            <img 
              src="/logo.png" 
              alt="Symbol AI" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">بوابة الكاشير</h1>
            <p className="text-sm text-muted-foreground">Symbol AI - نظام نقاط البيع</p>
          </div>
          
          {/* Welcome Message for Supervisor */}
          {user && (
            <div className="mr-4 pr-4 border-r border-border/50 flex items-center gap-2">
              {(user as any).photoUrl ? (
                <img 
                  src={(user as any).photoUrl} 
                  alt={user.name || ''}
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary/30 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center border-2 border-primary/30">
                  <User className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <p className="text-base font-bold text-primary">
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
        <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-xl border border-border/60 shadow-sm">
          <Clock className="h-6 w-6 text-primary" />
          <div className="text-right">
            <div className="text-2xl font-bold font-mono tracking-wider">
              {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
        
        {/* Branch & Employee Selection */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-xl border border-border/60">
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
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <KeyboardShortcutsHelp shortcuts={shortcuts} />
          <Link href="/pos-daily-report">
            <Button variant="outline" size="lg" className="gap-2 h-12">
              <BarChart3 className="h-5 w-5" />
              تقرير اليوم
            </Button>
          </Link>
          <Link href="/pos-settings">
            <Button variant="outline" size="icon" className="h-12 w-12">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-12 w-12 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all duration-200" 
            onClick={async () => {
              await logout();
              window.location.href = '/pos-login';
            }}
            title="تسجيل الخروج"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Categories & Services */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Categories - Compact Horizontal Scrollable */}
          <div className="h-[56px] bg-card/80 border-b border-border/50 px-3 py-1.5 shrink-0">
            <ScrollArea className="h-full">
              <div className="flex gap-2 h-full">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className={`h-full px-4 rounded-lg flex items-center gap-2 transition-all duration-200 min-w-[80px] border-2 text-sm font-medium hover:scale-105 ${
                    selectedCategoryId === null 
                      ? 'bg-primary text-primary-foreground shadow-md border-primary' 
                      : 'bg-muted/60 hover:bg-muted border-border/50 hover:border-border'
                  }`}
                >
                  <Store className="h-4 w-4" />
                  <span className="font-semibold">الكل</span>
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`h-full px-4 rounded-lg flex items-center gap-2 transition-all duration-200 min-w-[80px] border-2 text-sm font-medium hover:scale-105 ${
                      selectedCategoryId === cat.id 
                        ? 'bg-primary text-primary-foreground shadow-md border-primary' 
                        : 'bg-muted/60 hover:bg-muted border-border/50 hover:border-border'
                    }`}
                  >
                    {getCategoryIcon(cat.nameAr, 'sm')}
                    <span className="font-semibold">{cat.nameAr}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Services Grid with Vertical Scrolling */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Services Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-card/50 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-semibold text-xs">الخدمات</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{filteredServices.length}</Badge>
              </div>
              {selectedCategoryId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedCategoryId(null)}
                  className="text-[10px] h-6 px-2"
                >
                  عرض الكل
                </Button>
              )}
            </div>
            
            {/* Services Grid - Responsive with Vertical Scroll */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {/* شبكة خدمات متجاوبة مع تمرير عمودي */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                  {filteredServices.map(service => (
                    <button
                      key={service.id}
                      onClick={() => addToCart(service)}
                      className="group bg-card hover:bg-primary/10 border-2 border-border/60 hover:border-primary rounded-2xl p-4 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-95 flex flex-col items-center text-center min-h-[140px]"
                    >
                      {/* Service Icon - Larger */}
                      <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mb-3 group-hover:from-primary/30 group-hover:to-primary/10 transition-all shadow-sm">
                        {getCategoryIcon(service.categoryName || '', 'lg')}
                      </div>

                      {/* Service Name */}
                      <div className="font-bold text-sm mb-2 line-clamp-2 leading-snug min-h-[40px] flex items-center justify-center">
                        {service.nameAr}
                      </div>

                      {/* Price - More Prominent */}
                      <div className="text-base font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                        {Number(service.price).toFixed(0)} <span className="text-xs">ر.س</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Empty State */}
                {filteredServices.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <Store className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-semibold mb-2">لا توجد خدمات</p>
                    <p className="text-sm mb-4">أضف خدمات جديدة للبدء</p>
                    <Link href="/pos-settings">
                      <Button variant="outline" size="default" className="gap-2">
                        <Plus className="h-4 w-4" />
                        إضافة خدمات
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Keyboard Shortcuts Bar */}
          <div className="h-12 bg-muted/50 border-t px-4 flex items-center gap-6 text-sm text-muted-foreground shrink-0">
            <span><kbd className="px-2 py-1 bg-background rounded border text-xs">F2</kbd> الدفع</span>
            <span><kbd className="px-2 py-1 bg-background rounded border text-xs">F3</kbd> مسح السلة</span>
            <span><kbd className="px-2 py-1 bg-background rounded border text-xs">F4</kbd> عميل ولاء</span>
          </div>
        </div>
        
        {/* Employee Ranking Quick Link */}
        {selectedBranchId && (
          <div className="w-[200px] bg-card border-r flex flex-col shrink-0">
            {/* Sidebar Header */}
            <div className="h-14 px-3 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span className="font-bold text-sm">الموظفين</span>
              </div>
              <Link href="/pos-employee-ranking">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  عرض الكل
                </Button>
              </Link>
            </div>
            
            {/* Top 3 Employees Quick View */}
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {employeesRanking.slice(0, 5).map((emp, index) => (
                  <div key={emp.employeeId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-amber-700 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{emp.employeeName}</p>
                      <p className="text-xs text-primary font-bold">{Number(emp.totalRevenue).toFixed(0)} ر.س</p>
                    </div>
                  </div>
                ))}
                
                {employeesRanking.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    لا توجد بيانات
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Hidden toggle for employee sidebar - removed old complex sidebar */}
        {false && showEmployeeSidebar && selectedBranchId && (
          <div className="w-[280px] bg-card border-r flex flex-col shrink-0 hidden">
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
        <div className="w-[360px] bg-card border-r border-border/50 flex flex-col shrink-0">
          {/* Cart Header */}
          <div className="h-14 px-3 border-b border-border/50 flex items-center justify-between shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span className="font-bold text-base">السلة</span>
              <Badge variant="secondary" className="h-6 px-2 text-sm font-bold">{cart.length}</Badge>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="h-8 px-3 text-sm text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-4 w-4 ml-1" />
                مسح
              </Button>
            )}
          </div>
          
          {/* Cart Items */}
          <ScrollArea className="flex-1">
            <div className="p-2.5 space-y-2">
              {cart.map(item => (
                <div key={item.serviceId} className="bg-muted/30 rounded-xl p-3 border-2 border-border/50 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-base truncate flex-1 ml-2">{item.serviceNameAr}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => removeFromCart(item.serviceId)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 hover:bg-primary/10 hover:border-primary transition-colors"
                        onClick={() => updateQuantity(item.serviceId, -1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center font-bold text-base">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7 hover:bg-primary/10 hover:border-primary transition-colors"
                        onClick={() => updateQuantity(item.serviceId, 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="text-left">
                      <span className="text-sm text-muted-foreground">{item.price.toFixed(0)} × {item.quantity}</span>
                      <span className="font-bold text-base text-primary mr-2">{item.total.toFixed(2)} ر.س</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-base">السلة فارغة</p>
                  <p className="text-sm mt-1">اختر خدمة للبدء</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Loyalty Customer - Compact */}
          {loyaltyCustomer && (
            <div className="px-2.5 py-2 border-t bg-green-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-500" />
                  <div>
                    <span className="font-medium text-sm">{loyaltyCustomer.name}</span>
                    <span className="text-xs text-muted-foreground mr-2">{loyaltyCustomer.phone}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLoyaltyCustomer(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {loyaltyDiscount && (
                <div className="mt-1 space-y-0.5">
                  <p className={`text-xs font-medium ${loyaltyDiscount.isEligibleForDiscount ? 'text-green-600' : 'text-yellow-600'}`}>
                    {loyaltyDiscount.isEligibleForDiscount 
                      ? `🎉 مؤهل لخصم ${loyaltyDiscount.discountPercentage}% (الزيارة ${loyaltyDiscount.totalApproved})`
                      : `${loyaltyDiscount.visitsInCurrentCycle} زيارات - يحتاج ${loyaltyDiscount.nextDiscountAt} للخصم`
                    }
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Cart Summary & Payment - Compact */}
          <div className="border-t border-border/50 bg-muted/30 p-3 space-y-2 shrink-0">
            {/* Employee Selection - Moved to Cart */}
            <div className="bg-card rounded-lg p-2.5 border-2 border-primary/20">
              <Label className="text-xs font-semibold text-muted-foreground mb-2 block">الموظف المنفذ</Label>
              <div className="flex items-center gap-2">
                {/* صورة الموظف المحدد */}
                {selectedEmployeeId && employees.find(e => e.id === selectedEmployeeId)?.photoUrl ? (
                  <img 
                    src={employees.find(e => e.id === selectedEmployeeId)?.photoUrl || ''}
                    alt={employees.find(e => e.id === selectedEmployeeId)?.name || ''}
                    className="w-10 h-10 rounded-full object-cover border-2 border-primary/40 shadow-sm"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                )}
                <Select 
                  value={selectedEmployeeId?.toString() || ''} 
                  onValueChange={(v) => setSelectedEmployeeId(Number(v))}
                  disabled={!selectedBranchId}
                >
                  <SelectTrigger className="flex-1 border-2 border-border/80 bg-background h-10 text-sm font-medium rounded-lg">
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-border shadow-lg max-h-[300px]">
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()} className="text-sm py-3 cursor-pointer hover:bg-primary/10">
                        <div className="flex items-center gap-3">
                          {emp.photoUrl ? (
                            <img 
                              src={emp.photoUrl} 
                              alt={emp.name} 
                              className="w-8 h-8 rounded-full object-cover border-2 border-primary/30 shrink-0" 
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-8 h-8 rounded-full bg-primary/20 items-center justify-center border-2 border-primary/30 shrink-0 ${emp.photoUrl ? 'hidden' : 'flex'}`}
                          >
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-semibold text-base">{emp.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Separator className="my-2" />
            
            <div className="flex justify-between text-sm">
              <span>المجموع الفرعي</span>
              <span className="font-semibold">{subtotal.toFixed(2)} ر.س</span>
            </div>
            
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600 text-sm">
                <span>الخصم</span>
                <span className="font-semibold">- {discountAmount.toFixed(2)} ر.س</span>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-2 border-t border-border/30">
              <span className="text-lg font-bold">الإجمالي</span>
              <span className="text-2xl font-bold text-primary">{total.toFixed(2)} ر.س</span>
            </div>
            
            {/* Loyalty Button - Small */}
            <Button 
              variant="outline" 
              className="w-full h-9 gap-2 text-sm"
              onClick={() => setShowLoyaltyDialog(true)}
            >
              <Gift className="h-4 w-4" />
              {loyaltyCustomer ? 'تغيير عميل' : 'إضافة عميل ولاء'}
            </Button>
            
            {/* Checkout Button */}
            <Button 
              className="w-full h-12 text-lg gap-2 shadow-lg font-bold"
              disabled={cart.length === 0 || !selectedBranchId || !selectedEmployeeId}
              onClick={handleCheckout}
            >
              <CreditCard className="h-5 w-5" />
              الدفع
            </Button>
          </div>
        </div>
      </div>
      
      {/* Loyalty Search Dialog */}
      <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Gift className="h-6 w-6 text-primary" />
              البحث عن عميل ولاء
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* البحث */}
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

            {/* قائمة العملاء المؤهلين للخصم (كل 3 زيارات = 60%) */}
            {eligibleCustomers.filter(c => c.isEligible).length > 0 && loyaltySearchQuery.length < 2 && (
              <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700">عملاء مؤهلين لخصم 60%</span>
                  <Badge variant="secondary" className="bg-green-600 text-white">
                    {eligibleCustomers.filter(c => c.isEligible).length}
                  </Badge>
                </div>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {eligibleCustomers.filter(c => c.isEligible).map(customer => (
                      <Card 
                        key={customer.customerId}
                        className="cursor-pointer hover:border-green-500 transition-colors border-green-300 bg-green-50/50"
                        onClick={() => selectLoyaltyCustomer({
                          id: customer.customerId,
                          name: customer.customerName,
                          phone: customer.customerPhone,
                          totalApprovedVisits: customer.totalApprovedVisits,
                          isEligibleForDiscount: customer.isEligible,
                          discountPercentage: customer.discountPercentage,
                        })}
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                              <Gift className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <div className="font-semibold">{customer.customerName}</div>
                              <div className="text-sm text-muted-foreground">{customer.customerPhone}</div>
                            </div>
                          </div>
                          <div className="text-left">
                            <Badge className="bg-green-600">خصم {customer.discountPercentage}%</Badge>
                            <div className="text-xs text-muted-foreground mt-1">{customer.totalApprovedVisits} زيارات</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* حاسبة الخصم */}
            {loyaltySearchQuery.length < 2 && eligibleCustomers.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <span className="font-semibold">حاسبة الخصم</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="bg-background rounded p-2">
                    <div className="text-2xl font-bold text-primary">{eligibleCustomers.filter(c => c.isEligible).length}</div>
                    <div className="text-xs text-muted-foreground">مؤهل للخصم</div>
                  </div>
                  <div className="bg-background rounded p-2">
                    <div className="text-2xl font-bold text-yellow-600">{eligibleCustomers.filter(c => !c.isEligible && c.visitsInCycle === 2).length}</div>
                    <div className="text-xs text-muted-foreground">زيارة واحدة للخصم</div>
                  </div>
                  <div className="bg-background rounded p-2">
                    <div className="text-2xl font-bold">{eligibleCustomers.length}</div>
                    <div className="text-xs text-muted-foreground">إجمالي العملاء</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* نتائج البحث */}
            <ScrollArea className="h-[200px]">
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
                  <div className="text-center text-muted-foreground py-8">
                    <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>لا توجد نتائج</p>
                  </div>
                )}
                
                {loyaltySearchQuery.length < 2 && eligibleCustomers.filter(c => c.isEligible).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>أدخل حرفين على الأقل للبحث</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              إتمام الدفع
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Payment Method - Compact Buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                className="h-16 flex-col gap-1"
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote className="h-6 w-6" />
                <span className="text-sm">كاش</span>
              </Button>
              <Button
                variant={paymentMethod === 'card' ? 'default' : 'outline'}
                className="h-16 flex-col gap-1"
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard className="h-6 w-6" />
                <span className="text-sm">شبكة</span>
              </Button>
              <Button
                variant={paymentMethod === 'split' ? 'default' : 'outline'}
                className="h-16 flex-col gap-1"
                onClick={() => setPaymentMethod('split')}
              >
                <Split className="h-6 w-6" />
                <span className="text-sm">تقسيم</span>
              </Button>
              <Button
                variant={paymentMethod === 'loyalty' ? 'default' : 'outline'}
                className="h-16 flex-col gap-1"
                onClick={() => setPaymentMethod('loyalty')}
                disabled={!loyaltyCustomer}
              >
                <Gift className="h-6 w-6" />
                <span className="text-sm">ولاء</span>
              </Button>
            </div>
            
            {/* Split Payment Amounts */}
            {paymentMethod === 'split' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">مبلغ الكاش</Label>
                  <Input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(Number(e.target.value))}
                    min={0}
                    max={total}
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">مبلغ الشبكة</Label>
                  <Input
                    type="number"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(Number(e.target.value))}
                    min={0}
                    max={total}
                    className="h-10"
                  />
                </div>
                {(cashAmount + cardAmount) !== total && (
                  <div className="col-span-2 text-destructive text-xs bg-destructive/10 p-2 rounded">
                    المجموع ({(cashAmount + cardAmount).toFixed(2)}) ≠ الإجمالي ({total.toFixed(2)})
                  </div>
                )}
              </div>
            )}
            
            {/* Discount - Compact */}
            <div className="space-y-1">
              <Label className="text-sm">الخصم (اختياري)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  min={0}
                  max={subtotal}
                  placeholder="0.00"
                  className="w-24 h-10"
                />
                <Input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="سبب الخصم"
                  className="flex-1 h-10"
                />
              </div>
            </div>
            
            {/* Paid By - خانة مدفوع */}
            <div className="space-y-1">
              <Label className="text-sm">مدفوع (اختياري)</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="اختر اسم العميل..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تحديد</SelectItem>
                  {PAID_INVOICE_CUSTOMERS.map((customer) => (
                    <SelectItem key={customer.id} value={customer.name}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Notes - Compact */}
            <div className="space-y-1">
              <Label className="text-sm">ملاحظات (اختياري)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية..."
                className="h-10"
              />
            </div>
            
            {/* Summary - Compact */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span>المجموع الفرعي</span>
                <span className="font-semibold">{subtotal.toFixed(2)} ر.س</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 text-sm">
                  <span>الخصم</span>
                  <span className="font-semibold">- {discountAmount.toFixed(2)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                <span className="text-lg font-bold">الإجمالي</span>
                <span className="text-2xl font-bold text-primary">{total.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="h-10 px-4">
              إلغاء
            </Button>
            <Button 
              onClick={handlePayment}
              disabled={createInvoiceMutation.isPending}
              className="h-10 px-6 gap-2"
            >
              {createInvoiceMutation.isPending ? (
                <>جاري المعالجة...</>
              ) : (
                <>
                  <Check className="h-4 w-4" />
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
