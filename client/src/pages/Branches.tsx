import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { MobileCard, MobileCardList, Pencil as PencilIcon, Trash2 as Trash2Icon } from "@/components/ui/mobile-card-view";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2,
  MapPin,
  Phone,
  Users,
  Search
} from "lucide-react";

interface BranchFormData {
  code: string;
  nameAr: string;
  nameEn: string;
  address: string;
  phone: string;
  isActive: boolean;
}

const initialFormData: BranchFormData = {
  code: "",
  nameAr: "",
  nameEn: "",
  address: "",
  phone: "",
  isActive: true,
};

export default function Branches() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<BranchFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");

  // جلب الفروع
  const { data: branches, isLoading, refetch } = trpc.branches.list.useQuery();

  // إضافة فرع
  const createMutation = trpc.branches.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الفرع بنجاح");
      setShowDialog(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إضافة الفرع");
    },
  });

  // تعديل فرع
  const updateMutation = trpc.branches.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الفرع بنجاح");
      setShowDialog(false);
      setFormData(initialFormData);
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث الفرع");
    },
  });

  // حذف فرع
  const deleteMutation = trpc.branches.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الفرع بنجاح");
      setShowDeleteDialog(false);
      setDeletingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حذف الفرع");
    },
  });

  const handleSubmit = () => {
    if (!formData.code.trim() || !formData.nameAr.trim()) {
      toast.error("يرجى ملء الحقول المطلوبة");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (branch: typeof branches extends (infer T)[] | undefined ? T : never) => {
    if (!branch) return;
    setEditingId(branch.id);
    setFormData({
      code: branch.code,
      nameAr: branch.nameAr,
      nameEn: branch.name || "",
      address: branch.address || "",
      phone: branch.phone || "",
      isActive: branch.isActive,
    });
    setShowDialog(true);
  };

  const handleDelete = (id: number) => {
    setDeletingId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate({ id: deletingId });
    }
  };

  const openAddDialog = () => {
    setEditingId(null);
    setFormData(initialFormData);
    setShowDialog(true);
  };

  // فلترة الفروع
  const filteredBranches = branches?.filter((branch) =>
    branch.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (branch.address && branch.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // التحقق من صلاحية المسؤول أو المدير
  if (user?.role !== "admin" && user?.role !== "manager") {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-medium mb-2">غير مصرح</h3>
            <p className="text-muted-foreground">هذه الصفحة متاحة للمسؤول والمدير فقط</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* العنوان */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="kpi-icon bg-gradient-to-br from-purple-500 to-purple-600">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إدارة الفروع</h1>
              <p className="text-muted-foreground text-sm">إضافة وتعديل وحذف الفروع</p>
            </div>
          </div>
          <Button onClick={openAddDialog} className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg">
            <Plus className="h-4 w-4" />
            إضافة فرع
          </Button>
        </div>

        {/* البحث */}
        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث في الفروع..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* جدول الفروع */}
        <Card className="card-professional">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-purple-500" />
                  قائمة الفروع
                </CardTitle>
                <CardDescription>
                  {filteredBranches?.length || 0} فرع
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                {branches?.filter(b => b.isActive).length || 0} نشط
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredBranches && filteredBranches.length > 0 ? (
              isMobile ? (
                /* عرض البطاقات على الموبايل */
                <MobileCardList
                  items={filteredBranches}
                  emptyMessage="لا توجد فروع"
                  emptyIcon={<Building2 className="h-12 w-12" />}
                  renderCard={(branch) => (
                    <MobileCard
                      key={branch.id}
                      fields={[
                        { label: "الاسم", value: branch.nameAr, isTitle: true },
                        { label: "الكود", value: branch.code, isSubtitle: true },
                        { label: "العنوان", value: branch.address || "-" },
                        { label: "الهاتف", value: branch.phone || "-" },
                      ]}
                      statusBadge={{
                        label: branch.isActive ? "نشط" : "غير نشط",
                        variant: branch.isActive ? "default" : "secondary"
                      }}
                      actions={[
                        {
                          label: "تعديل",
                          icon: <PencilIcon className="h-4 w-4" />,
                          onClick: () => handleEdit(branch)
                        },
                        {
                          label: "حذف",
                          icon: <Trash2Icon className="h-4 w-4" />,
                          onClick: () => handleDelete(branch.id),
                          variant: "destructive"
                        }
                      ]}
                    />
                  )}
                />
              ) : (
                /* عرض الجدول على الشاشات الكبيرة */
                <div className="table-professional">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الكود</TableHead>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">الهاتف</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right w-24">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBranches.map((branch) => (
                        <TableRow key={branch.id}>
                          <TableCell className="font-mono">{branch.code}</TableCell>
                          <TableCell className="font-medium">{branch.nameAr}</TableCell>
                          <TableCell>
                            {branch.address ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {branch.address}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {branch.phone ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {branch.phone}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={branch.isActive ? "default" : "secondary"}>
                              {branch.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(branch)}
                                className="h-8 w-8"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(branch.id)}
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">لا توجد فروع</h3>
                <p className="text-muted-foreground mb-4">ابدأ بإضافة فرع جديد</p>
                <Button onClick={openAddDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة فرع
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة إضافة/تعديل فرع */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {editingId ? "تعديل الفرع" : "إضافة فرع جديد"}
              </DialogTitle>
              <DialogDescription>
                {editingId ? "قم بتعديل بيانات الفرع" : "أدخل بيانات الفرع الجديد"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">كود الفرع *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="BR001"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="nameAr">الاسم بالعربية *</Label>
                  <Input
                    id="nameAr"
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    placeholder="الفرع الرئيسي"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="nameEn">الاسم بالإنجليزية</Label>
                <Input
                  id="nameEn"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder="Main Branch"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="address">العنوان</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="الرياض - حي النخيل"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0501234567"
                  className="mt-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">الفرع نشط</Label>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? "جاري الحفظ..." 
                  : editingId ? "تحديث" : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نافذة تأكيد الحذف */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                تأكيد الحذف
              </DialogTitle>
              <DialogDescription>
                هل أنت متأكد من حذف هذا الفرع؟ لا يمكن التراجع عن هذا الإجراء.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                إلغاء
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
