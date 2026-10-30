/**
 * تقويم تواريخ انتهاء الوثائق (ميلادي، حسب يوم الرياض) لكل الوثائق المسجلة
 */

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSignature,
  HeartPulse,
  IdCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUS_LABELS,
  documentDay,
  worstDocumentStatus,
  type DocumentStatus,
  type ExpiringDocumentKind,
} from "@shared/employeeFile";

export interface CalendarEntry {
  employeeId: number;
  employeeName: string;
  kind: ExpiringDocumentKind;
  /** YYYY-MM-DD */
  expiry: string;
  status: DocumentStatus;
}

const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const DAY_NAMES = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

const KIND_STYLE: Record<
  ExpiringDocumentKind,
  { chip: string; icon: typeof IdCard }
> = {
  iqama: { chip: "bg-blue-600", icon: IdCard },
  health: { chip: "bg-emerald-600", icon: HeartPulse },
  contract: { chip: "bg-purple-600", icon: FileSignature },
};

const DAY_BORDER: Record<DocumentStatus, string> = {
  expired: "border-red-400 bg-red-50 dark:bg-red-950/30",
  critical: "border-orange-400 bg-orange-50 dark:bg-orange-950/30",
  warning: "border-amber-300 bg-amber-50 dark:bg-amber-950/20",
  valid: "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10",
  missing: "border-slate-200",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function DocumentsCalendar({
  entries,
  onSelect,
}: {
  entries: CalendarEntry[];
  onSelect?: (entry: CalendarEntry) => void;
}) {
  const today = documentDay(new Date()) as string;
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7))); // 1..12

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.expiry) ?? [];
      list.push(entry);
      map.set(entry.expiry, list);
    }
    return map;
  }, [entries]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const result: Array<{ day: string | null; dayNumber: number }> = [];
    for (let i = 0; i < firstWeekday; i++)
      result.push({ day: null, dayNumber: 0 });
    for (let d = 1; d <= daysInMonth; d++)
      result.push({ day: `${year}-${pad(month)}-${pad(d)}`, dayNumber: d });
    return result;
  }, [year, month]);

  const monthPrefix = `${year}-${pad(month)}-`;
  const monthEntries = entries.filter(e => e.expiry.startsWith(monthPrefix));

  const shiftMonth = (delta: number) => {
    const index = year * 12 + (month - 1) + delta;
    setYear(Math.floor(index / 12));
    setMonth((index % 12) + 1);
  };

  const goToday = () => {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftMonth(-1)}
            aria-label="الشهر السابق"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shiftMonth(1)}
            aria-label="الشهر التالي"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            اليوم
          </Button>
        </div>
        <h3 className="text-xl font-bold">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {(Object.keys(KIND_STYLE) as ExpiringDocumentKind[]).map(kind => (
            <span key={kind} className="flex items-center gap-1">
              <span className={cn("h-3 w-3 rounded", KIND_STYLE[kind].chip)} />
              {DOCUMENT_KIND_LABELS[kind]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-1">
          {DAY_NAMES.map(name => (
            <div
              key={name}
              className="rounded bg-slate-100 p-2 text-center text-sm font-bold text-muted-foreground dark:bg-slate-800"
            >
              {name}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell.day)
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[96px] rounded bg-slate-50 dark:bg-slate-900/40"
                />
              );
            const dayEntries = byDay.get(cell.day) ?? [];
            const isToday = cell.day === today;
            const worst = dayEntries.length
              ? worstDocumentStatus(dayEntries.map(e => e.status))
              : null;
            return (
              <div
                key={cell.day}
                className={cn(
                  "min-h-[96px] rounded border p-1.5",
                  worst
                    ? DAY_BORDER[worst]
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
                  isToday && "ring-2 ring-primary"
                )}
              >
                <div
                  className={cn(
                    "mb-1 text-sm font-bold",
                    cell.day < today ? "text-muted-foreground" : "",
                    isToday && "text-primary"
                  )}
                >
                  {cell.dayNumber}
                </div>
                <div className="space-y-1">
                  {dayEntries.slice(0, 3).map(entry => {
                    const Icon = KIND_STYLE[entry.kind].icon;
                    return (
                      <button
                        type="button"
                        key={`${entry.employeeId}-${entry.kind}`}
                        onClick={() => onSelect?.(entry)}
                        disabled={!onSelect}
                        className={cn(
                          "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-right text-xs text-white",
                          KIND_STYLE[entry.kind].chip,
                          onSelect && "hover:opacity-90"
                        )}
                        title={`${entry.employeeName} - ${DOCUMENT_KIND_LABELS[entry.kind]} (${DOCUMENT_STATUS_LABELS[entry.status]})`}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{entry.employeeName}</span>
                      </button>
                    );
                  })}
                  {dayEntries.length > 3 && (
                    <div
                      className="text-center text-xs text-muted-foreground"
                      title={dayEntries
                        .slice(3)
                        .map(e => e.employeeName)
                        .join("، ")}
                    >
                      +{dayEntries.length - 3} أخرى
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800/60 sm:grid-cols-3">
        {(Object.keys(KIND_STYLE) as ExpiringDocumentKind[]).map(kind => (
          <div key={kind}>
            <span className="text-muted-foreground">
              {DOCUMENT_KIND_LABELS[kind]} تنتهي هذا الشهر:{" "}
            </span>
            <strong>{monthEntries.filter(e => e.kind === kind).length}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
