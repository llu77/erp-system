/**
 * NotificationBell Component
 * جرس الإشعارات مع عداد الإشعارات غير المقروءة
 */

import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface NotificationBellProps {
  employeeId: number;
  className?: string;
}

// أيقونات حسب نوع الإشعار
const notificationIcons: Record<string, { icon: string; color: string }> = {
  request_approved: { icon: "✅", color: "bg-green-100 text-green-600" },
  request_rejected: { icon: "❌", color: "bg-red-100 text-red-600" },
  request_pending: { icon: "⏳", color: "bg-yellow-100 text-yellow-600" },
  document_expiring: { icon: "⚠️", color: "bg-orange-100 text-orange-600" },
  document_expired: { icon: "🚨", color: "bg-red-100 text-red-600" },
  salary_ready: { icon: "💰", color: "bg-emerald-100 text-emerald-600" },
  bonus_approved: { icon: "🎉", color: "bg-purple-100 text-purple-600" },
  announcement: { icon: "📢", color: "bg-blue-100 text-blue-600" },
  task_assigned: { icon: "📋", color: "bg-indigo-100 text-indigo-600" },
  reminder: { icon: "🔔", color: "bg-amber-100 text-amber-600" },
  system: { icon: "ℹ️", color: "bg-gray-100 text-gray-600" },
};

// ألوان الأولوية
const priorityColors: Record<string, string> = {
  low: "border-l-gray-300",
  normal: "border-l-blue-400",
  high: "border-l-orange-500",
  urgent: "border-l-red-600",
};

export function NotificationBell({ employeeId, className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // جلب عدد الإشعارات غير المقروءة
  const { data: unreadCount = 0 } = trpc.portalNotifications.getUnreadCount.useQuery(
    { employeeId },
    { 
      refetchInterval: 30000, // تحديث كل 30 ثانية
      enabled: !!employeeId,
    }
  );

  // جلب الإشعارات
  const { data: notifications = [], isLoading } = trpc.portalNotifications.getNotifications.useQuery(
    { employeeId, limit: 20 },
    { 
      enabled: isOpen && !!employeeId,
      refetchOnWindowFocus: false,
    }
  );

  // تحديد إشعار كمقروء
  const markAsReadMutation = trpc.portalNotifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.portalNotifications.getUnreadCount.invalidate({ employeeId });
      utils.portalNotifications.getNotifications.invalidate({ employeeId });
    },
  });

  // تحديد الكل كمقروء
  const markAllAsReadMutation = trpc.portalNotifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.portalNotifications.getUnreadCount.invalidate({ employeeId });
      utils.portalNotifications.getNotifications.invalidate({ employeeId });
    },
  });

  // حذف إشعار
  const deleteNotificationMutation = trpc.portalNotifications.deleteNotification.useMutation({
    onSuccess: () => {
      utils.portalNotifications.getUnreadCount.invalidate({ employeeId });
      utils.portalNotifications.getNotifications.invalidate({ employeeId });
    },
  });

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate({ notificationId: notification.id, employeeId });
    }
    
    // التنقل للرابط إذا وجد
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate({ employeeId });
  };

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    deleteNotificationMutation.mutate({ notificationId, employeeId });
  };

  const formatTime = (date: Date | string) => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return formatDistanceToNow(d, { addSuffix: true, locale: ar });
    } catch {
      return "";
    }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* زر الجرس */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="الإشعارات"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs flex items-center justify-center"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {/* قائمة الإشعارات */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-background border rounded-lg shadow-lg z-50">
          {/* رأس القائمة */}
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-lg">الإشعارات</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllAsReadMutation.isPending}
                  className="text-xs"
                >
                  <CheckCheck className="h-4 w-4 ml-1" />
                  قراءة الكل
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* قائمة الإشعارات */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Bell className="h-10 w-10 mb-2 opacity-50" />
                <p>لا توجد إشعارات</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => {
                  const iconData = notificationIcons[notification.type] || notificationIcons.system;
                  const priorityColor = priorityColors[notification.priority] || priorityColors.normal;

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-3 cursor-pointer hover:bg-muted/50 transition-colors border-r-4",
                        priorityColor,
                        !notification.isRead && "bg-primary/5"
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        {/* أيقونة النوع */}
                        <div className={cn("p-2 rounded-full text-lg", iconData.color)}>
                          {iconData.icon}
                        </div>

                        {/* المحتوى */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={cn(
                              "text-sm font-medium truncate",
                              !notification.isRead && "font-semibold"
                            )}>
                              {notification.title}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              {!notification.isRead && (
                                <span className="h-2 w-2 rounded-full bg-primary"></span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive"
                                onClick={(e) => handleDeleteNotification(e, notification.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(notification.createdAt)}
                            </span>
                            {notification.actionLabel && (
                              <span className="text-xs text-primary hover:underline">
                                {notification.actionLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* ذيل القائمة */}
          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="p-2 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() => {
                    // يمكن إضافة صفحة عرض جميع الإشعارات لاحقاً
                    setIsOpen(false);
                  }}
                >
                  عرض جميع الإشعارات
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
