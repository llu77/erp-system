import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Mail, Trash2, Edit, Send, Users, Building2, Shield, CheckCircle, XCircle, Bell, BellOff } from "lucide-react";

export default function NotificationRecipients() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [testEmail, setTestEmail] = useState("");
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "admin" as "admin" | "general_supervisor" | "branch_supervisor",
    branchId: undefined as number | undefined,
    branchName: "",
  });

  // Queries
  const { data: recipients, refetch } = trpc.emailRecipients.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: sentLogs } = trpc.emailRecipients.getSentLogs.useQuery({ limit: 20 });

  // Mutations
  const addRecipient = trpc.emailRecipients.add.useMutation({
    onSuccess: () => {
      toast({ title: "تم بنجاح", description: "تم إضافة المستلم بنجاح" });
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateRecipient = trpc.emailRecipients.update.useMutation({
    onSuccess: () => {
      toast({ title: "تم بنجاح", description: "تم تحديث المستلم بنجاح" });
      setIsEditDialogOpen(false);
      setSelectedRecipient(null);
      refetch();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteRecipient = trpc.emailRecipients.delete.useMutation({
    onSuccess: () => {
      toast({ title: "تم بنجاح", description: "تم حذف المستلم بنجاح" });
      refetch();
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const sendTest = trpc.emailRecipients.sendTest.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast({ title: "تم بنجاح", description: "تم إرسال البريد الاختباري بنجاح" });
      } else {
        toast({ title: "فشل", description: result.error || "فشل إرسال البريد", variant: "destructive" });
      }
      setTestEmail("");
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      role: "admin",
      branchId: undefined,
      branchName: "",
    });
  };

  const handleAdd = () => {
    addRecipient.mutate(formData);
  };

  const handleUpdate = (data: any) => {
    if (!selectedRecipient) return;
    updateRecipient.mutate({ id: selectedRecipient.id, ...data });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا المستلم؟")) {
      deleteRecipient.mutate({ id });
    }
  };

  const handleSendTest = () => {
    if (!testEmail) {
      toast({ title: "خطأ", description: "يرجى إدخال البريد الإلكتروني", variant: "destructive" });
      return;
    }
    sendTest.mutate({ email: testEmail });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Shield className="w-3 h-3 ml-1" />مسؤول النظام</Badge>;
      case "general_supervisor":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Users className="w-3 h-3 ml-1" />المشرف العام</Badge>;
      case "branch_supervisor":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><Building2 className="w-3 h-3 ml-1" />مشرف فرع</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6" />
            إدارة مستلمي الإشعارات
          </h1>
          <p className="text-gray-400 mt-1">إعداد وإدارة قائمة مستلمي إشعارات البريد الإلكتروني</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Send className="w-4 h-4" />
                إرسال بريد اختباري
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إرسال بريد اختباري</DialogTitle>
                <DialogDescription>أدخل البريد الإلكتروني لإرسال رسالة اختبارية</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSendTest} disabled={sendTest.isPending}>
                  {sendTest.isPending ? "جاري الإرسال..." : "إرسال"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600">
                <Plus className="w-4 h-4" />
                إضافة مستلم
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة مستلم جديد</DialogTitle>
                <DialogDescription>أضف مستلم جديد لإشعارات البريد الإلكتروني</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>الاسم</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="اسم المستلم"
                  />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الدور</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">مسؤول النظام (يستقبل كل الإشعارات)</SelectItem>
                      <SelectItem value="general_supervisor">المشرف العام (يستقبل كل الإشعارات)</SelectItem>
                      <SelectItem value="branch_supervisor">مشرف فرع (يستقبل إشعارات فرعه فقط)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role === "branch_supervisor" && (
                  <div className="space-y-2">
                    <Label>الفرع</Label>
                    <Select
                      value={formData.branchId?.toString() || ""}
                      onValueChange={(value) => {
                        const branch = branches?.find((b: any) => b.id.toString() === value);
                        setFormData({
                          ...formData,
                          branchId: parseInt(value),
                          branchName: branch?.name || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch: any) => (
                          <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
                <Button onClick={handleAdd} disabled={addRecipient.isPending}>
                  {addRecipient.isPending ? "جاري الإضافة..." : "إضافة"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Recipients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipients?.map((recipient: any) => (
          <Card key={recipient.id} className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    {recipient.name}
                    {recipient.isActive ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-gray-400 mt-1" dir="ltr">
                    {recipient.email}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setSelectedRecipient(recipient);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(recipient.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {getRoleBadge(recipient.role)}
                {recipient.branchName && (
                  <Badge variant="outline" className="text-gray-300">
                    <Building2 className="w-3 h-3 ml-1" />
                    {recipient.branchName}
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {recipient.receiveRevenueAlerts ? <Bell className="w-3 h-3 text-green-400" /> : <BellOff className="w-3 h-3 text-gray-500" />}
                  <span className={recipient.receiveRevenueAlerts ? "text-gray-300" : "text-gray-500"}>تنبيهات الإيرادات</span>
                </div>
                <div className="flex items-center gap-1">
                  {recipient.receiveExpenseAlerts ? <Bell className="w-3 h-3 text-green-400" /> : <BellOff className="w-3 h-3 text-gray-500" />}
                  <span className={recipient.receiveExpenseAlerts ? "text-gray-300" : "text-gray-500"}>تنبيهات المصاريف</span>
                </div>
                <div className="flex items-center gap-1">
                  {recipient.receiveMismatchAlerts ? <Bell className="w-3 h-3 text-green-400" /> : <BellOff className="w-3 h-3 text-gray-500" />}
                  <span className={recipient.receiveMismatchAlerts ? "text-gray-300" : "text-gray-500"}>عدم التطابق</span>
                </div>
                <div className="flex items-center gap-1">
                  {recipient.receiveMonthlyReminders ? <Bell className="w-3 h-3 text-green-400" /> : <BellOff className="w-3 h-3 text-gray-500" />}
                  <span className={recipient.receiveMonthlyReminders ? "text-gray-300" : "text-gray-500"}>التذكيرات الشهرية</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل إعدادات المستلم</DialogTitle>
            <DialogDescription>تعديل بيانات وإعدادات إشعارات {selectedRecipient?.name}</DialogDescription>
          </DialogHeader>
          {selectedRecipient && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الاسم</Label>
                  <Input
                    value={selectedRecipient.name}
                    onChange={(e) => setSelectedRecipient({ ...selectedRecipient, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={selectedRecipient.email}
                    onChange={(e) => setSelectedRecipient({ ...selectedRecipient, email: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>الحالة</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={selectedRecipient.isActive}
                    onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, isActive: checked })}
                  />
                  <span className="text-sm text-gray-400">{selectedRecipient.isActive ? "نشط" : "غير نشط"}</span>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h4 className="font-medium text-white mb-4">إعدادات الإشعارات</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">تنبيهات الإيرادات المنخفضة</span>
                    <Switch
                      checked={selectedRecipient.receiveRevenueAlerts}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveRevenueAlerts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">تنبيهات المصاريف المرتفعة</span>
                    <Switch
                      checked={selectedRecipient.receiveExpenseAlerts}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveExpenseAlerts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">تنبيهات عدم التطابق</span>
                    <Switch
                      checked={selectedRecipient.receiveMismatchAlerts}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveMismatchAlerts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">تنبيهات المخزون</span>
                    <Switch
                      checked={selectedRecipient.receiveInventoryAlerts}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveInventoryAlerts: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">التذكيرات الشهرية</span>
                    <Switch
                      checked={selectedRecipient.receiveMonthlyReminders}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveMonthlyReminders: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">إشعارات الطلبات</span>
                    <Switch
                      checked={selectedRecipient.receiveRequestNotifications}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveRequestNotifications: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">التقارير الدورية</span>
                    <Switch
                      checked={selectedRecipient.receiveReportNotifications}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveReportNotifications: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <span className="text-sm">إشعارات البونص</span>
                    <Switch
                      checked={selectedRecipient.receiveBonusNotifications}
                      onCheckedChange={(checked) => setSelectedRecipient({ ...selectedRecipient, receiveBonusNotifications: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => handleUpdate(selectedRecipient)} disabled={updateRecipient.isPending}>
              {updateRecipient.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recent Sent Notifications */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Mail className="w-5 h-5" />
            آخر الإشعارات المرسلة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sentLogs?.slice(0, 10).map((log: any) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {log.status === "sent" ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm text-white">{log.subject}</p>
                    <p className="text-xs text-gray-400">{log.recipientEmail}</p>
                  </div>
                </div>
                <div className="text-left">
                  <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                    {log.status === "sent" ? "تم الإرسال" : "فشل"}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString("ar-SA") : "-"}
                  </p>
                </div>
              </div>
            ))}
            {(!sentLogs || sentLogs.length === 0) && (
              <p className="text-center text-gray-500 py-4">لا توجد إشعارات مرسلة بعد</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
