import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { 
  Loader2, 
  Calendar,
  TrendingUp,
  DollarSign,
  Target,
  Award,
  AlertCircle
} from 'lucide-react';

interface BonusReportProps {
  employeeId: number;
}

const MONTHS = [
  { value: 1, label: 'يناير' },
  { value: 2, label: 'فبراير' },
  { value: 3, label: 'مارس' },
  { value: 4, label: 'أبريل' },
  { value: 5, label: 'مايو' },
  { value: 6, label: 'يونيو' },
  { value: 7, label: 'يوليو' },
  { value: 8, label: 'أغسطس' },
  { value: 9, label: 'سبتمبر' },
  { value: 10, label: 'أكتوبر' },
  { value: 11, label: 'نوفمبر' },
  { value: 12, label: 'ديسمبر' },
];

export function BonusReport({ employeeId }: BonusReportProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  // جلب تقرير البونص
  const { data: bonusReport, isLoading, error } = trpc.employeePortal.getBonusReport.useQuery(
    { employeeId, year: selectedYear, month: selectedMonth },
    { retry: false }
  );

  // جلب سجل البونص
  const { data: bonusHistory } = trpc.employeePortal.getBonusHistory.useQuery(
    { employeeId, limit: 6 }
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ر.س';
  };

  const getMonthName = (month: number) => {
    return MONTHS.find(m => m.value === month)?.label || '';
  };

  const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* اختيار الشهر والسنة */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-500" />
            اختر الشهر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="flex-1 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="الشهر" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {MONTHS.map((month) => (
                  <SelectItem 
                    key={month.value} 
                    value={month.value.toString()}
                    className="text-white hover:bg-slate-700"
                  >
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-32 bg-slate-700 border-slate-600 text-white">
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
          </div>
        </CardContent>
      </Card>

      {/* تقرير البونص */}
      {isLoading ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </CardContent>
        </Card>
      ) : error || !bonusReport ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">لا يوجد تقرير بونص لشهر {getMonthName(selectedMonth)} {selectedYear}</p>
            <p className="text-slate-500 text-sm mt-2">قد لا يكون هناك إيرادات مسجلة لهذا الشهر</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ملخص البونص */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-emerald-400">
                  {formatCurrency(bonusReport.totalRevenue)}
                </div>
                <div className="text-xs text-emerald-400/70">إجمالي الإيرادات</div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-4 text-center">
                <Target className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-amber-400">
                  {bonusReport.bonusPercentage}%
                </div>
                <div className="text-xs text-amber-400/70">نسبة البونص</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/30">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-blue-400">
                  {bonusReport.weeksCount}
                </div>
                <div className="text-xs text-blue-400/70">عدد الأسابيع</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30">
              <CardContent className="p-4 text-center">
                <Award className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <div className="text-xl font-bold text-amber-400">
                  {formatCurrency(bonusReport.totalBonus)}
                </div>
                <div className="text-xs text-amber-400/70">إجمالي البونص</div>
              </CardContent>
            </Card>
          </div>

          {/* تفاصيل الأسابيع */}
          {bonusReport.weeks && bonusReport.weeks.length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="border-b border-slate-700">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  تفاصيل الأسابيع
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-700">
                  {bonusReport.weeks.map((week: {
                    weekNumber: number;
                    startDate: string;
                    endDate: string;
                    revenue: number;
                    bonus: number;
                  }, index: number) => (
                    <div key={index} className="p-4 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">الأسبوع {week.weekNumber}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(week.startDate).toLocaleDateString('ar-SA')} - {new Date(week.endDate).toLocaleDateString('ar-SA')}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-slate-400 text-sm">
                            الإيرادات: {formatCurrency(week.revenue)}
                          </p>
                          <p className="text-amber-400 font-bold">
                            البونص: {formatCurrency(week.bonus)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* سجل البونص */}
      {bonusHistory && bonusHistory.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              سجل البونص السابق
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700">
              {bonusHistory.map((record: {
                year: number;
                month: number;
                totalRevenue: number;
                totalBonus: number;
              }, index: number) => (
                <div 
                  key={index}
                  className="p-4 hover:bg-slate-700/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedYear(record.year);
                    setSelectedMonth(record.month);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">
                        {getMonthName(record.month)} {record.year}
                      </p>
                      <p className="text-xs text-slate-400">
                        الإيرادات: {formatCurrency(record.totalRevenue)}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-amber-400 font-bold">
                        {formatCurrency(record.totalBonus)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
