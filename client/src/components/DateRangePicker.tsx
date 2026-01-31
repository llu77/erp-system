import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays,
  CalendarRange
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isAfter,
  isBefore,
  parseISO,
  isValid
} from 'date-fns';
import { ar } from 'date-fns/locale';

interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  presets?: boolean;
}

// Presets للفترات الشائعة
const PRESETS = [
  { label: 'اليوم', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'أمس', getValue: () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: yesterday, to: yesterday };
  }},
  { label: 'آخر 7 أيام', getValue: () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { from: start, to: end };
  }},
  { label: 'هذا الأسبوع', getValue: () => ({
    from: startOfWeek(new Date(), { locale: ar }),
    to: endOfWeek(new Date(), { locale: ar })
  })},
  { label: 'الأسبوع الماضي', getValue: () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    return {
      from: startOfWeek(lastWeek, { locale: ar }),
      to: endOfWeek(lastWeek, { locale: ar })
    };
  }},
  { label: 'هذا الشهر', getValue: () => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })},
  { label: 'الشهر الماضي', getValue: () => {
    const lastMonth = subMonths(new Date(), 1);
    return {
      from: startOfMonth(lastMonth),
      to: endOfMonth(lastMonth)
    };
  }},
  { label: 'آخر 30 يوم', getValue: () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return { from: start, to: end };
  }},
  { label: 'آخر 90 يوم', getValue: () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 89);
    return { from: start, to: end };
  }},
];

