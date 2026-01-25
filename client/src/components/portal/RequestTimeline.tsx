import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, CheckCircle2, XCircle, AlertCircle, FileText, User, Calendar, ChevronLeft } from "lucide-react";

interface RequestTimelineProps {
  requestId: number;
  requestType: string;
  currentStatus: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  submitted: { label: "تم التقديم", color: "bg-blue-500", icon: FileText },
  under_review: { label: "قيد المراجعة", color: "bg-yellow-500", icon: Clock },
  pending_approval: { label: "بانتظار الموافقة", color: "bg-orange-500", icon: AlertCircle },
  approved: { label: "تمت الموافقة", color: "bg-green-500", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-500", icon: XCircle },
  cancelled: { label: "ملغي", color: "bg-gray-500", icon: XCircle },
  completed: { label: "مكتمل", color: "bg-emerald-500", icon: CheckCircle2 },
};

export function RequestTimeline({ requestId, requestType, currentStatus }: RequestTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: timeline, isLoading } = trpc.employeePortal.getRequestTimeline.useQuery(
    { requestId },
    { enabled: isOpen }
  );

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { label: status, color: "bg-gray-400", icon: Clock };
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const currentConfig = getStatusConfig(currentStatus);
  const CurrentIcon = currentConfig.icon;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Clock className="h-4 w-4" />
          تتبع الطلب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            تتبع الطلب
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* الحالة الحالية */}
          <Card className="border-2 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${currentConfig.color}`}>
                    <CurrentIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">الحالة الحالية</p>
                    <p className="font-semibold">{currentConfig.label}</p>
                  </div>
                </div>
                <Badge variant="outline">{requestType}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : timeline && timeline.length > 0 ? (
            <div className="relative">
              {/* الخط العمودي */}
              <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-4">
                {timeline.map((entry: any, index: number) => {
                  const config = getStatusConfig(entry.status);
                  const Icon = config.icon;
                  const isLast = index === timeline.length - 1;
                  
                  return (
                    <div key={entry.id || index} className="relative flex gap-4">
                      {/* الأيقونة */}
                      <div className={`relative z-10 p-2 rounded-full ${config.color} ${isLast ? 'ring-4 ring-primary/20' : ''}`}>
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      
                      {/* المحتوى */}
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{config.label}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.createdAt)}
                          </span>
                        </div>
                        
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {entry.notes}
                          </p>
                        )}
                        
                        {entry.actionByName && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{entry.actionByName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا يوجد سجل تتبع لهذا الطلب</p>
              <p className="text-sm mt-1">سيظهر سجل التتبع عند مراجعة الطلب</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RequestTimeline;
