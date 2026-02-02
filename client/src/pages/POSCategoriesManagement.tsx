import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Plus,
  Pencil,
  Trash2,
  Store,
  Scissors,
  Sparkles,
  Package,
  Save,
  X,
  Layers,
  FolderPlus,
} from 'lucide-react';
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

const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310419663030110188/symbol-logo.png";

export default function POSCategoriesManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  // Dialog states
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  
  // Form state
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
  const { data: services = [] } = trpc.pos.services.list.useQuery();
  
  // Mutations
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
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(`خطأ: ${error.message}`);
    },
  });
  
  // Helpers
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
    deleteCategoryMutation.mutate({ id: deleteTarget.id });
  };
  
  const getServicesCount = (categoryId: number) => {
    return services.filter(s => s.categoryId === categoryId).length;
  };
  
  const getCategoryIcon = (categoryName: string) => {
    if (categoryName.includes('حلاقة')) return <Scissors className="h-6 w-6" />;
    if (categoryName.includes('تنظيف') || categoryName.includes('علاج')) return <Sparkles className="h-6 w-6" />;
    if (categoryName.includes('مساج') || categoryName.includes('حمام')) return <Package className="h-6 w-6" />;
    return <Store className="h-6 w-6" />;
  };

  // Stats
  const totalCategories = categories.length;
  const activeCategories = categories.filter(c => c.isActive).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header with Logo */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-l from-slate-900 to-slate-800 rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="Symbol AI" className="h-14 w-14 rounded-xl shadow-lg" />
            <div>
              <h1 className="text-2xl font-bold text-white">إدارة الأقسام</h1>
              <p className="text-slate-400 mt-1">إدارة أقسام الخدمات في نظام نقاط البيع</p>
            </div>
          </div>
          
          {isAdmin && (
            <Button
              onClick={() => {
                resetCategoryForm();
                setShowCategoryDialog(true);
              }}
              className="bg-primary hover:bg-primary/90 gap-2"
              size="lg"
            >
              <FolderPlus className="h-5 w-5" />
              إضافة قسم جديد
            </Button>
          )}
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Layers className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الأقسام</p>
                  <p className="text-3xl font-bold text-blue-400">{totalCategories}</p>
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
                  <p className="text-sm text-muted-foreground">الأقسام النشطة</p>
                  <p className="text-3xl font-bold text-green-400">{activeCategories}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <Package className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الخدمات</p>
                  <p className="text-3xl font-bold text-amber-400">{services.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Categories Grid */}
        <Card className="border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              قائمة الأقسام
            </CardTitle>
            <CardDescription>جميع أقسام الخدمات المتاحة في النظام</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => (
                <Card 
                  key={category.id} 
                  className={`transition-all duration-300 hover:shadow-lg hover:border-primary/30 ${!category.isActive ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div 
                          className="p-4 rounded-xl transition-transform duration-300 hover:scale-110"
                          style={{ backgroundColor: `${category.color || '#3b82f6'}20` }}
                        >
                          {getCategoryIcon(category.nameAr)}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{category.nameAr}</h3>
                          <p className="text-sm text-muted-foreground">{category.name}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Badge variant="outline" className="text-xs">
                              {getServicesCount(category.id)} خدمة
                            </Badge>
                            {category.isActive ? (
                              <Badge className="bg-green-500/10 text-green-500 text-xs">نشط</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">غير نشط</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 hover:bg-primary/10"
                            onClick={() => openEditCategory(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setDeleteTarget({
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
              
              {categories.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>لا توجد أقسام حالياً</p>
                  {isAdmin && <p className="text-sm mt-2">اضغط على "إضافة قسم جديد" للبدء</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Category Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-primary" />
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
                    className="text-right"
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
                  <Label>اللون</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>الترتيب</Label>
                  <Input
                    type="number"
                    min="0"
                    value={categoryForm.sortOrder}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: Number(e.target.value) })}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <Label htmlFor="category-active" className="cursor-pointer">القسم نشط</Label>
                <Switch
                  id="category-active"
                  checked={categoryForm.isActive}
                  onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, isActive: checked })}
                />
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                <X className="h-4 w-4 ml-2" />
                إلغاء
              </Button>
              <Button 
                onClick={handleSaveCategory}
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              >
                <Save className="h-4 w-4 ml-2" />
                {editingCategory ? 'حفظ التعديلات' : 'إضافة القسم'}
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
                هل أنت متأكد من حذف القسم "{deleteTarget?.name}"؟
                <br />
                <span className="text-amber-500 font-medium">سيتم تعطيل القسم وجميع الخدمات المرتبطة به.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleteCategoryMutation.isPending}
              >
                {deleteCategoryMutation.isPending ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
