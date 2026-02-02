import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Plus,
  Pencil,
  Trash2,
  Search,
  Store,
  Scissors,
  Sparkles,
  Package,
  Save,
  X,
  DollarSign,
  Clock,
  Filter,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Category {
  id: number;
  name: string;
  nameAr: string;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number | null;
  isActive: boolean;
}

interface Service {
  id: number;
  categoryId: number;
  name: string;
  nameAr: string;
  description?: string | null;
  price: number | string;
  duration?: number | null;
  sortOrder?: number | null;
  isActive: boolean;
}

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030110188/symbol-logo.png";

export default function POSServicesOnly() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  
  // Dialog states
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  
  // Form state
  const [serviceForm, setServiceForm] = useState({
    categoryId: 0,
    name: '',
    nameAr: '',
    description: '',
    price: 0,
    duration: 30,
    sortOrder: 0,
    isActive: true,
  });
  
  // Queries
  const { data: categories = [] } = trpc.pos.categories.list.useQuery();
  const { data: services = [], refetch: refetchServices } = trpc.pos.services.list.useQuery();
  
  // Mutations
  const createServiceMutation = trpc.pos.services.create.useMutation({
    onSuccess: () => {
      toast.success('تم إضافة الخدمة بنجاح');
      refetchServices();
      setShowServiceDialog(false);
      resetServiceForm();
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    },
  });
  
  const updateServiceMutation = trpc.pos.services.update.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث الخدمة بنجاح');
      refetchServices();
      setShowServiceDialog(false);
      resetServiceForm();
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    },
  });
  
  const deleteServiceMutation = trpc.pos.services.delete.useMutation({
    onSuccess: () => {
      toast.success('تم حذف الخدمة بنجاح');
      refetchServices();
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    },
  });
  
  // Filtered services
  const filteredServices = useMemo(() => {
    let result = services;
    
    if (selectedCategoryId !== 'all') {
      result = result.filter(s => s.categoryId === selectedCategoryId);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.nameAr.includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [services, selectedCategoryId, searchQuery]);
  
  // Helpers
  const resetServiceForm = () => {
    setServiceForm({
      categoryId: categories[0]?.id || 0,
      name: '',
      nameAr: '',
      description: '',
      price: 0,
      duration: 30,
      sortOrder: 0,
      isActive: true,
    });
    setEditingService(null);
  };
  
  const openEditService = (service: Service) => {
    setEditingService(service);
    setServiceForm({
      categoryId: service.categoryId,
      name: service.name,
      nameAr: service.nameAr,
      description: service.description || '',
      price: Number(service.price),
      duration: service.duration || 30,
      sortOrder: service.sortOrder || 0,
      isActive: service.isActive,
    });
    setShowServiceDialog(true);
  };
  
  const handleSaveService = () => {
    if (!serviceForm.nameAr || !serviceForm.name || serviceForm.price < 0) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    if (editingService) {
      updateServiceMutation.mutate({
        id: editingService.id,
        ...serviceForm,
      });
    } else {
      createServiceMutation.mutate(serviceForm);
    }
  };
  
  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteServiceMutation.mutate({ id: deleteTarget.id });
  };
  
  const getCategoryName = (categoryId: number) => {
    return categories.find(c => c.id === categoryId)?.nameAr || 'غير محدد';
  };
  
  const getCategoryColor = (categoryId: number) => {
    return categories.find(c => c.id === categoryId)?.color || '#3b82f6';
  };
  
  const getCategoryIcon = (categoryName: string) => {
    if (categoryName.includes('حلاقة')) return <Scissors className="h-4 w-4" />;
    if (categoryName.includes('تنظيف') || categoryName.includes('علاج')) return <Sparkles className="h-4 w-4" />;
    if (categoryName.includes('مساج') || categoryName.includes('حمام')) return <Package className="h-4 w-4" />;
    return <Store className="h-4 w-4" />;
  };

  // Stats
  const totalServices = services.length;
  const activeServices = services.filter(s => s.isActive).length;
  const totalRevenue = services.reduce((sum, s) => sum + Number(s.price), 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header with Logo */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Symbol AI" className="h-14 w-14 rounded-xl shadow-lg" />
            <div>
              <h1 className="text-2xl font-bold text-white">إدارة الخدمات</h1>
              <p className="text-slate-400 mt-1">إدارة خدمات الكاشير وأسعارها</p>
            </div>
          </div>
          
          {isAdmin && (
            <Button
              onClick={() => {
                resetServiceForm();
                setShowServiceDialog(true);
              }}
              className="bg-primary hover:bg-primary/90 gap-2"
              size="lg"
            >
              <Plus className="h-5 w-5" />
              إضافة خدمة جديدة
            </Button>
          )}
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-cyan-500/20">
                  <Package className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الخدمات</p>
                  <p className="text-3xl font-bold text-cyan-400">{totalServices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/20">
                  <Store className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الخدمات النشطة</p>
                  <p className="text-3xl font-bold text-green-400">{activeServices}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <DollarSign className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">متوسط السعر</p>
                  <p className="text-3xl font-bold text-amber-400">
                    {totalServices > 0 ? (totalRevenue / totalServices).toFixed(0) : 0} ر.س
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Filters */}
        <Card className="border-slate-700/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث في الخدمات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedCategoryId.toString()}
                  onValueChange={(v) => setSelectedCategoryId(v === 'all' ? 'all' : Number(v))}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="جميع الأقسام" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأقسام</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Services Table */}
        <Card className="border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              قائمة الخدمات
              <Badge variant="outline" className="mr-2">{filteredServices.length}</Badge>
            </CardTitle>
            <CardDescription>جميع الخدمات المتاحة في نظام نقاط البيع</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right font-bold">الخدمة</TableHead>
                    <TableHead className="text-right font-bold">القسم</TableHead>
                    <TableHead className="text-right font-bold">السعر</TableHead>
                    <TableHead className="text-right font-bold">المدة</TableHead>
                    <TableHead className="text-center font-bold">الحالة</TableHead>
                    {isAdmin && <TableHead className="text-center font-bold">الإجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>لا توجد خدمات مطابقة للبحث</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServices.map((service) => (
                      <TableRow key={service.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-bold text-base">{service.nameAr}</p>
                            <p className="text-sm text-muted-foreground">{service.name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className="gap-1"
                            style={{ borderColor: getCategoryColor(service.categoryId) + '50' }}
                          >
                            {getCategoryIcon(getCategoryName(service.categoryId))}
                            {getCategoryName(service.categoryId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-lg text-primary">
                            {Number(service.price).toFixed(0)} ر.س
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {service.duration ? `${service.duration} دقيقة` : '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {service.isActive ? (
                            <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                              نشط
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              غير نشط
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 hover:bg-primary/10"
                                onClick={() => openEditService(service)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setDeleteTarget({
                                    id: service.id,
                                    name: service.nameAr,
                                  });
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        {/* Service Dialog */}
        <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                {editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
              </DialogTitle>
              <DialogDescription>
                {editingService ? 'قم بتعديل بيانات الخدمة' : 'أدخل بيانات الخدمة الجديدة'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>القسم *</Label>
                <Select
                  value={serviceForm.categoryId.toString()}
                  onValueChange={(v) => setServiceForm({ ...serviceForm, categoryId: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الاسم بالعربي *</Label>
                  <Input
                    value={serviceForm.nameAr}
                    onChange={(e) => setServiceForm({ ...serviceForm, nameAr: e.target.value })}
                    placeholder="حلاقة رأس"
                    className="text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الاسم بالإنجليزي *</Label>
                  <Input
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    placeholder="Haircut"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>الوصف</Label>
                <Input
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  placeholder="وصف الخدمة (اختياري)"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>السعر (ر.س) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>المدة (دقيقة)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={serviceForm.duration}
                    onChange={(e) => setServiceForm({ ...serviceForm, duration: Number(e.target.value) })}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <Label htmlFor="service-active" className="cursor-pointer">الخدمة نشطة</Label>
                <Switch
                  id="service-active"
                  checked={serviceForm.isActive}
                  onCheckedChange={(checked) => setServiceForm({ ...serviceForm, isActive: checked })}
                />
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowServiceDialog(false)}>
                <X className="h-4 w-4 ml-2" />
                إلغاء
              </Button>
              <Button 
                onClick={handleSaveService}
                disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
              >
                <Save className="h-4 w-4 ml-2" />
                {editingService ? 'حفظ التعديلات' : 'إضافة الخدمة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف الخدمة "{deleteTarget?.name}"؟
                <br />
                <span className="text-amber-500 font-medium">سيتم تعطيل الخدمة ولن تظهر في الكاشير.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteServiceMutation.isPending}
              >
                {deleteServiceMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
