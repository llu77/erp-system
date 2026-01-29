/**
 * NotificationBell Component
 * جرس الإشعارات مع عداد الإشعارات غير المقروءة ودعم Push Notifications
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, BellRing, CheckCheck, Trash2, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

interface NotificationBellProps {
  employeeId: number;
  className?: string;
}

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

const priorityColors: Record<string, string> = {
  low: "border-l-gray-300",
  normal: "border-l-blue-400",
  high: "border-l-orange-500",
  urgent: "border-l-red-600",
};

const urgentTypes = ['document_expired', 'document_expiring', 'request_rejected'];

export function NotificationBell({ employeeId, className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [lastNotificationId, setLastNotificationId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const { toast } = useToast();

  const {
    permission,
    isSupported,
    isLoading: pushLoading,
    requestPermission,
    showNotification: showPushNotification,
  } = usePushNotifications();

  const { data: unreadCount = 0 } = trpc.portalNotifications.getUnreadCount.useQuery(
    { employeeId },
    { refetchInterval: 30000, enabled: !!employeeId }
  );

  const { data: notifications = [], isLoading } = trpc.portalNotifications.getNotifications.useQuery(
    { employeeId, limit: 20 },
    { enabled: isOpen && !!employeeId, refetchOnWindowFocus: false }
  );

  const { data: latestNotifications = [] } = trpc.portalNotifications.getNotifications.useQuery(
    { employeeId, limit: 1, unreadOnly: true },
    { refetchInterval: 30000, enabled: !!employeeId && permission === 'granted' }
  );

  useEffect(() => {
    if (permission !== 'granted' || latestNotifications.length === 0) return;
    const latestNotification = latestNotifications[0];
    if (!latestNotification || lastNotificationId === latestNotification.id) return;

    setLastNotificationId(latestNotification.id);

    const isUrgent = latestNotification.priority === 'urgent' || 
                     latestNotification.priority === 'high' ||
                     urgentTypes.includes(latestNotification.type);

    if (isUrgent && !document.hasFocus()) {
      showPushNotification({
        title: latestNotification.title,
        body: latestNotification.message,
        tag: `notification-${latestNotification.id}`,
        requireInteraction: latestNotification.priority === 'urgent',
        data: {
          url: latestNotification.actionUrl || '/employee-portal',
          notificationId: latestNotification.id,
          type: latestNotification.type,
        },
      });
    }
  }, [latestNotifications, lastNotificationId, permission, showPushNotification]);

  const markAsReadMutation = trpc.portalNotifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.portalNotifications.getUnreadCount.invalidate({ employeeId });
      utils.portalNotifications.getNotifications.invalidate({ employeeId });
    },
  });

  const markAllAsReadMutation = trpc.portalNotifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.portalNotifications.getUnreadCount.invalidate({ employeeId });
      utils.portalNotifications.getNotifications.invalidate({ employeeId });
    },
  });

  const deleteNotificationMutation = trpc.portalNotifications.deleteNotification.useMutation({
    onSuccess: () => {
      utils.portalNotifications.getUnreadCount.invalidate({ employeeId });
      utils.portalNotifications.getNotifications.invalidate({ employeeId });
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate({ notificationId: notification.id, employeeId });
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
      setIsOpen(false);
    }
  };

  const handleMarkAllAsRead = () => markAllAsReadMutation.mutate({ employeeId });

  const handleDeleteNotification = (e: React.MouseEvent, notificationId: number) => {
    e.stopPropagation();
    deleteNotificationMutation.mutate({ notificationId, employeeId });
  };

  const handleEnablePush = useCallback(async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({ title: "تم تفعيل الإشعارات", description: "ستصلك إشعارات فورية للتنبيهات العاجلة" });
    } else {
      toast({ title: "لم يتم تفعيل الإشعارات", description: "يمكنك تفعيلها لاحقاً من إعدادات المتصفح", variant: "destructive" });
    }
  }, [requestPermission, toast]);

  const formatTime = (date: Date | string) => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return formatDistanceToNow(d, { addSuffix: true, locale: ar });
    } catch { return ""; }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Button variant="ghost" size="icon" className="relative" onClick={() => setIsOpen(!isOpen)} aria-label="الإشعارات">
        {permission === 'granted' ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-background border rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-lg">الإشعارات</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} disabled={markAllAsReadMutation.isPending} className="text-xs">
                  <CheckCheck className="h-4 w-4 ml-1" />قراءة الكل
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)} title="إعدادات الإشعارات">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {showSettings && (
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium">إشعارات المتصفح</p>
                  <p className="text-xs text-muted-foreground">
                    {permission === 'granted' ? 'مفعّلة - ستصلك إشعارات فورية' :
                     permission === 'denied' ? 'مرفوضة - فعّلها من إعدادات المتصفح' :
                     !isSupported ? 'غير مدعومة في هذا المتصفح' : 'غير مفعّلة'}
                  </p>
                </div>
                {isSupported && permission !== 'denied' && (
                  <Switch checked={permission === 'granted'} onCheckedChange={(checked) => { if (checked) handleEnablePush(); }} disabled={pushLoading || permission === 'granted'} />
                )}
              </div>
            </div>
          )}

          {!showSettings && isSupported && permission === 'default' && (
            <div className="p-2 border-b bg-amber-50 dark:bg-amber-900/20">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-amber-700 dark:text-amber-300">فعّل الإشعارات الفورية للتنبيهات العاجلة</p>
                <Button variant="outline" size="sm" onClick={handleEnablePush} disabled={pushLoading} className="text-xs h-7">
                  {pushLoading ? "جاري التفعيل..." : "تفعيل"}
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="h-[350px]">
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
                    <div key={notification.id} className={cn("p-3 cursor-pointer hover:bg-muted/50 transition-colors border-r-4 group", priorityColor, !notification.isRead && "bg-primary/5")} onClick={() => handleNotificationClick(notification)}>
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-full text-lg", iconData.color)}>{iconData.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={cn("text-sm font-medium truncate", !notification.isRead && "font-semibold")}>{notification.title}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              {!notification.isRead && <span className="h-2 w-2 rounded-full bg-primary"></span>}
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive" onClick={(e) => handleDeleteNotification(e, notification.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notification.message}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-muted-foreground">{formatTime(notification.createdAt)}</span>
                            {notification.actionLabel && <span className="text-xs text-primary hover:underline">{notification.actionLabel}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="p-2 text-center">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setIsOpen(false)}>عرض جميع الإشعارات</Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