// أسماء الأيام بالعربية
const WEEKDAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// أسماء الأشهر بالعربية
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = 'اختر الفترة',
  disabled = false,
  minDate,
  maxDate,
  presets = true
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value.from || new Date());
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // توليد أيام الشهر
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // التحقق من أن اليوم ضمن النطاق المحدد
  const isInRange = useCallback((day: Date) => {
    if (!value.from || !value.to) return false;
    return isWithinInterval(day, { start: value.from, end: value.to });
  }, [value]);

  // التحقق من أن اليوم هو بداية أو نهاية النطاق
  const isRangeStart = useCallback((day: Date) => {
    return value.from && isSameDay(day, value.from);
  }, [value.from]);

  const isRangeEnd = useCallback((day: Date) => {
    return value.to && isSameDay(day, value.to);
  }, [value.to]);

  // التحقق من أن اليوم معطل
  const isDisabled = useCallback((day: Date) => {
    if (minDate && isBefore(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate)) return true;
    return false;
  }, [minDate, maxDate]);

  // التحقق من أن اليوم في نطاق التحديد المؤقت
  const isInHoverRange = useCallback((day: Date) => {
    if (!value.from || value.to || !hoverDate) return false;
    
    const start = isBefore(hoverDate, value.from) ? hoverDate : value.from;
    const end = isAfter(hoverDate, value.from) ? hoverDate : value.from;
    
    return isWithinInterval(day, { start, end });
  }, [value.from, value.to, hoverDate]);

  // معالجة اختيار يوم
  const handleDayClick = useCallback((day: Date) => {
    if (isDisabled(day)) return;

    if (selecting === 'from') {
      onChange({ from: day, to: null });
      setSelecting('to');
    } else {
      if (value.from && isBefore(day, value.from)) {
        // إذا اختار تاريخ قبل البداية، نعكس النطاق
        onChange({ from: day, to: value.from });
      } else {
        onChange({ from: value.from, to: day });
      }
      setSelecting('from');
      setOpen(false);
    }
  }, [selecting, value.from, onChange, isDisabled]);

  // معالجة اختيار preset
  const handlePresetClick = useCallback((preset: typeof PRESETS[0]) => {
    const range = preset.getValue();
    onChange(range);
    setSelecting('from');
    setOpen(false);
  }, [onChange]);

  // تنسيق عرض النطاق
  const displayValue = useMemo(() => {
    if (!value.from) return placeholder;
    
    const fromStr = format(value.from, 'dd/MM/yyyy', { locale: ar });
    
    if (!value.to) return `من ${fromStr}`;
    
    const toStr = format(value.to, 'dd/MM/yyyy', { locale: ar });
    
    if (isSameDay(value.from, value.to)) {
      return fromStr;
    }
    
    return `${fromStr} - ${toStr}`;
  }, [value, placeholder]);

  // حساب عدد الأيام المحددة
  const daysCount = useMemo(() => {
    if (!value.from || !value.to) return 0;
    const days = eachDayOfInterval({ start: value.from, end: value.to });
    return days.length;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-right font-normal',
            !value.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarRange className="ml-2 h-4 w-4" />
          <span className="flex-1 text-right">{displayValue}</span>
          {daysCount > 0 && (
            <span className="mr-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {daysCount} يوم
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          {presets && (
            <div className="border-l p-3 space-y-1 min-w-[140px]">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                اختصارات
              </div>
              {PRESETS.map((preset, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-right h-8 text-xs"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}

          {/* Calendar */}
          <div className="p-3">
            {/* رأس التقويم */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-sm">
                {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            {/* أيام الأسبوع */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* أيام الشهر */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = isRangeStart(day) || isRangeEnd(day);
                const inRange = isInRange(day);
                const inHoverRange = isInHoverRange(day);
                const disabled = isDisabled(day);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={index}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleDayClick(day)}
                    onMouseEnter={() => setHoverDate(day)}
                    onMouseLeave={() => setHoverDate(null)}
                    className={cn(
                      'h-8 w-8 text-sm rounded-md transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                      !isCurrentMonth && 'text-muted-foreground/50',
                      isToday && !isSelected && 'border border-primary',
                      isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                      (inRange || inHoverRange) && !isSelected && 'bg-primary/20',
                      isRangeStart(day) && value.to && 'rounded-l-none',
                      isRangeEnd(day) && value.from && 'rounded-r-none',
                      disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {/* معلومات الاختيار */}
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {selecting === 'from' ? 'اختر تاريخ البداية' : 'اختر تاريخ النهاية'}
                </span>
                {value.from && !value.to && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      onChange({ from: null, to: null });
                      setSelecting('from');
                    }}
                  >
                    مسح
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// مكون بسيط لإدخال التاريخ الفردي
interface SingleDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

export function SingleDatePicker({
  value,
  onChange,
  className,
  placeholder = 'اختر التاريخ',
  disabled = false,
  minDate,
  maxDate
}: SingleDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());

  // توليد أيام الشهر
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // التحقق من أن اليوم معطل
  const isDisabled = useCallback((day: Date) => {
    if (minDate && isBefore(day, minDate)) return true;
    if (maxDate && isAfter(day, maxDate)) return true;
    return false;
  }, [minDate, maxDate]);

  // معالجة اختيار يوم
  const handleDayClick = useCallback((day: Date) => {
    if (isDisabled(day)) return;
    onChange(day);
    setOpen(false);
  }, [onChange, isDisabled]);

  // تنسيق عرض التاريخ
  const displayValue = useMemo(() => {
    if (!value) return placeholder;
    return format(value, 'dd/MM/yyyy', { locale: ar });
  }, [value, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-right font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <Calendar className="ml-2 h-4 w-4" />
          <span className="flex-1 text-right">{displayValue}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        {/* رأس التقويم */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="font-semibold text-sm">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* أيام الأسبوع */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* أيام الشهر */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = value && isSameDay(day, value);
            const disabled = isDisabled(day);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={index}
                type="button"
                disabled={disabled}
                onClick={() => handleDayClick(day)}
                className={cn(
                  'h-8 w-8 text-sm rounded-md transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                  !isCurrentMonth && 'text-muted-foreground/50',
                  isToday && !isSelected && 'border border-primary',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                  disabled && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        {/* زر المسح */}
        {value && (
          <div className="mt-3 pt-3 border-t flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              مسح التاريخ
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default DateRangePicker;
