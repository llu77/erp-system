import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Pencil, Trash2, Eye, ChevronLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MobileCardField {
  label: string;
  value: React.ReactNode;
  className?: string;
  isTitle?: boolean;
  isSubtitle?: boolean;
  isBadge?: boolean;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  isPrice?: boolean;
  isHighlighted?: boolean;
  hideOnDesktop?: boolean;
}

export interface MobileCardAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  disabled?: boolean;
}

export interface MobileCardProps {
  fields: MobileCardField[];
  actions?: MobileCardAction[];
  onClick?: () => void;
  className?: string;
  showActions?: boolean;
  statusBadge?: {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
}

export function MobileCard({
  fields,
  actions = [],
  onClick,
  className,
  showActions = true,
  statusBadge,
}: MobileCardProps) {
  const titleField = fields.find((f) => f.isTitle);
  const subtitleField = fields.find((f) => f.isSubtitle);
  const otherFields = fields.filter((f) => !f.isTitle && !f.isSubtitle);

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        onClick && "cursor-pointer hover:shadow-md active:scale-[0.99]",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {titleField && (
              <h3 className="font-semibold text-sm sm:text-base truncate">
                {titleField.value}
              </h3>
            )}
            {subtitleField && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {subtitleField.value}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge && (
              <Badge variant={statusBadge.variant} className="text-xs">
                {statusBadge.label}
              </Badge>
            )}
            {showActions && actions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actions.map((action, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      disabled={action.disabled}
                      className={cn(
                        action.variant === "destructive" && "text-destructive"
                      )}
                    >
                      {action.icon && <span className="ml-2">{action.icon}</span>}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Fields Grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {otherFields.map((field, index) => (
            <div
              key={index}
              className={cn(
                "flex flex-col",
                field.className,
                field.hideOnDesktop && "sm:hidden"
              )}
            >
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {field.label}
              </span>
              {field.isBadge ? (
                <Badge
                  variant={field.badgeVariant || "default"}
                  className="w-fit text-xs mt-0.5"
                >
                  {field.value}
                </Badge>
              ) : field.isPrice ? (
                <span className="text-sm sm:text-base font-semibold text-primary">
                  {field.value}
                </span>
              ) : field.isHighlighted ? (
                <span className="text-sm sm:text-base font-medium text-foreground">
                  {field.value}
                </span>
              ) : (
                <span className="text-xs sm:text-sm text-foreground truncate">
                  {field.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Clickable Indicator */}
        {onClick && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50">
            <ChevronLeft className="h-4 w-4" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface MobileCardListProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => React.ReactNode;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
  gap?: "sm" | "md" | "lg";
}

export function MobileCardList<T>({
  items,
  renderCard,
  isLoading,
  emptyMessage = "لا توجد بيانات",
  emptyIcon,
  className,
  gap = "md",
}: MobileCardListProps<T>) {
  const gapClass = {
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
  }[gap];

  if (isLoading) {
    return (
      <div className={cn("flex flex-col", gapClass, className)}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="h-6 w-16 bg-muted rounded" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        {emptyIcon && <div className="mb-3 opacity-50">{emptyIcon}</div>}
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", gapClass, className)}>
      {items.map((item, index) => renderCard(item, index))}
    </div>
  );
}

// Hook to detect mobile view
export function useResponsiveView(breakpoint: number = 768) {
  const [isMobileView, setIsMobileView] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobileView;
}

// Wrapper component that switches between table and card view
export interface ResponsiveDataViewProps<T> {
  items: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  renderTable: () => React.ReactNode;
  renderCard: (item: T, index: number) => React.ReactNode;
  breakpoint?: number;
}

export function ResponsiveDataView<T>({
  items,
  isLoading,
  emptyMessage,
  emptyIcon,
  renderTable,
  renderCard,
  breakpoint = 768,
}: ResponsiveDataViewProps<T>) {
  const isMobileView = useResponsiveView(breakpoint);

  if (isMobileView) {
    return (
      <MobileCardList
        items={items}
        renderCard={renderCard}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        emptyIcon={emptyIcon}
      />
    );
  }

  return <>{renderTable()}</>;
}

export { Pencil, Trash2, Eye };
