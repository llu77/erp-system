import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Receipt,
  BarChart3,
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
  const { user } = useAuth();
  
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
  
  // Queries
  const { data: branches = [] } = trpc.pos.branches.list.useQuery();
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
    
    // Get branch and employee names
    const branchName = branches.find(b => b.id === selectedBranchId)?.nameAr || 'غير محدد';
    const employeeName = employees.find(e => e.id === selectedEmployeeId)?.name || 'غير محدد';
    
    // Create thermal receipt HTML
    const receiptHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة - ${lastInvoice.invoiceNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Arial', sans-serif;
            width: 80mm;
            margin: 0 auto;
            padding: 5mm;
            font-size: 12px;
            direction: rtl;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { font-size: 18px; margin: 0; }
          .header p { margin: 5px 0; color: #666; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .items { margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .item-name { flex: 1; }
          .item-qty { width: 30px; text-align: center; }
          .item-price { width: 60px; text-align: left; }
          .total-section { margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin: 5px 0; font-weight: bold; }
          .grand-total { font-size: 16px; border-top: 2px solid #000; padding-top: 10px; }
          .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; }
          .payment-badge { 
            display: inline-block; 
            padding: 3px 10px; 
            background: #f0f0f0; 
            border-radius: 3px; 
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>صالون سمبول</h1>
          <p>${branchName}</p>
          <p>رقم الفاتورة: ${lastInvoice.invoiceNumber}</p>
        </div>
        
        <div class="divider"></div>
        
        <div class="info-row">
          <span>التاريخ:</span>
          <span>${currentTime.toLocaleDateString('ar-SA')}</span>
        </div>
        <div class="info-row">
          <span>الوقت:</span>
          <span>${currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        </div>
        <div class="info-row">
          <span>الموظف:</span>
          <span>${employeeName}</span>
        </div>
        ${loyaltyCustomer ? `
        <div class="info-row">
          <span>العميل:</span>
          <span>${loyaltyCustomer.name}</span>
        </div>
        ` : ''}
        
        <div class="divider"></div>
        
        <div class="items">
          ${cart.map(item => `
            <div class="item">
              <span class="item-name">${item.serviceNameAr}</span>
              <span class="item-qty">x${item.quantity}</span>
              <span class="item-price">${item.total.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="divider"></div>
        
        <div class="total-section">
          <div class="total-row">
            <span>المجموع:</span>
            <span>${subtotal.toFixed(2)} ر.س</span>
          </div>
          ${discountAmount > 0 ? `
          <div class="total-row" style="color: green;">
            <span>الخصم:</span>
            <span>-${discountAmount.toFixed(2)} ر.س</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>الإجمالي:</span>
            <span>${lastInvoice.total.toFixed(2)} ر.س</span>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 10px;">
          <span class="payment-badge">
            ${paymentMethod === 'cash' ? 'كاش' : 
              paymentMethod === 'card' ? 'شبكة' : 
              paymentMethod === 'split' ? 'تقسيم' : 'ولاء'}
          </span>
        </div>
        
        <div class="footer">
          <p>شكراً لزيارتكم</p>
          <p>نتمنى لكم يوماً سعيداً</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
    }
    
    toast.success('تم إرسال الفاتورة للطباعة');
  };
  
  // Current time
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const getCategoryIcon = (categoryName: string) => {
    if (categoryName.includes('حلاقة') || categoryName.includes('Haircut')) return <Scissors className="h-5 w-5" />;
    if (categoryName.includes('خدمات') || categoryName.includes('Services')) return <Sparkles className="h-5 w-5" />;
    return <Store className="h-5 w-5" />;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              بوابة الكاشير
            </h1>
            <Badge variant="outline" className="text-lg px-3 py-1">
              <Clock className="h-4 w-4 ml-2" />
              {currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Branch Selection */}
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
              <Select value={selectedBranchId?.toString() || ''} onValueChange={(v) => setSelectedBranchId(Number(v))}>
                <SelectTrigger className="w-[180px]">
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
            
            {/* Employee Selection */}
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <Select 
                value={selectedEmployeeId?.toString() || ''} 
                onValueChange={(v) => setSelectedEmployeeId(Number(v))}
                disabled={!selectedBranchId}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Daily Report Link */}
            <Link href="/pos/daily-report">
              <Button variant="outline" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                تقرير اليوم
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Services Panel */}
          <div className="flex-1 flex flex-col border-l overflow-hidden">
            {/* Categories Tabs */}
            <Tabs 
              value={selectedCategoryId?.toString() || 'all'} 
              onValueChange={(v) => setSelectedCategoryId(v === 'all' ? null : Number(v))}
              className="flex flex-col h-full"
            >
              <TabsList className="w-full justify-start rounded-none border-b bg-muted/50 p-1 h-auto flex-wrap">
                <TabsTrigger value="all" className="gap-2">
                  <Store className="h-4 w-4" />
                  الكل
                </TabsTrigger>
                {categories.map(cat => (
                  <TabsTrigger key={cat.id} value={cat.id.toString()} className="gap-2">
                    {getCategoryIcon(cat.nameAr)}
                    {cat.nameAr}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <TabsContent value={selectedCategoryId?.toString() || 'all'} className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredServices.map(service => (
                      <Card 
                        key={service.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => addToCart(service)}
                      >
                        <CardContent className="p-4 text-center">
                          <div className="font-semibold text-lg mb-1">{service.nameAr}</div>
                          <div className="text-primary font-bold text-xl">
                            {Number(service.price).toFixed(2)} ر.س
                          </div>
                          {service.categoryName && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {service.categoryName}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {filteredServices.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                      لا توجد خدمات في هذا القسم
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Cart Panel */}
          <div className="w-[400px] flex flex-col bg-card">
            {/* Cart Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                السلة ({cart.length})
              </h2>
              {cart.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
                  <Trash2 className="h-4 w-4 ml-1" />
                  مسح
                </Button>
              )}
            </div>
            
            {/* Cart Items */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {cart.map(item => (
                  <Card key={item.serviceId}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{item.serviceNameAr}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeFromCart(item.serviceId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.serviceId, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-bold">{item.quantity}</span>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => updateQuantity(item.serviceId, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-left">
                          <div className="text-sm text-muted-foreground">{item.price.toFixed(2)} × {item.quantity}</div>
                          <div className="font-bold text-primary">{item.total.toFixed(2)} ر.س</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {cart.length === 0 && (
                  <div className="text-center text-muted-foreground py-12">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    السلة فارغة
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Loyalty Customer */}
            {loyaltyCustomer && (
              <div className="p-4 border-t bg-green-500/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-green-500" />
                    <div>
                      <div className="font-medium">{loyaltyCustomer.name}</div>
                      <div className="text-sm text-muted-foreground">{loyaltyCustomer.phone}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLoyaltyCustomer(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {loyaltyDiscount && (
                  <div className={`mt-2 text-sm ${loyaltyDiscount.eligible ? 'text-green-500' : 'text-yellow-500'}`}>
                    {loyaltyDiscount.message}
                  </div>
                )}
              </div>
            )}
            
            {/* Cart Summary */}
            <div className="p-4 border-t space-y-3">
              <div className="flex justify-between text-lg">
                <span>المجموع الفرعي</span>
                <span>{subtotal.toFixed(2)} ر.س</span>
              </div>
              
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-500">
                  <span>الخصم</span>
                  <span>- {discountAmount.toFixed(2)} ر.س</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-xl font-bold">
                <span>الإجمالي</span>
                <span className="text-primary">{total.toFixed(2)} ر.س</span>
              </div>
              
              {/* Loyalty Button */}
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => setShowLoyaltyDialog(true)}
              >
                <Gift className="h-4 w-4" />
                {loyaltyCustomer ? 'تغيير عميل الولاء' : 'إضافة عميل ولاء'}
              </Button>
              
              {/* Checkout Button */}
              <Button 
                className="w-full h-14 text-lg gap-2"
                disabled={cart.length === 0 || !selectedBranchId || !selectedEmployeeId}
                onClick={handleCheckout}
              >
                <CreditCard className="h-5 w-5" />
                الدفع
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Loyalty Search Dialog */}
      <Dialog open={showLoyaltyDialog} onOpenChange={setShowLoyaltyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              البحث عن عميل ولاء
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو رقم الجوال..."
                value={loyaltySearchQuery}
                onChange={(e) => setLoyaltySearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {loyaltySearchResults.map(customer => (
                  <Card 
                    key={customer.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => selectLoyaltyCustomer(customer)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">{customer.phone}</div>
                      </div>
                      <Check className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100" />
                    </CardContent>
                  </Card>
                ))}
                
                {loyaltySearchQuery.length >= 2 && loyaltySearchResults.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    لا توجد نتائج
                  </div>
                )}
                
                {loyaltySearchQuery.length < 2 && (
                  <div className="text-center text-muted-foreground py-8">
                    أدخل حرفين على الأقل للبحث
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
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              إتمام الدفع
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Payment Method */}
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('cash')}
                >
                  <Banknote className="h-4 w-4" />
                  كاش
                </Button>
                <Button
                  variant={paymentMethod === 'card' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('card')}
                >
                  <CreditCard className="h-4 w-4" />
                  شبكة
                </Button>
                <Button
                  variant={paymentMethod === 'split' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('split')}
                >
                  <Split className="h-4 w-4" />
                  تقسيم
                </Button>
                <Button
                  variant={paymentMethod === 'loyalty' ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setPaymentMethod('loyalty')}
                  disabled={!loyaltyCustomer}
                >
                  <Gift className="h-4 w-4" />
                  ولاء
                </Button>
              </div>
            </div>
            
            {/* Split Payment Amounts */}
            {paymentMethod === 'split' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>مبلغ الكاش</Label>
                  <Input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(Number(e.target.value))}
                    min={0}
                    max={total}
                  />
                </div>
                <div className="space-y-2">
                  <Label>مبلغ الشبكة</Label>
                  <Input
                    type="number"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(Number(e.target.value))}
                    min={0}
                    max={total}
                  />
                </div>
                {(cashAmount + cardAmount) !== total && (
                  <div className="col-span-2 text-destructive text-sm">
                    المجموع ({(cashAmount + cardAmount).toFixed(2)}) يجب أن يساوي الإجمالي ({total.toFixed(2)})
                  </div>
                )}
              </div>
            )}
            
            {/* Discount */}
            <div className="space-y-2">
              <Label>الخصم (اختياري)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  min={0}
                  max={subtotal}
                  placeholder="0.00"
                  className="flex-1"
                />
                <Input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="سبب الخصم"
                  className="flex-1"
                />
              </div>
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية..."
              />
            </div>
            
            {/* Summary */}
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span>المجموع الفرعي</span>
                  <span>{subtotal.toFixed(2)} ر.س</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>الخصم</span>
                    <span>- {discountAmount.toFixed(2)} ر.س</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-xl font-bold">
                  <span>الإجمالي</span>
                  <span className="text-primary">{total.toFixed(2)} ر.س</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handlePayment}
              disabled={createInvoiceMutation.isPending}
              className="gap-2"
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
        <DialogContent className="max-w-sm text-center">
          <div className="py-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">تم بنجاح!</h2>
            <p className="text-muted-foreground mb-4">
              تم إنشاء الفاتورة رقم
            </p>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {lastInvoice?.invoiceNumber}
            </Badge>
            <p className="text-2xl font-bold text-primary mt-4">
              {lastInvoice?.total.toFixed(2)} ر.س
            </p>
          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handlePrint} className="w-full gap-2">
              <Printer className="h-4 w-4" />
              طباعة الفاتورة
            </Button>
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)} className="w-full">
              فاتورة جديدة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
