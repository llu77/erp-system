import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, FileText, Calendar, DollarSign, Clock, AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const requestTypes = [
  { value: "advance", label: "سلفة مالية", icon: DollarSign, color: "text-green-500" },
  { value: "vacation", label: "إجازة", icon: Calendar, color: "text-blue-500" },
  { value: "arrears", label: "صرف متأخرات", icon: DollarSign, color: "text-yellow-500" },
  { value: "permission", label: "استئذان", icon: Clock, color: "text-purple-500" },
  { value: "objection", label: "اعتراض على مخالفة", icon: AlertTriangle, color: "text-red-500" },
  { value: "resignation", label: "استقالة", icon: LogOut, color: "text-gray-500" },
];

const vacationTypes = [
  { value: "annual", label: "إجازة سنوية" },
  { value: "sick", label: "إجازة مرضية" },
  { value: "emergency", label: "إجازة طارئة" },
  { value: "unpaid", label: "إجازة بدون راتب" },
];

const priorities = [
  { value: "low", label: "منخفضة" },
  { value: "normal", label: "عادية" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];

export default function SubmitRequest() {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // الحصول على قائمة الموظفين والفروع
  const { data: employees } = trpc.employees.list.useQuery();
  const { data: branches } = trpc.branches.list.useQuery();
  const { data: myRequests, refetch: refetchMyRequests } = trpc.employeeRequests.myRequests.useQuery();

  // حالة النموذج
  const [formData, setFormData] = useState({
    employeeId: 0,
    employeeName: "",
    branchId: undefined as number | undefined,
    branchName: "",
    title: "",
    description: "",
    priority: "normal" as "low" | "normal" | "high" | "urgent",
    // سلفة
    advanceAmount: "",
    advanceReason: "",
    repaymentMethod: "",
    // إجازة
    vacationType: "",
    vacationStartDate: "",
    vacationEndDate: "",
    vacationDays: "",
    // متأخرات
    arrearsAmount: "",
    arrearsPeriod: "",
    arrearsDetails: "",
    // استئذان
    permissionDate: "",
    permissionStartTime: "",
    permissionEndTime: "",
    permissionHours: "",
    permissionReason: "",
    // اعتراض
    objectionType: "",
    objectionDate: "",
    objectionDetails: "",
    // استقالة
    resignationDate: "",
    resignationReason: "",
    lastWorkingDay: "",
    noticePeriod: "",
  });

  const createMutation = trpc.employeeRequests.create.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تقديم الطلب بنجاح - رقم الطلب: ${data.requestNumber}`);
      setSelectedType("");
      setFormData({
        employeeId: 0,
        employeeName: "",
        branchId: undefined,
        branchName: "",
        title: "",
        description: "",
        priority: "normal",
        advanceAmount: "",
        advanceReason: "",
        repaymentMethod: "",
        vacationType: "",
        vacationStartDate: "",
        vacationEndDate: "",
        vacationDays: "",
        arrearsAmount: "",
        arrearsPeriod: "",
        arrearsDetails: "",
        permissionDate: "",
        permissionStartTime: "",
        permissionEndTime: "",
        permissionHours: "",
        permissionReason: "",
        objectionType: "",
        objectionDate: "",
        objectionDetails: "",
        resignationDate: "",
        resignationReason: "",
        lastWorkingDay: "",
        noticePeriod: "",
      });
      refetchMyRequests();
      setIsSubmitting(false);
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "فشل تقديم الطلب");
      setIsSubmitting(false);
    },
  });

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employees?.find(e => e.id === parseInt(employeeId));
    if (employee) {
      const branch = branches?.find(b => b.id === employee.branchId);
      setFormData({
        ...formData,
        employeeId: employee.id,
        employeeName: employee.name,
        branchId: employee.branchId,
        branchName: branch?.nameAr || "",
      });
    }
  };

  const handleSubmit = () => {
    if (!selectedType) {
      toast.error("يرجى اختيار نوع الطلب");
      return;
    }
    if (!formData.employeeId) {
      toast.error("يرجى اختيار الموظف");
      return;
    }
    if (!formData.title.trim()) {
      toast.error("يرجى إدخال عنوان الطلب");
      return;
    }

    setIsSubmitting(true);

    const requestData: Parameters<typeof createMutation.mutate>[0] = {
      employeeId: formData.employeeId,
      employeeName: formData.employeeName,
      branchId: formData.branchId,
      branchName: formData.branchName,
      requestType: selectedType as "advance" | "vacation" | "arrears" | "permission" | "objection" | "resignation",
      title: formData.title,
      description: formData.description || undefined,
      priority: formData.priority,
    };

    // إضافة الحقول حسب نوع الطلب
    if (selectedType === "advance") {
      requestData.advanceAmount = formData.advanceAmount ? parseFloat(formData.advanceAmount) : undefined;
      requestData.advanceReason = formData.advanceReason || undefined;
      requestData.repaymentMethod = formData.repaymentMethod || undefined;
    } else if (selectedType === "vacation") {
      requestData.vacationType = formData.vacationType || undefined;
      requestData.vacationStartDate = formData.vacationStartDate ? new Date(formData.vacationStartDate) : undefined;
      requestData.vacationEndDate = formData.vacationEndDate ? new Date(formData.vacationEndDate) : undefined;
      requestData.vacationDays = formData.vacationDays ? parseInt(formData.vacationDays) : undefined;
    } else if (selectedType === "arrears") {
      requestData.arrearsAmount = formData.arrearsAmount ? parseFloat(formData.arrearsAmount) : undefined;
      requestData.arrearsPeriod = formData.arrearsPeriod || undefined;
      requestData.arrearsDetails = formData.arrearsDetails || undefined;
    } else if (selectedType === "permission") {
      requestData.permissionDate = formData.permissionDate ? new Date(formData.permissionDate) : undefined;
      requestData.permissionStartTime = formData.permissionStartTime || undefined;
      requestData.permissionEndTime = formData.permissionEndTime || undefined;
      requestData.permissionHours = formData.permissionHours ? parseFloat(formData.permissionHours) : undefined;
      requestData.permissionReason = formData.permissionReason || undefined;
    } else if (selectedType === "objection") {
      requestData.objectionType = formData.objectionType || undefined;
      requestData.objectionDate = formData.objectionDate ? new Date(formData.objectionDate) : undefined;
      requestData.objectionDetails = formData.objectionDetails || undefined;
    } else if (selectedType === "resignation") {
      requestData.resignationDate = formData.resignationDate ? new Date(formData.resignationDate) : undefined;
      requestData.resignationReason = formData.resignationReason || undefined;
      requestData.lastWorkingDay = formData.lastWorkingDay ? new Date(formData.lastWorkingDay) : undefined;
      requestData.noticePeriod = formData.noticePeriod ? parseInt(formData.noticePeriod) : undefined;
    }

    createMutation.mutate(requestData);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      approved: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
      cancelled: "bg-gray-500/20 text-gray-400",
    };
    const labels: Record<string, string> = {
      pending: "قيد الانتظار",
      approved: "موافق عليه",
      rejected: "مرفوض",
      cancelled: "ملغي",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeName = (type: string) => {
    const found = requestTypes.find(t => t.value === type);
    return found?.label || type;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تقديم طلب</h1>
          <p className="text-muted-foreground">اختر نوع الطلب وقم بتعبئة البيانات المطلوبة</p>
        </div>
      </div>

      {/* اختيار نوع الطلب */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {requestTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Card
              key={type.value}
              className={`cursor-pointer transition-all hover:scale-105 ${
                selectedType === type.value
                  ? "ring-2 ring-primary bg-primary/10"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => setSelectedType(type.value)}
            >
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <Icon className={`h-8 w-8 ${type.color}`} />
                <span className="text-sm font-medium">{type.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* نموذج الطلب */}
      {selectedType && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              نموذج طلب {getTypeName(selectedType)}
            </CardTitle>
            <CardDescription>
              يرجى ملء جميع الحقول المطلوبة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* البيانات الأساسية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الموظف *</Label>
                <Select
                  value={formData.employeeId?.toString() || ""}
                  onValueChange={handleEmployeeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الموظف" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.name} ({emp.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الفرع</Label>
                <Input value={formData.branchName} disabled />
              </div>

              <div className="space-y-2">
                <Label>عنوان الطلب *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="أدخل عنوان الطلب"
                />
              </div>

              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v as "low" | "normal" | "high" | "urgent" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>وصف الطلب</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="أدخل تفاصيل إضافية عن الطلب"
                rows={3}
              />
            </div>

            {/* حقول السلفة */}
            {selectedType === "advance" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>مبلغ السلفة (ر.س) *</Label>
                  <Input
                    type="number"
                    value={formData.advanceAmount}
                    onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>سبب السلفة</Label>
                  <Input
                    value={formData.advanceReason}
                    onChange={(e) => setFormData({ ...formData, advanceReason: e.target.value })}
                    placeholder="سبب طلب السلفة"
                  />
                </div>
                <div className="space-y-2">
                  <Label>طريقة السداد</Label>
                  <Select
                    value={formData.repaymentMethod}
                    onValueChange={(v) => setFormData({ ...formData, repaymentMethod: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر طريقة السداد" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary_deduction">خصم من الراتب</SelectItem>
                      <SelectItem value="installments">أقساط شهرية</SelectItem>
                      <SelectItem value="full_payment">دفعة واحدة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* حقول الإجازة */}
            {selectedType === "vacation" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>نوع الإجازة *</Label>
                  <Select
                    value={formData.vacationType}
                    onValueChange={(v) => setFormData({ ...formData, vacationType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع الإجازة" />
                    </SelectTrigger>
                    <SelectContent>
                      {vacationTypes.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>تاريخ البداية *</Label>
                  <Input
                    type="date"
                    value={formData.vacationStartDate}
                    onChange={(e) => setFormData({ ...formData, vacationStartDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ النهاية *</Label>
                  <Input
                    type="date"
                    value={formData.vacationEndDate}
                    onChange={(e) => setFormData({ ...formData, vacationEndDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>عدد الأيام</Label>
                  <Input
                    type="number"
                    value={formData.vacationDays}
                    onChange={(e) => setFormData({ ...formData, vacationDays: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* حقول صرف المتأخرات */}
            {selectedType === "arrears" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>المبلغ المستحق (ر.س) *</Label>
                  <Input
                    type="number"
                    value={formData.arrearsAmount}
                    onChange={(e) => setFormData({ ...formData, arrearsAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الفترة</Label>
                  <Input
                    value={formData.arrearsPeriod}
                    onChange={(e) => setFormData({ ...formData, arrearsPeriod: e.target.value })}
                    placeholder="مثال: شهر يناير 2024"
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label>تفاصيل المتأخرات</Label>
                  <Textarea
                    value={formData.arrearsDetails}
                    onChange={(e) => setFormData({ ...formData, arrearsDetails: e.target.value })}
                    placeholder="تفاصيل إضافية عن المتأخرات"
                  />
                </div>
              </div>
            )}

            {/* حقول الاستئذان */}
            {selectedType === "permission" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>تاريخ الاستئذان *</Label>
                  <Input
                    type="date"
                    value={formData.permissionDate}
                    onChange={(e) => setFormData({ ...formData, permissionDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>وقت البداية *</Label>
                  <Input
                    type="time"
                    value={formData.permissionStartTime}
                    onChange={(e) => setFormData({ ...formData, permissionStartTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>وقت النهاية *</Label>
                  <Input
                    type="time"
                    value={formData.permissionEndTime}
                    onChange={(e) => setFormData({ ...formData, permissionEndTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>عدد الساعات</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={formData.permissionHours}
                    onChange={(e) => setFormData({ ...formData, permissionHours: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2 md:col-span-4">
                  <Label>سبب الاستئذان</Label>
                  <Textarea
                    value={formData.permissionReason}
                    onChange={(e) => setFormData({ ...formData, permissionReason: e.target.value })}
                    placeholder="سبب طلب الاستئذان"
                  />
                </div>
              </div>
            )}

            {/* حقول الاعتراض */}
            {selectedType === "objection" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>نوع المخالفة *</Label>
                  <Input
                    value={formData.objectionType}
                    onChange={(e) => setFormData({ ...formData, objectionType: e.target.value })}
                    placeholder="نوع المخالفة المعترض عليها"
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ المخالفة</Label>
                  <Input
                    type="date"
                    value={formData.objectionDate}
                    onChange={(e) => setFormData({ ...formData, objectionDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>تفاصيل الاعتراض *</Label>
                  <Textarea
                    value={formData.objectionDetails}
                    onChange={(e) => setFormData({ ...formData, objectionDetails: e.target.value })}
                    placeholder="اشرح سبب اعتراضك بالتفصيل"
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* حقول الاستقالة */}
            {selectedType === "resignation" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>تاريخ تقديم الاستقالة *</Label>
                  <Input
                    type="date"
                    value={formData.resignationDate}
                    onChange={(e) => setFormData({ ...formData, resignationDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>آخر يوم عمل</Label>
                  <Input
                    type="date"
                    value={formData.lastWorkingDay}
                    onChange={(e) => setFormData({ ...formData, lastWorkingDay: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>فترة الإشعار (بالأيام)</Label>
                  <Input
                    type="number"
                    value={formData.noticePeriod}
                    onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                    placeholder="30"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>سبب الاستقالة</Label>
                  <Textarea
                    value={formData.resignationReason}
                    onChange={(e) => setFormData({ ...formData, resignationReason: e.target.value })}
                    placeholder="سبب تقديم الاستقالة"
                    rows={3}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedType("")}>
                إلغاء
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 ml-2" />
                    تقديم الطلب
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* طلباتي السابقة */}
      <Card>
        <CardHeader>
          <CardTitle>طلباتي السابقة</CardTitle>
          <CardDescription>عرض جميع الطلبات التي قدمتها</CardDescription>
        </CardHeader>
        <CardContent>
          {!myRequests || myRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد طلبات سابقة
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-3 px-4">رقم الطلب</th>
                    <th className="text-right py-3 px-4">النوع</th>
                    <th className="text-right py-3 px-4">العنوان</th>
                    <th className="text-right py-3 px-4">الحالة</th>
                    <th className="text-right py-3 px-4">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((request) => (
                    <tr key={request.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-mono text-sm">{request.requestNumber}</td>
                      <td className="py-3 px-4">{getTypeName(request.requestType)}</td>
                      <td className="py-3 px-4">{request.title}</td>
                      <td className="py-3 px-4">{getStatusBadge(request.status)}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
