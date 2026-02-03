import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Upload,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  Camera,
  Banknote,
  Gift,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

interface PaidInvoice {
  customerName: string;
  amount: number;
}

interface DailyConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: number;
  branchName: string;
  dailyReport: {
    totalInvoices: number;
    totalRevenue: number;
    totalCash: number;
    totalCard: number;
  } | null;
  onSuccess: () => void;
}

// دالة لضغط الصورة وتحويلها إلى Base64
async function compressAndConvertToBase64(file: File, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function DailyConfirmationDialog({
  open,
  onOpenChange,
  branchId,
  branchName,
  dailyReport,
  onSuccess,
}: DailyConfirmationDialogProps) {
  // State
  const [balanceImagePreview, setBalanceImagePreview] = useState<string | null>(null);
  const [balanceImageBase64, setBalanceImageBase64] = useState<string | null>(null);
  const [balanceFileName, setBalanceFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoice[]>([]);
  const [loyaltyInvoiceCount, setLoyaltyInvoiceCount] = useState<number>(0);
  const [loyaltyDiscountAmount, setLoyaltyDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Queries
  const { data: paidCustomers = [] } = trpc.pos.confirmation.getPaidCustomers.useQuery();
  const { data: confirmationStatus } = trpc.pos.confirmation.checkStatus.useQuery(
    { branchId },
    { enabled: !!branchId }
  );
  
  // Mutations
  const uploadImageMutation = trpc.pos.confirmation.uploadBalanceImage.useMutation();
  
  const submitMutation = trpc.pos.confirmation.submit.useMutation({
    onSuccess: () => {
      toast.success('تم تأكيد فواتير اليوم بنجاح وإرسالها للإيرادات');
      resetForm();
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || 'حدث خطأ أثناء التأكيد');
    },
  });
  
  // Handlers
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن يكون أقل من 10 ميجابايت');
        return;
      }
      
      try {
        // Compress and convert to base64
        const base64 = await compressAndConvertToBase64(file);
        setBalanceImageBase64(base64);
        setBalanceImagePreview(base64);
        setBalanceFileName(file.name);
      } catch (error) {
        toast.error('فشل في معالجة الصورة');
      }
    }
  };
  
  const removeImage = () => {
    setBalanceImageBase64(null);
    setBalanceImagePreview(null);
    setBalanceFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const addPaidInvoice = () => {
    setPaidInvoices([...paidInvoices, { customerName: '', amount: 0 }]);
  };
  
  const updatePaidInvoice = (index: number, field: keyof PaidInvoice, value: string | number) => {
    const updated = [...paidInvoices];
    if (field === 'amount') {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value as string;
    }
    setPaidInvoices(updated);
  };
  
  const removePaidInvoice = (index: number) => {
    setPaidInvoices(paidInvoices.filter((_, i) => i !== index));
  };
  
  const resetForm = () => {
    setBalanceImageBase64(null);
    setBalanceImagePreview(null);
    setBalanceFileName('');
    setPaidInvoices([]);
    setLoyaltyInvoiceCount(0);
    setLoyaltyDiscountAmount(0);
    setNotes('');
  };
  
  const handleSubmit = async () => {
    // Validation - صورة الموازنة أصبحت اختيارية (سيتم رفعها من صفحة الإيرادات)
    if (!dailyReport || dailyReport.totalInvoices === 0) {
      toast.error('لا توجد فواتير للتأكيد');
      return;
    }
    
    // Validate paid invoices
    const validPaidInvoices = paidInvoices.filter(inv => inv.customerName && inv.amount > 0);
    
    try {
      setIsUploading(true);
      
      let uploadResult = { key: '', url: '' };
      
      // Upload image only if provided (optional now)
      if (balanceImageBase64) {
        uploadResult = await uploadImageMutation.mutateAsync({
          branchId,
          imageData: balanceImageBase64,
          fileName: balanceFileName,
          mimeType: 'image/jpeg',
        });
      }
      
      // Submit confirmation
      await submitMutation.mutateAsync({
        branchId,
        balanceImageKey: uploadResult.key || undefined,
        balanceImageUrl: uploadResult.url || undefined,
        paidInvoices: validPaidInvoices.length > 0 ? validPaidInvoices : undefined,
        loyaltyInfo: loyaltyInvoiceCount > 0 || loyaltyDiscountAmount > 0 
          ? { invoiceCount: loyaltyInvoiceCount, discountAmount: loyaltyDiscountAmount }
          : undefined,
        notes: notes || undefined,
      });
    } catch (error) {
      console.error('Error submitting confirmation:', error);
      // Error is handled by mutation onError
    } finally {
      setIsUploading(false);
    }
  };
  
  // Calculate totals
  const totalPaidInvoices = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  
  // Check if already confirmed
  const isAlreadyConfirmed = confirmationStatus?.isConfirmed;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileCheck className="h-6 w-6 text-primary" />
            تأكيد فواتير اليوم - {branchName}
          </DialogTitle>
          <DialogDescription>
            قم بتأكيد فواتير اليوم وإرسالها للإيرادات
          </DialogDescription>
        </DialogHeader>
        
        {isAlreadyConfirmed ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Card className="w-full max-w-md text-center p-8 bg-green-500/10 border-green-500/30">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-bold text-green-600 mb-2">تم التأكيد مسبقاً</h3>
              <p className="text-muted-foreground">
                تم تأكيد فواتير هذا اليوم وإرسالها للإيرادات
              </p>
              {confirmationStatus?.confirmedAt && (
                <p className="text-sm text-muted-foreground mt-2">
                  {new Date(confirmationStatus.confirmedAt).toLocaleTimeString('ar-SA')}
                </p>
              )}
            </Card>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-1">
            <div className="space-y-6 py-4">
              {/* Summary Card */}
              {dailyReport && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-primary" />
                      ملخص فواتير اليوم
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-3 bg-background rounded-lg">
                        <div className="text-2xl font-bold">{dailyReport.totalInvoices}</div>
                        <div className="text-xs text-muted-foreground">عدد الفواتير</div>
                      </div>
                      <div className="p-3 bg-background rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{dailyReport.totalRevenue.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">الإجمالي (ر.س)</div>
                      </div>
                      <div className="p-3 bg-background rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{dailyReport.totalCash.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">كاش (ر.س)</div>
                      </div>
                      <div className="p-3 bg-background rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{dailyReport.totalCard.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">شبكة (ر.س)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <Separator />
              
              {/* Balance Image Upload - Optional (will be uploaded from Revenues page) */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Camera className="h-5 w-5 text-primary" />
                  صورة الموازنة
                  <Badge variant="secondary" className="text-xs">اختياري</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">يمكنك رفع صورة الموازنة لاحقاً من صفحة الإيرادات</p>
                
                {balanceImagePreview ? (
                  <div className="relative">
                    <img
                      src={balanceImagePreview}
                      alt="صورة الموازنة"
                      className="w-full max-h-64 object-contain rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 left-2"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">اضغط لرفع صورة الموازنة</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG حتى 10MB</p>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
              
              <Separator />
              
              {/* Paid Invoices - Optional */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-base font-semibold">
                    <Banknote className="h-5 w-5 text-amber-500" />
                    فواتير المدفوع
                    <Badge variant="secondary" className="text-xs">اختياري</Badge>
                  </Label>
                  <Button variant="outline" size="sm" onClick={addPaidInvoice}>
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة
                  </Button>
                </div>
                
                {paidInvoices.length > 0 ? (
                  <div className="space-y-3">
                    {paidInvoices.map((invoice, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-end gap-3">
                          <div className="flex-1 space-y-2">
                            <Label className="text-sm">اسم العميل</Label>
                            <Select
                              value={invoice.customerName}
                              onValueChange={(value) => updatePaidInvoice(index, 'customerName', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر العميل" />
                              </SelectTrigger>
                              <SelectContent>
                                {paidCustomers.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.name}>
                                    {customer.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-32 space-y-2">
                            <Label className="text-sm">المبلغ (ر.س)</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={invoice.amount || ''}
                              onChange={(e) => updatePaidInvoice(index, 'amount', e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removePaidInvoice(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                    
                    {totalPaidInvoices > 0 && (
                      <div className="flex justify-end">
                        <Badge variant="outline" className="text-base px-4 py-2">
                          إجمالي المدفوع: {totalPaidInvoices.toFixed(2)} ر.س
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
                    لا توجد فواتير مدفوع - اضغط "إضافة" لإضافة فاتورة
                  </p>
                )}
              </div>
              
              <Separator />
              
              {/* Loyalty Invoices - Optional */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Gift className="h-5 w-5 text-purple-500" />
                  فواتير الولاء
                  <Badge variant="secondary" className="text-xs">اختياري</Badge>
                </Label>
                
                <Card className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">عدد الفواتير</Label>
                      <Input
                        type="number"
                        min="0"
                        value={loyaltyInvoiceCount || ''}
                        onChange={(e) => setLoyaltyInvoiceCount(Number(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">قيمة الخصم (ر.س)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={loyaltyDiscountAmount || ''}
                        onChange={(e) => setLoyaltyDiscountAmount(Number(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </Card>
              </div>
              
              <Separator />
              
              {/* Notes - Optional */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  ملاحظات
                  <Badge variant="secondary" className="text-xs">اختياري</Badge>
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أضف أي ملاحظات إضافية..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>
        )}
        
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          {!isAlreadyConfirmed && (
            <Button
              onClick={handleSubmit}
              disabled={!balanceImageBase64 || isUploading || submitMutation.isPending || uploadImageMutation.isPending || !dailyReport || dailyReport.totalInvoices === 0}
              className="gap-2"
            >
              {(isUploading || submitMutation.isPending || uploadImageMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التأكيد...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  تأكيد وإرسال للإيرادات
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
