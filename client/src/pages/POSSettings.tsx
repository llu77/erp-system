import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { 
  Settings, 
  Plus, 
  Pencil, 
  Trash2, 
  FolderOpen,
  Package,
  ArrowRight,
  ShoppingCart,
  BarChart3,
  Printer,
} from 'lucide-react';
import { Link } from 'wouter';

export default function POSSettings() {
  const utils = trpc.useUtils();
  
  // State
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: number; name: string; nameAr: string; icon?: string | null; sortOrder?: number } | null>(null);
  const [editingService, setEditingService] = useState<{ id: number; categoryId: number; name: string; nameAr: string; price: number; description?: string; duration?: number; sortOrder?: number } | null>(null);
  
  // Form state
  const [categoryForm, setCategoryForm] = useState({ name: '', nameAr: '', icon: '', sortOrder: 0 });
  const [serviceForm, setServiceForm] = useState({ categoryId: 0, name: '', nameAr: '', price: 0, description: '', duration: 0, sortOrder: 0 });
  
  // Queries
  const { data: categories = [] } = trpc.pos.categories.list.useQuery();
  const { data: services = [] } = trpc.pos.services.list.useQuery();
  
  // Mutations
  const createCategoryMutation = trpc.pos.categories.create.useMutation({
    onSuccess: () => {
      utils.pos.categories.list.invalidate();
      setShowCategoryDialog(false);
      resetCategoryForm();
      toast.success('تم إضافة القسم بنجاح');
    },
    onError: (error) => toast.error(error.message),
  });
  
  const updateCategoryMutation = trpc.pos.categories.update.useMutation({
    onSuccess: () => {
      utils.pos.categories.list.invalidate();
      setShowCategoryDialog(false);
      setEditingCategory(null);
      resetCategoryForm();
      toast.success('تم تحديث القسم بنجاح');
    },
    onError: (error) => toast.error(error.message),
  });
  
  const deleteCategoryMutation = trpc.pos.categories.delete.useMutation({
    onSuccess: () => {
      utils.pos.categories.list.invalidate();
      toast.success('تم حذف القسم بنجاح');
    },
    onError: (error) => toast.error(error.message),
  });
  
  const createServiceMutation = trpc.pos.services.create.useMutation({
    onSuccess: () => {
      utils.pos.services.list.invalidate();
      setShowServiceDialog(false);
      resetServiceForm();
      toast.success('تم إضافة الخدمة بنجاح');
    },
    onError: (error) => toast.error(error.message),
  });
  
  const updateServiceMutation = trpc.pos.services.update.useMutation({
    onSuccess: () => {
      utils.pos.services.list.invalidate();
      setShowServiceDialog(false);
      setEditingService(null);
      resetServiceForm();
      toast.success('تم تحديث الخدمة بنجاح');
    },
    onError: (error) => toast.error(error.message),
  });
  
  const deleteServiceMutation = trpc.pos.services.delete.useMutation({
    onSuccess: () => {
      utils.pos.services.list.invalidate();
      toast.success('تم حذف الخدمة بنجاح');
    },
    onError: (error) => toast.error(error.message),
  });
  
  // Functions
  const resetCategoryForm = () => {
    setCategoryForm({ name: '', nameAr: '', icon: '', sortOrder: 0 });
  };
  
  const resetServiceForm = () => {
    setServiceForm({ categoryId: 0, name: '', nameAr: '', price: 0, description: '', duration: 0, sortOrder: 0 });
  };
  
  const openEditCategory = (category: typeof categories[0]) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      nameAr: category.nameAr,
      icon: category.icon || '',
      sortOrder: category.sortOrder || 0,
    });
    setShowCategoryDialog(true);
  };
  
  const openEditService = (service: typeof services[0]) => {
    setEditingService({
      id: service.id,
      categoryId: service.categoryId,
      name: service.name,
      nameAr: service.nameAr,
      price: Number(service.price),
      description: service.description || undefined,
      duration: service.duration || undefined,
      sortOrder: service.sortOrder || undefined,
    });
    setServiceForm({
      categoryId: service.categoryId,
      name: service.name,
      nameAr: service.nameAr,
      price: Number(service.price),
      description: service.description || '',
      duration: service.duration || 0,
      sortOrder: service.sortOrder || 0,
    });
    setShowServiceDialog(true);
  };
  
  const handleSaveCategory = () => {
    if (!categoryForm.name || !categoryForm.nameAr) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        ...categoryForm,
      });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };
  
  const handleSaveService = () => {
    if (!serviceForm.categoryId || !serviceForm.name || !serviceForm.nameAr || !serviceForm.price) {
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
  
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="h-20 bg-gradient-to-l from-primary/10 via-background to-background border-b flex items-center justify-between px-6 shrink-0">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <Link href="/pos">
            <Button variant="ghost" size="icon" className="h-12 w-12">
              <ArrowRight className="h-6 w-6" />
            </Button>
          </Link>
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
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              إعدادات الكاشير
            </h1>
            <p className="text-sm text-muted-foreground">إدارة الأقسام والخدمات</p>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center gap-3">
          <Link href="/pos">
            <Button size="lg" className="gap-2 h-12">
              <ShoppingCart className="h-5 w-5" />
              الكاشير
            </Button>
          </Link>
          <Link href="/pos/report">
            <Button variant="outline" size="lg" className="gap-2 h-12">
              <BarChart3 className="h-5 w-5" />
              تقرير اليوم
            </Button>
          </Link>
          <Link href="/pos-print-settings">
            <Button variant="outline" size="lg" className="gap-2 h-12">
              <Printer className="h-5 w-5" />
              إعدادات الطباعة
            </Button>
          </Link>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="categories" className="space-y-6">
            <TabsList className="h-14 p-1">
              <TabsTrigger value="categories" className="gap-2 h-12 px-6 text-base">
                <FolderOpen className="h-5 w-5" />
                الأقسام
                <Badge variant="secondary" className="mr-2">{categories.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="services" className="gap-2 h-12 px-6 text-base">
                <Package className="h-5 w-5" />
                الخدمات
                <Badge variant="secondary" className="mr-2">{services.length}</Badge>
              </TabsTrigger>
            </TabsList>
            
            {/* Categories Tab */}
            <TabsContent value="categories">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    إدارة الأقسام
                  </CardTitle>
                  <Button 
                    size="lg"
                    onClick={() => { resetCategoryForm(); setEditingCategory(null); setShowCategoryDialog(true); }} 
                    className="gap-2 h-12"
                  >
                    <Plus className="h-5 w-5" />
                    إضافة قسم جديد
                  </Button>
                </CardHeader>
                <CardContent>
                  {categories.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categories.map((category) => (
                        <Card key={category.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl">
                                {category.icon || '📁'}
                              </div>
                              <Badge variant={category.isActive ? 'default' : 'secondary'}>
                                {category.isActive ? 'نشط' : 'غير نشط'}
                              </Badge>
                            </div>
                            <h3 className="text-lg font-bold mb-1">{category.nameAr}</h3>
                            <p className="text-sm text-muted-foreground mb-3">{category.name}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                الترتيب: {category.sortOrder || 0}
                              </span>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditCategory(category)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
                                      deleteCategoryMutation.mutate({ id: category.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <h3 className="text-lg font-semibold mb-2">لا توجد أقسام</h3>
                      <p className="text-muted-foreground mb-4">ابدأ بإضافة أقسام الخدمات مثل "الحلاقة" أو "العناية بالبشرة"</p>
                      <Button onClick={() => { resetCategoryForm(); setEditingCategory(null); setShowCategoryDialog(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />
                        إضافة قسم
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Services Tab */}
            <TabsContent value="services">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    إدارة الخدمات
                  </CardTitle>
                  <Button 
                    size="lg"
                    onClick={() => { resetServiceForm(); setEditingService(null); setShowServiceDialog(true); }} 
                    className="gap-2 h-12"
                    disabled={categories.length === 0}
                  >
                    <Plus className="h-5 w-5" />
                    إضافة خدمة جديدة
                  </Button>
                </CardHeader>
                <CardContent>
                  {categories.length === 0 ? (
                    <div className="text-center py-12">
                      <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <h3 className="text-lg font-semibold mb-2">أضف قسم أولاً</h3>
                      <p className="text-muted-foreground">يجب إضافة قسم واحد على الأقل قبل إضافة الخدمات</p>
                    </div>
                  ) : services.length > 0 ? (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right w-16">#</TableHead>
                            <TableHead className="text-right">الخدمة</TableHead>
                            <TableHead className="text-right">القسم</TableHead>
                            <TableHead className="text-center">السعر</TableHead>
                            <TableHead className="text-center">المدة</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                            <TableHead className="text-center w-32">الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services.map((service, index) => {
                            const category = categories.find(c => c.id === service.categoryId);
                            return (
                              <TableRow key={service.id} className="h-16">
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  <div>
                                    <div className="font-semibold">{service.nameAr}</div>
                                    <div className="text-sm text-muted-foreground">{service.name}</div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{category?.nameAr || '-'}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="text-lg font-bold text-primary">{Number(service.price).toFixed(2)}</span>
                                  <span className="text-sm text-muted-foreground mr-1">ر.س</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  {service.duration ? `${service.duration} د` : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={service.isActive ? 'default' : 'secondary'}>
                                    {service.isActive ? 'نشط' : 'غير نشط'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEditService(service)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => {
                                        if (confirm('هل أنت متأكد من حذف هذه الخدمة؟')) {
                                          deleteServiceMutation.mutate({ id: service.id });
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                      <h3 className="text-lg font-semibold mb-2">لا توجد خدمات</h3>
                      <p className="text-muted-foreground mb-4">ابدأ بإضافة خدمات مثل "حلاقة رأس ودقن" أو "تنظيف بشرة"</p>
                      <Button onClick={() => { resetServiceForm(); setEditingService(null); setShowServiceDialog(true); }} className="gap-2">
                        <Plus className="h-4 w-4" />
                        إضافة خدمة
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingCategory ? 'تعديل القسم' : 'إضافة قسم جديد'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base">الاسم بالعربي *</Label>
              <Input 
                value={categoryForm.nameAr} 
                onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })}
                placeholder="مثال: الحلاقة"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">الاسم بالإنجليزي *</Label>
              <Input 
                value={categoryForm.name} 
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Example: Haircut"
                className="h-12 text-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base">الأيقونة</Label>
                <Input 
                  value={categoryForm.icon} 
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  placeholder="💇"
                  className="h-12 text-base text-center"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">الترتيب</Label>
                <Input 
                  type="number"
                  value={categoryForm.sortOrder} 
                  onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })}
                  className="h-12 text-base"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)} className="h-12">
              إلغاء
            </Button>
            <Button 
              onClick={handleSaveCategory} 
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              className="h-12"
            >
              {editingCategory ? 'حفظ التعديلات' : 'إضافة القسم'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Service Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base">القسم *</Label>
              <Select 
                value={serviceForm.categoryId?.toString() || ''} 
                onValueChange={(v) => setServiceForm({ ...serviceForm, categoryId: Number(v) })}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()} className="text-base">
                      {cat.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-base">الاسم بالعربي *</Label>
              <Input 
                value={serviceForm.nameAr} 
                onChange={(e) => setServiceForm({ ...serviceForm, nameAr: e.target.value })}
                placeholder="مثال: حلاقة رأس ودقن"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">الاسم بالإنجليزي *</Label>
              <Input 
                value={serviceForm.name} 
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="Example: Head and Beard Haircut"
                className="h-12 text-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base">السعر (ر.س) *</Label>
                <Input 
                  type="number"
                  value={serviceForm.price} 
                  onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                  placeholder="40"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">المدة (دقيقة)</Label>
                <Input 
                  type="number"
                  value={serviceForm.duration} 
                  onChange={(e) => setServiceForm({ ...serviceForm, duration: Number(e.target.value) })}
                  placeholder="30"
                  className="h-12 text-base"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base">الوصف</Label>
              <Input 
                value={serviceForm.description} 
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="وصف مختصر للخدمة"
                className="h-12 text-base"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)} className="h-12">
              إلغاء
            </Button>
            <Button 
              onClick={handleSaveService} 
              disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
              className="h-12"
            >
              {editingService ? 'حفظ التعديلات' : 'إضافة الخدمة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
