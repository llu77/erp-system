import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";

type CategoryFormData = {
  name: string;
  description?: string;
};

export default function CategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.categories.list.useQuery();

  const createForm = useForm<CategoryFormData>({
    defaultValues: { name: "", description: "" },
  });

  const editForm = useForm<CategoryFormData>();

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الفئة بنجاح");
      utils.categories.list.invalidate();
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الإنشاء");
    },
  });

  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الفئة بنجاح");
      utils.categories.list.invalidate();
      setEditingCategory(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء التحديث");
    },
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفئة بنجاح");
      utils.categories.list.invalidate();
      setDeleteCategoryId(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (data: CategoryFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    editForm.reset({
      name: category.name,
      description: category.description || "",
    });
  };

  const handleUpdate = (data: CategoryFormData) => {
    if (!editingCategory) return;
    updateMutation.mutate({
      id: editingCategory.id,
      ...data,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>إدارة الفئات</CardTitle>
              <Badge variant="secondary">{categories.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة فئة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الفئة</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-[100px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        لا يوجد فئات
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {category.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={category.isActive ? "default" : "secondary"}>
                            {category.isActive ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteCategoryId(category.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة فئة جديدة</DialogTitle>
            <DialogDescription>أدخل بيانات الفئة الجديدة</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الفئة</Label>
              <Input {...createForm.register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea {...createForm.register("description")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الفئة</DialogTitle>
            <DialogDescription>قم بتعديل بيانات الفئة</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم الفئة</Label>
              <Input {...editForm.register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea {...editForm.register("description")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCategory(null)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذه الفئة؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCategoryId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteCategoryId && deleteMutation.mutate({ id: deleteCategoryId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
