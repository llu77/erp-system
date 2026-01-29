import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Users, 
  Plus, 
  Pencil, 
  Trash2,
  Phone,
  Mail,
  Building2,
  Search,
  UserCircle,
  IdCard,
  Calendar,
  FileText,
  AlertTriangle
} from "lucide-react";

interface EmployeeFormData {
  code: string;
  name: string;
  phone: string;
  branchId: number | null;
  position: string;
  isActive: boolean;
  iqamaNumber: string;
  iqamaExpiryDate: string;
  healthCertExpiryDate: string;
  contractExpiryDate: string;
}

const initialFormData: EmployeeFormData = {
  code: "",
  name: "",
  phone: "",
  branchId: null,
  position: "",
  isActive: true,
  iqamaNumber: "",
  iqamaExpiryDate: "",
  healthCertExpiryDate: "",
  contractExpiryDate: "",
};

export default function Employees() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranchId, setFilterBranchId] = useState<string>("all");

  // جلب الموظفين
  const { data: employees, isLoading, refetch } = trpc.employees.list.useQuery();

  // جلب الفروع
  const { data: branches } = trpc.branches.list.useQuery();

  // إضافة موظف
  const createMutation = trpc.employees.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الموظف بنجاح");
      setShowDialog(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إضافة الموظف");
    },
  });

  // تعديل موظف
  const updateMutation = trpc.employees.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الموظف بنجاح");
      setShowDialog(false);
      setFormData(initialFormData);
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث الموظف");
    },
  });

  // حذف موظف
  const deleteMutation = trpc.employees.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الموظف بنجاح");
      setShowDeleteDialog(false);
      setDeletingId(null);
      refetch();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "فشل حذف الموظف");
    },
  });

  const handleSubmit = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("يرجى ملء الحقول المطلوبة");
      return;
    }

    if (editingId) {
      updateMutation.mutate({ 
        id: editingId, 
        code: formData.code,
        name: formData.name,
        phone: formData.phone || undefined,
        position: formData.position || undefined,
        branchId: formData.branchId || undefined,
        isActive: formData.isActive,
        iqamaNumber: formData.iqamaNumber || undefined,
        iqamaExpiryDate: formData.iqamaExpiryDate ? new Date(formData.iqamaExpiryDate) : undefined,
        healthCertExpiryDate: formData.healthCertExpiryDate ? new Date(formData.healthCertExpiryDate) : undefined,
        contractExpiryDate: formData.contractExpiryDate ? new Date(formData.contractExpiryDate) : undefined,
      });
    } else {
      createMutation.mutate({
        code: formData.code,
        name: formData.name,
        phone: formData.phone || undefined,
        position: formData.position || undefined,
        branchId: formData.branchId || undefined,
        isActive: formData.isActive,
        iqamaNumber: formData.iqamaNumber || undefined,
        iqamaExpiryDate: formData.iqamaExpiryDate ? new Date(formData.iqamaExpiryDate) : undefined,
        healthCertExpiryDate: formData.healthCertExpiryDate ? new Date(formData.healthCertExpiryDate) : undefined,
        contractExpiryDate: formData.contractExpiryDate ? new Date(formData.contractExpiryDate) : undefined,
      });
    }
  };

  const handleEdit = (employee: NonNullable<typeof employees>[number]) => {
    setEditingId(employee.id);
    setFormData({
      code: employee.code,
      name: employee.name,
      phone: employee.phone || "",
      branchId: employee.branchId,
      position: employee.position || "",
      isActive: employee.isActive,
      iqamaNumber: (employee as any).iqamaNumber || "",
      iqamaExpiryDate: (employee as any).iqamaExpiryDate ? new Date((employee as any).iqamaExpiryDate).toISOString().split('T')[0] : "",
      healthCertExpiryDate: (employee as any).healthCertExpiryDate ? new Date((employee as any).healthCertExpiryDate).toISOString().split('T')[0] : "",
      contractExpiryDate: (employee as any).contractExpiryDate ? new Date((employee as any).contractExpiryDate).toISOString().split('T')[0] : "",
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

  // الحصول على اسم الفرع
  const getBranchName = (branchId: number | null) => {
    if (!branchId || !branches) return "-";
    const branch = branches.find(b => b.id === branchId);
    return branch?.nameAr || "-";
  };

  // فلترة الموظفين
  const filteredEmployees = employees?.filter((employee) => {
    // المشرف يرى فقط موظفي فرعه
    if (user?.role === 'supervisor' && user?.branchId) {
      if (employee.branchId !== user.branchId) return false;
    }

    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.phone && employee.phone.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesBranch = filterBranchId === "all" || 
      (filterBranchId === "none" && !employee.branchId) ||
      employee.branchId?.toString() === filterBranchId;

    return matchesSearch && matchesBranch;
  });

  // التحقق من الصلاحيات - الأدمن والمدير والمشرف
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isSupervisor = user?.role === "supervisor";
  const isViewer = user?.role === "viewer";
  const userBranchId = user?.branchId;

  // المشرف يمكنه الوصول للصفحة ولكن فقط لموظفي فرعه
  // المشاهد يمكنه الرؤية فقط
  const canAccessPage = isAdmin || isManager || isSupervisor || isViewer;
  const canAdd = isAdmin || isManager; // فقط الأدمن والمدير يمكنهم الإضافة
  const canEdit = isAdmin || isManager || isSupervisor; // المشرف يمكنه التعديل لموظفي فرعه
  const canDelete = isAdmin; // فقط الأدمن يمكنه الحذف

  // التحقق من إمكانية تعديل موظف معين (المشرف يعدل فقط موظفي فرعه)
  const canEditEmployee = (employeeBranchId: number | null) => {
    if (isAdmin || isManager) return true;
    if (isSupervisor && userBranchId && employeeBranchId === userBranchId) return true;
    return false;
  };

  if (!canAccessPage) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-medium mb-2">غير مصرح</h3>
            <p className="text-muted-foreground">هذه الصفحة غير متاحة لك</p>
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
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              إدارة الموظفين
            </h1>
            <p className="text-muted-foreground">إضافة وتعديل وحذف الموظفين</p>
          </div>
{canAdd && (
          <Button onClick={openAddDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة موظف
          </Button>
          )}
        </div>

        {/* البحث والفلترة */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث في الموظفين..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={filterBranchId} onValueChange={setFilterBranchId}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  <SelectItem value="none">بدون فرع</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.nameAr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* جدول الموظفين */}
        <Card>
          <CardHeader>
            <CardTitle>قائمة الموظفين</CardTitle>
            <CardDescription>
              {filteredEmployees?.length || 0} موظف
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : filteredEmployees && filteredEmployees.length > 0 ? (
              isMobile ? (
                /* عرض البطاقات على الموبايل */
                <div className="space-y-3">
                  {filteredEmployees.map((employee) => (
                    <Card key={employee.id} className="border-r-4 border-r-primary">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <UserCircle className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{employee.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{employee.code}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant={employee.isActive ? "default" : "secondary"} className="text-xs">
                              {employee.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">الفرع</p>
                            <p className="font-medium flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {getBranchName(employee.branchId)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">المنصب</p>
                            <p className="font-medium">{employee.position || "-"}</p>
                          </div>
                          {employee.phone && (
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground">التواصل</p>
                              <p className="font-medium flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {employee.phone}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t pt-2">
                          {canEditEmployee(employee.branchId) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(employee)}
                            >
                              <Pencil className="h-4 w-4 ml-1" />
                              تعديل
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(employee.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 ml-1" />
                              حذف
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                /* عرض الجدول على الشاشات الكبيرة */
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الكود</TableHead>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">المنصب</TableHead>
                        <TableHead className="text-right">التواصل</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right w-24">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-mono">{employee.code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserCircle className="h-5 w-5 text-muted-foreground" />
                              <span className="font-medium">{employee.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {getBranchName(employee.branchId)}
                            </span>
                          </TableCell>
                          <TableCell>{employee.position || "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                              {employee.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {employee.phone}
                                </span>
                              )}
                              {!employee.phone && "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={employee.isActive ? "default" : "secondary"}>
                              {employee.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {canEditEmployee(employee.branchId) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(employee)}
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(employee.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
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
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">لا يوجد موظفين</h3>
                <p className="text-muted-foreground mb-4">ابدأ بإضافة موظف جديد</p>
                <Button onClick={openAddDialog} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة موظف
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* نافذة إضافة/تعديل موظف */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                {editingId ? "تعديل الموظف" : "إضافة موظف جديد"}
              </DialogTitle>
              <DialogDescription>
                {editingId ? "قم بتعديل بيانات الموظف" : "أدخل بيانات الموظف الجديد"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">كود الموظف *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="EMP001"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="name">الاسم *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="أحمد محمد"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="branchId">الفرع</Label>
                <Select
                  value={formData.branchId?.toString() || "none"}
                  onValueChange={(v) => setFormData({ ...formData, branchId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون فرع</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="position">المنصب</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="مندوب مبيعات"
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
              {/* قسم الوثائق والإقامة */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <IdCard className="h-4 w-4" />
                  بيانات الإقامة والوثائق
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="iqamaNumber">رقم الإقامة</Label>
                    <Input
                      id="iqamaNumber"
                      value={formData.iqamaNumber}
                      onChange={(e) => setFormData({ ...formData, iqamaNumber: e.target.value })}
                      placeholder="2xxxxxxxxx"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="iqamaExpiryDate">تاريخ انتهاء الإقامة</Label>
                    <Input
                      id="iqamaExpiryDate"
                      type="date"
                      value={formData.iqamaExpiryDate}
                      onChange={(e) => setFormData({ ...formData, iqamaExpiryDate: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="healthCertExpiryDate">تاريخ انتهاء الشهادة الصحية</Label>
                    <Input
                      id="healthCertExpiryDate"
                      type="date"
                      value={formData.healthCertExpiryDate}
                      onChange={(e) => setFormData({ ...formData, healthCertExpiryDate: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contractExpiryDate">تاريخ انتهاء عقد العمل</Label>
                    <Input
                      id="contractExpiryDate"
                      type="date"
                      value={formData.contractExpiryDate}
                      onChange={(e) => setFormData({ ...formData, contractExpiryDate: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">الموظف نشط</Label>
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
                هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.
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
