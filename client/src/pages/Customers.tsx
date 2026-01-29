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
  MobileCard,
  MobileCardList,
  useResponsiveView,
} from "@/components/ui/mobile-card-view";
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
import { Plus, Pencil, Trash2, UserCircle, Search, Phone, Mail } from "lucide-react";

type CustomerFormData = {
  name: string;
  email?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  city?: string;
  country?: string;
  taxNumber?: string;
  creditLimit?: string;
  notes?: string;
};

export default function CustomersPage() {
  const isMobileView = useResponsiveView(768);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: customers = [], isLoading } = trpc.customers.list.useQuery();

  const createForm = useForm<CustomerFormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      phone2: "",
      address: "",
      city: "",
      country: "السعودية",
      taxNumber: "",
      creditLimit: "0",
      notes: "",
    },
  });

  const editForm = useForm<CustomerFormData>();

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء العميل بنجاح");
      utils.customers.list.invalidate();
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الإنشاء");
    },
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث العميل بنجاح");
      utils.customers.list.invalidate();
      setEditingCustomer(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء التحديث");
    },
  });

  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف العميل بنجاح");
      utils.customers.list.invalidate();
      setDeleteCustomerId(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (data: CustomerFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    editForm.reset({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      phone2: customer.phone2 || "",
      address: customer.address || "",
      city: customer.city || "",
      country: customer.country || "",
      taxNumber: customer.taxNumber || "",
      creditLimit: customer.creditLimit || "0",
      notes: customer.notes || "",
    });
  };

  const handleUpdate = (data: CustomerFormData) => {
    if (!editingCustomer) return;
    updateMutation.mutate({
      id: editingCustomer.id,
      ...data,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <CardTitle>إدارة العملاء</CardTitle>
              <Badge variant="secondary">{customers.length}</Badge>
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
                إضافة عميل
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : isMobileView ? (
            /* Mobile Card View */
            <MobileCardList
              items={filteredCustomers}
              isLoading={isLoading}
              emptyMessage="لا يوجد عملاء"
              emptyIcon={<UserCircle className="h-12 w-12" />}
              renderCard={(customer) => (
                <MobileCard
                  key={customer.id}
                  fields={[
                    { label: "الاسم", value: customer.name, isTitle: true },
                    { label: "الرمز", value: customer.code, isSubtitle: true },
                    { 
                      label: "الهاتف", 
                      value: customer.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                      ) : "-",
                      isHighlighted: true
                    },
                    { 
                      label: "البريد", 
                      value: customer.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{customer.email}</span>
                        </span>
                      ) : "-"
                    },
                    { label: "المدينة", value: customer.city || "-" },
                  ]}
                  statusBadge={{
                    label: customer.isActive ? "نشط" : "غير نشط",
                    variant: customer.isActive ? "default" : "secondary",
                  }}
                  actions={[
                    {
                      label: "تعديل",
                      icon: <Pencil className="h-4 w-4" />,
                      onClick: () => handleEdit(customer),
                    },
                    {
                      label: "حذف",
                      icon: <Trash2 className="h-4 w-4" />,
                      onClick: () => setDeleteCustomerId(customer.id),
                      variant: "destructive",
                    },
                  ]}
                />
              )}
            />
          ) : (
            /* Desktop Table View */
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead className="hidden md:table-cell">البريد</TableHead>
                    <TableHead className="hidden lg:table-cell">المدينة</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="w-[100px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا يوجد عملاء
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-mono text-sm">{customer.code}</TableCell>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {customer.phone}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {customer.email ? (
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {customer.email}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{customer.city || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={customer.isActive ? "default" : "secondary"}>
                            {customer.isActive ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(customer)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteCustomerId(customer.id)}
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
            <DialogTitle>إضافة عميل جديد</DialogTitle>
            <DialogDescription>أدخل بيانات العميل الجديد</DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>اسم العميل *</Label>
                <Input {...createForm.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input {...createForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>هاتف آخر</Label>
                <Input {...createForm.register("phone2")} />
              </div>
              <div className="col-span-2 space-y-2">
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
                <Label>حد الائتمان</Label>
                <Input type="number" {...createForm.register("creditLimit")} />
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
      <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>تعديل العميل</DialogTitle>
            <DialogDescription>قم بتعديل بيانات العميل</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>اسم العميل *</Label>
                <Input {...editForm.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input {...editForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>هاتف آخر</Label>
                <Input {...editForm.register("phone2")} />
              </div>
              <div className="col-span-2 space-y-2">
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
                <Label>حد الائتمان</Label>
                <Input type="number" {...editForm.register("creditLimit")} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>ملاحظات</Label>
                <Textarea {...editForm.register("notes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>
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
      <Dialog open={!!deleteCustomerId} onOpenChange={() => setDeleteCustomerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCustomerId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteCustomerId && deleteMutation.mutate({ id: deleteCustomerId })}
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
