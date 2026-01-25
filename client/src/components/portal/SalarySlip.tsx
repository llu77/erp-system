import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { 
  Loader2, 
  DollarSign, 
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  AlertCircle
} from 'lucide-react';

interface SalarySlipProps {
  employeeId: number;
  employeeName: string;
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

export function SalarySlip({ employeeId, employeeName }: SalarySlipProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);

  // جلب كشف الراتب
  const { data: salarySlip, isLoading, error } = trpc.employeePortal.getSalarySlip.useQuery(
    { employeeId, year: selectedYear, month: selectedMonth },
    { retry: false }
  );

  // جلب سجل الرواتب
  const { data: salaryHistory } = trpc.employeePortal.getSalaryHistory.useQuery(
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

  // توليد سنوات للاختيار (آخر 3 سنوات)
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

      {/* كشف الراتب */}
      {isLoading ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">لا يوجد كشف راتب لشهر {getMonthName(selectedMonth)} {selectedYear}</p>
            <p className="text-slate-500 text-sm mt-2">قد لا يكون المسير قد صدر بعد</p>
          </CardContent>
        </Card>
      ) : salarySlip ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  كشف راتب {getMonthName(selectedMonth)} {selectedYear}
                </CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                  رقم المسير: {salarySlip.payrollNumber}
                </p>
              </div>
              <Badge 
                className={
                  salarySlip.status === 'approved' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : salarySlip.status === 'pending'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                }
              >
                {salarySlip.status === 'approved' ? 'معتمد' : 
                 salarySlip.status === 'pending' ? 'قيد المراجعة' : 
                 salarySlip.status === 'draft' ? 'مسودة' : salarySlip.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* معلومات الموظف */}
            <div className="bg-slate-700/30 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">الاسم</span>
                  <p className="text-white font-medium">{salarySlip.employeeName}</p>
                </div>
                <div>
                  <span className="text-slate-400">الكود</span>
                  <p className="text-white font-mono">{salarySlip.employeeCode}</p>
                </div>
                <div>
                  <span className="text-slate-400">المنصب</span>
                  <p className="text-white">{salarySlip.position || '-'}</p>
                </div>
                <div>
                  <span className="text-slate-400">أيام العمل</span>
                  <p className="text-white">{salarySlip.workDays} يوم</p>
                </div>
              </div>
            </div>

            {/* الاستحقاقات */}
            <div className="mb-6">
              <h3 className="text-emerald-400 font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                الاستحقاقات
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">الراتب الأساسي</span>
                  <span className="text-white">{formatCurrency(salarySlip.baseSalary)}</span>
                </div>
                {salarySlip.overtimeEnabled && salarySlip.overtimeAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">الساعات الإضافية</span>
                    <span className="text-white">{formatCurrency(salarySlip.overtimeAmount)}</span>
                  </div>
                )}
                {salarySlip.incentiveAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">الحوافز {salarySlip.isSupervisor ? '(مشرف)' : ''}</span>
                    <span className="text-white">{formatCurrency(salarySlip.incentiveAmount)}</span>
                  </div>
                )}
                <Separator className="bg-slate-700 my-2" />
                <div className="flex justify-between font-medium">
                  <span className="text-emerald-400">إجمالي الاستحقاقات</span>
                  <span className="text-emerald-400">{formatCurrency(salarySlip.totalEarnings)}</span>
                </div>
              </div>
            </div>

            {/* الخصومات */}
            <div className="mb-6">
              <h3 className="text-red-400 font-medium mb-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                الخصومات
              </h3>
              <div className="space-y-2">
                {salarySlip.absentDays > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصم الغياب ({salarySlip.absentDays} يوم)</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.absentDeduction)}</span>
                  </div>
                )}
                {salarySlip.leaveDays > 0 && salarySlip.leaveDeduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصم الإجازات ({salarySlip.leaveDays} يوم - {salarySlip.leaveType})</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.leaveDeduction)}</span>
                  </div>
                )}
                {salarySlip.advanceDeduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصم السلف</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.advanceDeduction)}</span>
                  </div>
                )}
                {salarySlip.negativeInvoicesDeduction > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصم الفواتير السالبة</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.negativeInvoicesDeduction)}</span>
                  </div>
                )}
                {salarySlip.deductionAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">خصومات أخرى {salarySlip.deductionReason ? `(${salarySlip.deductionReason})` : ''}</span>
                    <span className="text-red-400">-{formatCurrency(salarySlip.deductionAmount)}</span>
                  </div>
                )}
                {salarySlip.totalDeductions === 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">لا توجد خصومات</span>
                    <span className="text-slate-500">-</span>
                  </div>
                )}
                <Separator className="bg-slate-700 my-2" />
                <div className="flex justify-between font-medium">
                  <span className="text-red-400">إجمالي الخصومات</span>
                  <span className="text-red-400">-{formatCurrency(salarySlip.totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* الصافي */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-4 border border-amber-500/30">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-amber-500" />
                  <span className="text-lg font-medium text-white">صافي الراتب</span>
                </div>
                <span className="text-2xl font-bold text-amber-400">
                  {formatCurrency(salarySlip.netSalary)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* سجل الرواتب */}
      {salaryHistory && salaryHistory.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="border-b border-slate-700">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              سجل الرواتب السابقة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700">
              {salaryHistory.map((record, index) => (
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
                        رقم المسير: {record.payrollNumber}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-amber-400 font-bold">
                        {formatCurrency(record.netSalary)}
                      </p>
                      <Badge 
                        className={
                          record.status === 'approved' 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs'
                        }
                      >
                        {record.status === 'approved' ? 'معتمد' : 'قيد المراجعة'}
                      </Badge>
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
