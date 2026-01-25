import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { 
  Loader2, 
  Calendar,
  CalendarDays,
  CalendarCheck,
  CalendarX,
  AlertCircle,
  Palmtree,
  Heart,
  Briefcase
} from 'lucide-react';

interface LeaveBalanceProps {
  employeeId: number;
}

const LEAVE_TYPE_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  annual: { label: 'سنوية', icon: <Palmtree className="h-4 w-4" />, color: 'text-emerald-400' },
  sick: { label: 'مرضية', icon: <Heart className="h-4 w-4" />, color: 'text-red-400' },
  emergency: { label: 'طارئة', icon: <AlertCircle className="h-4 w-4" />, color: 'text-amber-400' },
  unpaid: { label: 'بدون راتب', icon: <Briefcase className="h-4 w-4" />, color: 'text-slate-400' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const STATUS_NAMES: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق عليها',
  rejected: 'مرفوضة',
  cancelled: 'ملغية',
};

export function LeaveBalance({ employeeId }: LeaveBalanceProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // جلب رصيد الإجازات
  const { data: balance, isLoading: balanceLoading } = trpc.employeePortal.getLeaveBalance.useQuery(
    { employeeId, year: selectedYear },
    { retry: false }
  );

  // جلب سجل الإجازات
  const { data: leaveHistory, isLoading: historyLoading } = trpc.employeePortal.getLeaveHistory.useQuery(
    { employeeId, year: selectedYear }
  );

  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  const getLeaveTypeInfo = (type: string) => {
    return LEAVE_TYPE_INFO[type] || { label: type, icon: <Calendar className="h-4 w-4" />, color: 'text-slate-400' };
  };

  // حساب الإجماليات من البيانات
  const totalEntitlement = balance ? 
    balance.annual.total + balance.sick.total + balance.emergency.total : 0;
  const totalUsed = balance ? balance.totalUsed : 0;
  const totalRemaining = totalEntitlement - totalUsed;

  // تحويل البيانات لعرضها
  const leaveTypes = balance ? [
    { type: 'annual', total: balance.annual.total, used: balance.annual.used, remaining: balance.annual.remaining },
    { type: 'sick', total: balance.sick.total, used: balance.sick.used, remaining: balance.sick.remaining },
    { type: 'emergency', total: balance.emergency.total, used: balance.emergency.used, remaining: balance.emergency.remaining },
    { type: 'unpaid', total: 0, used: balance.unpaid.used, remaining: 0 },
  ] : [];

  return (
    <div className="space-y-6">
      {/* اختيار السنة */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            اختر السنة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(parseInt(value))}
          >
            <SelectTrigger className="w-full bg-slate-700 border-slate-600 text-white">
              <SelectValue placeholder="السنة" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {years.map((year) => (
                <SelectItem 
                  key={year} 
                  value={year.toString()}
                  className="text-white hover:bg-slate-700"
                >
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ملخص الرصيد */}
      {balanceLoading ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </CardContent>
        </Card>
      ) : balance ? (
        <>
          {/* إحصائيات سريعة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="p-4 text-center">
                <CalendarDays className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-emerald-400">{totalEntitlement}</div>
                <div className="text-xs text-emerald-400/70">الرصيد الكلي</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-4 text-center">
                <CalendarCheck className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-400">{totalUsed}</div>
                <div className="text-xs text-blue-400/70">المستخدم</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-4 text-center">
                <CalendarX className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-amber-400">0</div>
                <div className="text-xs text-amber-400/70">قيد الانتظار</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-500/10 border-slate-500/30">
              <CardContent className="p-4 text-center">
                <Calendar className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{totalRemaining}</div>
                <div className="text-xs text-slate-400">المتبقي</div>
              </CardContent>
            </Card>
          </div>

          {/* تفاصيل الرصيد حسب النوع */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="border-b border-slate-700">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-500" />
                تفاصيل الرصيد حسب النوع
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {leaveTypes.map((item, index) => {
                const typeInfo = getLeaveTypeInfo(item.type);
                const usagePercent = item.total > 0 ? (item.used / item.total) * 100 : 0;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={typeInfo.color}>{typeInfo.icon}</span>
                        <span className="text-white font-medium">{typeInfo.label}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400">{item.used}</span>
                        <span className="text-slate-500 mx-1">/</span>
                        <span className="text-white">{item.total}</span>
                        <span className="text-slate-500 mr-1">يوم</span>
                      </div>
                    </div>
                    <Progress 
                      value={usagePercent} 
                      className="h-2 bg-slate-700"
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <CalendarX className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">لا يوجد رصيد إجازات لعام {selectedYear}</p>
          </CardContent>
        </Card>
      )}

      {/* سجل الإجازات */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-amber-500" />
            سجل الإجازات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
          ) : !leaveHistory || leaveHistory.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">لا توجد إجازات مسجلة لعام {selectedYear}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {leaveHistory.map((leave) => {
                const typeInfo = getLeaveTypeInfo(leave.vacationType || 'annual');
                
                return (
                  <div key={leave.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={typeInfo.color}>{typeInfo.icon}</span>
                          <span className="text-white font-medium">{typeInfo.label}</span>
                          <Badge className={STATUS_COLORS[leave.status]}>
                            {STATUS_NAMES[leave.status]}
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-400 mt-1">
                          {leave.vacationStartDate && leave.vacationEndDate ? (
                            <>من {new Date(leave.vacationStartDate).toLocaleDateString('ar-SA')} إلى {new Date(leave.vacationEndDate).toLocaleDateString('ar-SA')}</>
                          ) : (
                            <span>تاريخ غير محدد</span>
                          )}
                        </div>
                        {leave.description && (
                          <p className="text-sm text-slate-500 mt-1">{leave.description}</p>
                        )}
                      </div>
                      <div className="text-left">
                        <span className="text-lg font-bold text-amber-400">{leave.vacationDays || 0}</span>
                        <span className="text-slate-400 text-sm mr-1">يوم</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
