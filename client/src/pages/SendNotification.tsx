import { useState } from "react";
import { useForm } from "react-hook-form";
import { Bell, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type NotificationFormData = {
  title: string;
  message: string;
  type: "low_stock" | "new_order" | "large_sale" | "payment_due" | "system";
  userId?: string;
};

const notificationTypes = [
  { value: "system", label: "إشعار عام", icon: "🔔" },
  { value: "low_stock", label: "تنبيه مخزون", icon: "📦" },
  { value: "new_order", label: "طلب جديد", icon: "🛒" },
  { value: "large_sale", label: "مبيعة كبيرة", icon: "💰" },
  { value: "payment_due", label: "دفعة مستحقة", icon: "💳" },
];

export default function SendNotification() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: users = [] } = trpc.users.list.useQuery();

  const form = useForm<NotificationFormData>({
    defaultValues: {
      title: "",
      message: "",
      type: "system",
      userId: "",
    },
  });

  const sendNotificationMutation = trpc.notifications.sendCustom.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال الإشعار بنجاح");
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إرسال الإشعار");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = (data: NotificationFormData) => {
    setIsSubmitting(true);
    sendNotificationMutation.mutate({
      title: data.title,
      message: data.message,
      type: data.type,
      userId: data.userId ? parseInt(data.userId) : undefined,
    });
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl" dir="rtl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>إرسال إشعار مخصص</CardTitle>
              <CardDescription>
                أرسل إشعاراً لمستخدم محدد أو لجميع المستخدمين
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع الإشعار</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر نوع الإشعار" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {notificationTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                              <span>{type.icon}</span>
                              <span>{type.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المستلم</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المستلم (اتركه فارغاً للإرسال للجميع)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>جميع المستخدمين</span>
                          </span>
                        </SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            <span className="flex items-center gap-2">
                              <span>{user.name || user.email || `مستخدم #${user.id}`}</span>
                              <span className="text-xs text-muted-foreground">
                                ({user.role === "admin" ? "مسؤول" : user.role === "manager" ? "مدير" : "موظف"})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      اترك الحقل فارغاً لإرسال الإشعار لجميع المستخدمين
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>عنوان الإشعار</FormLabel>
                    <FormControl>
                      <Input placeholder="أدخل عنوان الإشعار" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نص الإشعار</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="أدخل نص الإشعار"
                        className="min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 ml-2" />
                    إرسال الإشعار
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
