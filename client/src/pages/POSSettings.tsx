import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
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
                <Settings className="h-6 w-6 text-primary" />
                إعدادات الكاشير
              </h1>
              <p className="text-muted-foreground mt-1">إدارة الأقسام والخدمات</p>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList>
            <TabsTrigger value="categories" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              الأقسام
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Package className="h-4 w-4" />
              الخدمات
            </TabsTrigger>
          </TabsList>
          
          {/* Categories Tab */}
          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>الأقسام</CardTitle>
                <Button onClick={() => { resetCategoryForm(); setEditingCategory(null); setShowCategoryDialog(true); }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة قسم
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">الاسم بالعربي</TableHead>
                      <TableHead className="text-right">الاسم بالإنجليزي</TableHead>
                      <TableHead className="text-center">الترتيب</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-center">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category, index) => (
                      <TableRow key={category.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{category.nameAr}</TableCell>
                        <TableCell>{category.name}</TableCell>
                        <TableCell className="text-center">{category.sortOrder || 0}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={category.isActive ? 'default' : 'secondary'}>
                            {category.isActive ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditCategory(category)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive"
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
                                  deleteCategoryMutation.mutate({ id: category.id });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {categories.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          لا توجد أقسام
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Services Tab */}
          <TabsContent value="services">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>الخدمات</CardTitle>
                <Button onClick={() => { resetServiceForm(); setEditingService(null); setShowServiceDialog(true); }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة خدمة
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">الاسم بالعربي</TableHead>
                      <TableHead className="text-right">القسم</TableHead>
                      <TableHead className="text-left">السعر</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      <TableHead className="text-center">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service, index) => (
                      <TableRow key={service.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{service.nameAr}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{service.categoryName || 'غير محدد'}</Badge>
                        </TableCell>
                        <TableCell className="text-left font-bold text-primary">
                          {Number(service.price).toFixed(2)} ر.س
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={service.isActive ? 'default' : 'secondary'}>
                            {service.isActive ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditService(service)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive"
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
                    ))}
                    {services.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          لا توجد خدمات
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'تعديل القسم' : 'إضافة قسم جديد'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم بالعربي *</Label>
              <Input
                value={categoryForm.nameAr}
                onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })}
                placeholder="مثال: قسم الحلاقة"
              />
            </div>
            
            <div className="space-y-2">
              <Label>الاسم بالإنجليزي *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Example: Haircut"
              />
            </div>
            
            <div className="space-y-2">
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={categoryForm.sortOrder}
                onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })}
                min={0}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>إلغاء</Button>
            <Button onClick={handleSaveCategory} disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}>
              {editingCategory ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Service Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>القسم *</Label>
              <Select value={serviceForm.categoryId?.toString() || ''} onValueChange={(v) => setServiceForm({ ...serviceForm, categoryId: Number(v) })}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>
                      {cat.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>الاسم بالعربي *</Label>
              <Input
                value={serviceForm.nameAr}
                onChange={(e) => setServiceForm({ ...serviceForm, nameAr: e.target.value })}
                placeholder="مثال: حلاقة رأس ودقن"
              />
            </div>
            
            <div className="space-y-2">
              <Label>الاسم بالإنجليزي *</Label>
              <Input
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="Example: Head and Beard Haircut"
              />
            </div>
            
            <div className="space-y-2">
              <Label>السعر (ر.س) *</Label>
              <Input
                type="number"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                min={0}
                step={0.01}
              />
            </div>
            
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="وصف اختياري للخدمة"
              />
            </div>
            
            <div className="space-y-2">
              <Label>المدة (بالدقائق)</Label>
              <Input
                type="number"
                value={serviceForm.duration}
                onChange={(e) => setServiceForm({ ...serviceForm, duration: Number(e.target.value) })}
                min={0}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>إلغاء</Button>
            <Button onClick={handleSaveService} disabled={createServiceMutation.isPending || updateServiceMutation.isPending}>
              {editingService ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
