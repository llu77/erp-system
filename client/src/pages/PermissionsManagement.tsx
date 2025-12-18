import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Shield, 
  Users,
  Lock,
  Unlock,
  RefreshCw,
  Settings
} from "lucide-react";

export default function PermissionsManagement() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // جلب قائمة المستخدمين
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery();

  // جلب جميع الصلاحيات
  const { data: allPermissions, isLoading: permissionsLoading } = trpc.permissions.list.useQuery();

  // جلب صلاحيات المستخدم المحدد
  const { data: userPermissions, isLoading: userPermissionsLoading } = trpc.permissions.userPermissions.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );

  // تهيئة الصلاحيات الافتراضية
  const initializePermissions = trpc.permissions.initialize.useMutation({
    onSuccess: () => {
      utils.permissions.list.invalidate();
      toast.success('تم تهيئة الصلاحيات الافتراضية');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // منح صلاحية
  const grantPermission = trpc.permissions.grant.useMutation({
    onSuccess: () => {
      utils.permissions.userPermissions.invalidate();
      toast.success('تم منح الصلاحية');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // إلغاء صلاحية
  const revokePermission = trpc.permissions.revoke.useMutation({
    onSuccess: () => {
      utils.permissions.userPermissions.invalidate();
      toast.success('تم إلغاء الصلاحية');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      users: 'المستخدمين',
      products: 'المنتجات',
      invoices: 'الفواتير',
      purchases: 'المشتريات',
      reports: 'التقارير',
      settings: 'الإعدادات',
      security: 'الأمان',
    };
    return labels[category] || category;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'users':
        return <Users className="h-4 w-4" />;
      case 'security':
        return <Shield className="h-4 w-4" />;
      case 'settings':
        return <Settings className="h-4 w-4" />;
      default:
        return <Lock className="h-4 w-4" />;
    }
  };

  // تجميع الصلاحيات حسب الفئة
  const groupedPermissions = allPermissions?.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof allPermissions>);

  const hasPermission = (permissionId: number) => {
    return userPermissions?.some(p => p.permissionId === permissionId);
  };

  const handlePermissionToggle = (permissionId: number) => {
    if (!selectedUserId) return;

    if (hasPermission(permissionId)) {
      revokePermission.mutate({ userId: selectedUserId, permissionId });
    } else {
      grantPermission.mutate({ userId: selectedUserId, permissionId });
    }
  };

  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            إدارة الصلاحيات
          </h1>
          <p className="text-muted-foreground">تحكم في صلاحيات المستخدمين بشكل تفصيلي</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => initializePermissions.mutate()}
          disabled={initializePermissions.isPending}
        >
          <RefreshCw className={`h-4 w-4 ml-2 ${initializePermissions.isPending ? 'animate-spin' : ''}`} />
          تهيئة الصلاحيات الافتراضية
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* قائمة المستخدمين */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>المستخدمين</CardTitle>
            <CardDescription>اختر مستخدم لإدارة صلاحياته</CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {users?.map((user) => (
                  <div
                    key={user.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedUserId === user.id 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{user.name || 'بدون اسم'}</div>
                        <div className={`text-xs ${selectedUserId === user.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {user.email || user.phone || '-'}
                        </div>
                      </div>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'مدير' : 'مستخدم'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* صلاحيات المستخدم */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedUserId 
                ? `صلاحيات: ${users?.find(u => u.id === selectedUserId)?.name || 'المستخدم'}`
                : 'الصلاحيات'
              }
            </CardTitle>
            <CardDescription>
              {selectedUserId 
                ? 'حدد الصلاحيات التي تريد منحها لهذا المستخدم'
                : 'اختر مستخدم من القائمة لإدارة صلاحياته'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedUserId ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>اختر مستخدم من القائمة لعرض وتعديل صلاحياته</p>
              </div>
            ) : permissionsLoading || userPermissionsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : !allPermissions || allPermissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد صلاحيات معرفة</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => initializePermissions.mutate()}
                >
                  تهيئة الصلاحيات الافتراضية
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedPermissions || {}).map(([category, permissions]) => (
                  <div key={category} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      {getCategoryIcon(category)}
                      <h3 className="font-semibold">{getCategoryLabel(category)}</h3>
                      <Badge variant="outline" className="mr-auto">
                        {permissions?.filter(p => hasPermission(p.id)).length || 0} / {permissions?.length || 0}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {permissions?.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center space-x-2 space-x-reverse p-2 rounded-lg hover:bg-muted"
                        >
                          <Checkbox
                            id={`perm-${permission.id}`}
                            checked={hasPermission(permission.id)}
                            onCheckedChange={() => handlePermissionToggle(permission.id)}
                            disabled={grantPermission.isPending || revokePermission.isPending}
                          />
                          <label
                            htmlFor={`perm-${permission.id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium text-sm">{permission.nameAr}</div>
                            <div className="text-xs text-muted-foreground">{permission.code}</div>
                          </label>
                          {hasPermission(permission.id) ? (
                            <Unlock className="h-4 w-4 text-green-500" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
