import { useState } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const notificationTypeLabels: Record<string, { label: string; color: string }> = {
  low_stock: { label: "نفاد المخزون", color: "bg-orange-500" },
  new_order: { label: "طلب جديد", color: "bg-blue-500" },
  large_sale: { label: "مبيعة كبيرة", color: "bg-green-500" },
  payment_due: { label: "دفعة مستحقة", color: "bg-red-500" },
  system: { label: "نظام", color: "bg-gray-500" },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: notifications = [], isLoading } = trpc.notifications.list.useQuery();
  const { data: unreadNotifications = [] } = trpc.notifications.unread.useQuery();

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unread.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unread.invalidate();
      toast.success("تم تحديد جميع الإشعارات كمقروءة");
    },
  });

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unread.invalidate();
      toast.success("تم حذف الإشعار");
    },
  });

  const unreadCount = unreadNotifications.length;

  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate({ id });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">الإشعارات</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              <CheckCheck className="h-4 w-4 ml-1" />
              تحديد الكل كمقروء
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p>لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const typeInfo = notificationTypeLabels[notification.type] || notificationTypeLabels.system;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 hover:bg-muted/50 transition-colors relative group",
                      !notification.isRead && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("w-2 h-2 rounded-full mt-2 flex-shrink-0", typeInfo.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                            {typeInfo.label}
                          </span>
                          {!notification.isRead && (
                            <span className="text-xs text-primary font-medium">جديد</span>
                          )}
                        </div>
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
