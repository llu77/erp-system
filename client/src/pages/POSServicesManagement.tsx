import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
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
  FolderPlus,
  Layers,
  DollarSign,
  Clock,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  AlertTriangle,
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

export default function POSServicesManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'services' | 'categories'>('services');
  
  // Dialog states
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'service' | 'category'; id: number; name: string } | null>(null);
  
  // Form states
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
  
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    nameAr: '',
    icon: '',
    color: '#3b82f6',
    sortOrder: 0,
    isActive: true,
  });
  
  // Queries
  const { data: categories = [], refetch: refetchCategories } = trpc.pos.categories.list.useQuery();
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
  
  const createCategoryMutation = trpc.pos.categories.create.useMutation({
    onSuccess: () => {
      toast.success('تم إضافة القسم بنجاح');
      refetchCategories();
      setShowCategoryDialog(false);
      resetCategoryForm();
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    },
  });
  
  const updateCategoryMutation = trpc.pos.categories.update.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث القسم بنجاح');
      refetchCategories();
      setShowCategoryDialog(false);
      resetCategoryForm();
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    },
  });
  
  const deleteCategoryMutation = trpc.pos.categories.delete.useMutation({
    onSuccess: () => {
      toast.success('تم حذف القسم بنجاح');
      refetchCategories();
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
    
    // Filter by category
    if (selectedCategoryId !== 'all') {
      result = result.filter(s => s.categoryId === selectedCategoryId);
    }
    
    // Filter by search
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
  
  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      nameAr: '',
      icon: '',
      color: '#3b82f6',
      sortOrder: 0,
      isActive: true,
    });
    setEditingCategory(null);
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
  
  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      nameAr: category.nameAr,
      icon: category.icon || '',
      color: category.color || '#3b82f6',
      sortOrder: category.sortOrder || 0,
      isActive: category.isActive,
    });
    setShowCategoryDialog(true);
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
  
  const handleSaveCategory = () => {
    if (!categoryForm.nameAr || !categoryForm.name) {
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
  
  const handleDelete = () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'service') {
      deleteServiceMutation.mutate({ id: deleteTarget.id });
    } else {
      deleteCategoryMutation.mutate({ id: deleteTarget.id });
    }
  };
  
  const getCategoryName = (categoryId: number) => {
    return categories.find(c => c.id === categoryId)?.nameAr || 'غير محدد';
  };
  
  const getServicesCount = (categoryId: number) => {
    return services.filter(s => s.categoryId === categoryId).length;
  };
  
  const getCategoryIcon = (categoryName: string) => {
    if (categoryName.includes('حلاقة')) return <Scissors className="h-5 w-5" />;
    if (categoryName.includes('تنظيف') || categoryName.includes('علاج')) return <Sparkles className="h-5 w-5" />;
    if (categoryName.includes('مساج') || categoryName.includes('حمام')) return <Package className="h-5 w-5" />;
    return <Store className="h-5 w-5" />;
  };

  // Stats
  const totalServices = services.length;
  const activeServices = services.filter(s => s.isActive).length;
  const totalCategories = categories.length;
  const activeCategories = categories.filter(c => c.isActive).length;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إدارة خدمات الكاشير</h1>
          <p className="text-muted-foreground mt-1">إدارة الأقسام والخدمات المتاحة في نظام نقاط البيع</p>
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                resetCategoryForm();
                setShowCategoryDialog(true);
              }}
              variant="outline"
            >
              <FolderPlus className="h-4 w-4 ml-2" />
              قسم جديد
            </Button>
            <Button
              onClick={() => {
                resetServiceForm();
                if (categories.length > 0) {
                  setServiceForm(prev => ({ ...prev, categoryId: categories[0].id }));
                }
                setShowServiceDialog(true);
              }}
            >
              <Plus className="h-4 w-4 ml-2" />
              خدمة جديدة
            </Button>
          </div>
        )}
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCategories}</p>
                <p className="text-sm text-muted-foreground">إجمالي الأقسام</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCategories}</p>
                <p className="text-sm text-muted-foreground">أقسام نشطة</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalServices}</p>
                <p className="text-sm text-muted-foreground">إجمالي الخدمات</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeServices}</p>
                <p className="text-sm text-muted-foreground">خدمات نشطة</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'services' | 'categories')}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="services">
                <Package className="h-4 w-4 ml-2" />
                الخدمات ({totalServices})
              </TabsTrigger>
              <TabsTrigger value="categories">
                <Layers className="h-4 w-4 ml-2" />
                الأقسام ({totalCategories})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent>
          {activeTab === 'services' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث عن خدمة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select
                  value={selectedCategoryId.toString()}
                  onValueChange={(v) => setSelectedCategoryId(v === 'all' ? 'all' : Number(v))}
                >
                  <SelectTrigger className="w-full md:w-[200px]">
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
              
              {/* Services Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الخدمة</TableHead>
                      <TableHead className="text-right">القسم</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">المدة</TableHead>
                      <TableHead className="text-center">الحالة</TableHead>
                      {isAdmin && <TableHead className="text-center">الإجراءات</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                          لا توجد خدمات
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredServices.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{service.nameAr}</p>
                              <p className="text-sm text-muted-foreground">{service.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getCategoryName(service.categoryId)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-primary">
                              {Number(service.price).toFixed(2)} ر.س
                            </span>
                          </TableCell>
                          <TableCell>
                            {service.duration ? `${service.duration} دقيقة` : '-'}
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
                                  onClick={() => openEditService(service)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setDeleteTarget({
                                      type: 'service',
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
            </div>
          )}
          
          {activeTab === 'categories' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <Card key={category.id} className={!category.isActive ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-3 rounded-lg"
                          style={{ backgroundColor: `${category.color || '#3b82f6'}20` }}
                        >
                          {getCategoryIcon(category.nameAr)}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{category.nameAr}</h3>
                          <p className="text-sm text-muted-foreground">{category.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              {getServicesCount(category.id)} خدمة
                            </Badge>
                            {category.isActive ? (
                              <Badge className="bg-green-500/10 text-green-500">نشط</Badge>
                            ) : (
                              <Badge variant="secondary">غير نشط</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditCategory(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteTarget({
                                type: 'category',
                                id: category.id,
                                name: category.nameAr,
                              });
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Service Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
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
            
            <div className="flex items-center justify-between">
              <Label>الخدمة نشطة</Label>
              <Switch
                checked={serviceForm.isActive}
                onCheckedChange={(checked) => setServiceForm({ ...serviceForm, isActive: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleSaveService}
              disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
            >
              <Save className="h-4 w-4 ml-2" />
              {editingService ? 'حفظ التغييرات' : 'إضافة الخدمة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'تعديل القسم' : 'إضافة قسم جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? 'قم بتعديل بيانات القسم' : 'أدخل بيانات القسم الجديد'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم بالعربي *</Label>
                <Input
                  value={categoryForm.nameAr}
                  onChange={(e) => setCategoryForm({ ...categoryForm, nameAr: e.target.value })}
                  placeholder="الحلاقة"
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزي *</Label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Haircut"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الأيقونة</Label>
                <Input
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  placeholder="scissors"
                />
              </div>
              <div className="space-y-2">
                <Label>اللون</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>القسم نشط</Label>
              <Switch
                checked={categoryForm.isActive}
                onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, isActive: checked })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleSaveCategory}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            >
              <Save className="h-4 w-4 ml-2" />
              {editingCategory ? 'حفظ التغييرات' : 'إضافة القسم'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد الحذف
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف {deleteTarget?.type === 'service' ? 'الخدمة' : 'القسم'} "{deleteTarget?.name}"؟
              {deleteTarget?.type === 'category' && (
                <span className="block mt-2 text-destructive">
                  تحذير: سيتم حذف جميع الخدمات المرتبطة بهذا القسم!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
