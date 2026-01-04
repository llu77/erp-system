import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  mobileLabel?: string;
  hideOnMobile?: boolean;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  emptyMessage?: string;
  className?: string;
  cardClassName?: string;
  onRowClick?: (item: T) => void;
  renderMobileCard?: (item: T, index: number) => ReactNode;
}

export function ResponsiveTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "لا توجد بيانات",
  className,
  cardClassName,
  onRowClick,
  renderMobileCard,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  // عرض البطاقات على الموبايل
  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.map((item, index) => {
          const key = keyExtractor(item, index);
          
          // استخدام renderMobileCard المخصص إذا كان متوفراً
          if (renderMobileCard) {
            return (
              <div key={key} onClick={() => onRowClick?.(item)}>
                {renderMobileCard(item, index)}
              </div>
            );
          }

          // العرض الافتراضي للبطاقات
          const visibleColumns = columns.filter(col => !col.hideOnMobile);
          
          return (
            <Card
              key={key}
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                cardClassName
              )}
              onClick={() => onRowClick?.(item)}
            >
              <CardContent className="p-4 space-y-2">
                {visibleColumns.map((col) => {
                  const value = col.render
                    ? col.render(item, index)
                    : (item[col.key] as ReactNode);
                  
                  return (
                    <div
                      key={col.key}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {col.mobileLabel || col.header}
                      </span>
                      <span className={cn("font-medium text-left", col.className)}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // عرض الجدول على الشاشات الكبيرة
  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn("text-right", col.className)}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow
              key={keyExtractor(item, index)}
              className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.render ? col.render(item, index) : (item[col.key] as ReactNode)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// مكون مساعد لعرض البطاقة بتنسيق مخصص
interface MobileCardRowProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function MobileCardRow({ label, value, className }: MobileCardRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-medium text-left">{value}</span>
    </div>
  );
}
