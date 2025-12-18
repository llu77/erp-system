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
import { Plus, Pencil, Trash2, Truck, Search, Phone, Mail, Globe } from "lucide-react";

type SupplierFormData = {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  website?: string;
  paymentTerms?: string;
  notes?: string;
};

export default function SuppliersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [deleteSupplierId, setDeleteSupplierId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery();

  const createForm = useForm<SupplierFormData>({
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      phone2: "",
      address: "",
      city: "",
      country: "السعودية",
      taxNumber: "",
      website: "",
      paymentTerms: "30 يوم",
      notes: "",
    },
  });

  const editForm = useForm<SupplierFormData>();

  const createMutation = trpc.suppliers.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المورد بنجاح");
      utils.suppliers.list.invalidate();
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الإنشاء");
    },
  });

  const updateMutation = trpc.suppliers.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث المورد بنجاح");
      utils.suppliers.list.invalidate();
      setEditingSupplier(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء التحديث");
    },
  });

  const deleteMutation = trpc.suppliers.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المورد بنجاح");
      utils.suppliers.list.invalidate();
      setDeleteSupplierId(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.phone?.includes(searchQuery) ||
      supplier.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (data: SupplierFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (supplier: any) => {
    setEditingSupplier(supplier);
    editForm.reset({
      name: supplier.name,
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      phone2: supplier.phone2 || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "",
      taxNumber: supplier.taxNumber || "",
      website: supplier.website || "",
      paymentTerms: supplier.paymentTerms || "",
      notes: supplier.notes || "",
    });
  };

  const handleUpdate = (data: SupplierFormData) => {
    if (!editingSupplier) return;
    updateMutation.mutate({
      id: editingSupplier.id,
      ...data,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle>إدارة الموردين</CardTitle>
              <Badge variant="secondary">{suppliers.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة مورد
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
                    <TableHead>الرمز</TableHead>
                    <TableHead>اسم المورد</TableHead>
                    <TableHead>جهة الاتصال</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>البريد</TableHead>
                    <TableHead>المدينة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-[100px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        لا يوجد موردين
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id}>
                        <TableCell className="font-mono text-sm">{supplier.code}</TableCell>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.contactPerson || "-"}</TableCell>
                        <TableCell>
                          {supplier.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {supplier.phone}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {supplier.email ? (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {supplier.email}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{supplier.city || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={supplier.isActive ? "default" : "secondary"}>
                            {supplier.isActive ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(supplier)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteSupplierId(supplier.id)}
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>إضافة مورد جديد</DialogTitle>
            <DialogDescription>أدخل بيانات المورد الجديد</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>اسم المورد *</Label>
                <Input {...createForm.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>جهة الاتصال</Label>
                <Input {...createForm.register("contactPerson")} />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input {...createForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>هاتف آخر</Label>
                <Input {...createForm.register("phone2")} />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" {...createForm.register("email")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>العنوان</Label>
                <Input {...createForm.register("address")} />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Input {...createForm.register("city")} />
              </div>
              <div className="space-y-2">
                <Label>الدولة</Label>
                <Input {...createForm.register("country")} />
              </div>
              <div className="space-y-2">
                <Label>الرقم الضريبي</Label>
                <Input {...createForm.register("taxNumber")} />
              </div>
              <div className="space-y-2">
                <Label>الموقع الإلكتروني</Label>
                <Input {...createForm.register("website")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>شروط الدفع</Label>
                <Input {...createForm.register("paymentTerms")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>ملاحظات</Label>
                <Textarea {...createForm.register("notes")} />
              </div>
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
      <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>تعديل المورد</DialogTitle>
            <DialogDescription>قم بتعديل بيانات المورد</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>اسم المورد *</Label>
                <Input {...editForm.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>جهة الاتصال</Label>
                <Input {...editForm.register("contactPerson")} />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input {...editForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>هاتف آخر</Label>
                <Input {...editForm.register("phone2")} />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" {...editForm.register("email")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>العنوان</Label>
                <Input {...editForm.register("address")} />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Input {...editForm.register("city")} />
              </div>
              <div className="space-y-2">
                <Label>الدولة</Label>
                <Input {...editForm.register("country")} />
              </div>
              <div className="space-y-2">
                <Label>الرقم الضريبي</Label>
                <Input {...editForm.register("taxNumber")} />
              </div>
              <div className="space-y-2">
                <Label>الموقع الإلكتروني</Label>
                <Input {...editForm.register("website")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>شروط الدفع</Label>
                <Input {...editForm.register("paymentTerms")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>ملاحظات</Label>
                <Textarea {...editForm.register("notes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingSupplier(null)}>
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
      <Dialog open={!!deleteSupplierId} onOpenChange={() => setDeleteSupplierId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSupplierId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteSupplierId && deleteMutation.mutate({ id: deleteSupplierId })}
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
