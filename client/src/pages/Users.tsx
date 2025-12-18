import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pencil, Trash2, Users as UsersIcon, Shield, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "admin" | "manager" | "employee";
  department: string | null;
  position: string | null;
  isActive: boolean;
  createdAt: Date;
  lastSignedIn: Date;
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery();

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث المستخدم بنجاح");
      utils.users.list.invalidate();
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء التحديث");
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المستخدم بنجاح");
      utils.users.list.invalidate();
      setDeleteUserId(null);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.includes(searchQuery)
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">مسؤول</Badge>;
      case "manager":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">مدير</Badge>;
      case "employee":
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">موظف</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const handleUpdate = () => {
    if (!editingUser) return;
    updateMutation.mutate({
      id: editingUser.id,
      name: editingUser.name || undefined,
      email: editingUser.email || undefined,
      phone: editingUser.phone || undefined,
      role: editingUser.role,
      department: editingUser.department || undefined,
      position: editingUser.position || undefined,
      isActive: editingUser.isActive,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              <CardTitle>إدارة المستخدمين</CardTitle>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
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
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>آخر دخول</TableHead>
                    <TableHead className="w-[100px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        لا يوجد مستخدمين
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name || "-"}
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="mr-2 text-xs">
                              أنت
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>{user.phone || "-"}</TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>{user.department || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "نشط" : "غير نشط"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDistanceToNow(new Date(user.lastSignedIn), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingUser(user as User)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteUserId(user.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              تعديل المستخدم
            </DialogTitle>
            <DialogDescription>
              قم بتعديل بيانات وصلاحيات المستخدم
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>الاسم</Label>
                <Input
                  value={editingUser.name || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, email: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>الهاتف</Label>
                <Input
                  value={editingUser.phone || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, phone: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>الدور</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(value: "admin" | "manager" | "employee") =>
                      setEditingUser({ ...editingUser, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">مسؤول</SelectItem>
                      <SelectItem value="manager">مدير</SelectItem>
                      <SelectItem value="employee">موظف</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>القسم</Label>
                  <Input
                    value={editingUser.department || ""}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, department: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>المنصب</Label>
                <Input
                  value={editingUser.position || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, position: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>الحالة</Label>
                <Switch
                  checked={editingUser.isActive}
                  onCheckedChange={(checked) =>
                    setEditingUser({ ...editingUser, isActive: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              إلغاء
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserId && deleteMutation.mutate({ id: deleteUserId })}
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
