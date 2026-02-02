/**
 * 🎨 ServiceCard - مكون بطاقة الخدمة المحسن
 * 
 * يستخدم أنماط React المتقدمة:
 * - Compound Components Pattern
 * - Render Props Pattern
 * - Memoization للأداء
 */

import { memo, useCallback, forwardRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Star, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface Service {
  id: number;
  name: string;
  nameAr: string;
  price: number | string;
  duration?: number;
  categoryId?: number;
  isPopular?: boolean;
  salesCount?: number;
}

export interface ServiceCardProps {
  service: Service;
  onAdd: (service: Service) => void;
  isSelected?: boolean;
  showStats?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

// Memoized Price Display
const PriceDisplay = memo(function PriceDisplay({ 
  price, 
  size = 'default' 
}: { 
  price: number | string; 
  size?: 'default' | 'large' | 'small';
}) {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  const sizeClasses = {
    small: 'text-sm',
    default: 'text-base',
    large: 'text-lg',
  };
  
  return (
    <span className={cn('font-bold text-primary', sizeClasses[size])}>
      {numPrice.toFixed(2)} <span className="text-xs">ر.س</span>
    </span>
  );
});

// Memoized Duration Display
const DurationDisplay = memo(function DurationDisplay({ 
  duration 
}: { 
  duration?: number;
}) {
  if (!duration) return null;
  
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>{duration} دقيقة</span>
    </div>
  );
});

// Memoized Popularity Badge
const PopularityBadge = memo(function PopularityBadge({ 
  isPopular,
  salesCount 
}: { 
  isPopular?: boolean;
  salesCount?: number;
}) {
  if (!isPopular && !salesCount) return null;
  
  return (
    <div className="absolute top-2 left-2 flex flex-col gap-1">
      {isPopular && (
        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs px-1.5 py-0.5">
          <Star className="h-3 w-3 ml-1 fill-current" />
          مميز
        </Badge>
      )}
      {salesCount && salesCount > 10 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
          <TrendingUp className="h-3 w-3 ml-1" />
          {salesCount}
        </Badge>
      )}
    </div>
  );
});

// Main ServiceCard Component
export const ServiceCard = memo(forwardRef<HTMLDivElement, ServiceCardProps>(
  function ServiceCard(
    { 
      service, 
      onAdd, 
      isSelected = false, 
      showStats = false,
      variant = 'default',
      className 
    },
    ref
  ) {
    // Memoized click handler
    const handleClick = useCallback(() => {
      onAdd(service);
    }, [onAdd, service]);

    // Variant styles
    const variantStyles = {
      default: 'h-[140px]',
      compact: 'h-[100px]',
      detailed: 'h-[180px]',
    };

    return (
      <Card
        ref={ref}
        onClick={handleClick}
        className={cn(
          'cursor-pointer transition-all duration-200 relative overflow-hidden group',
          'hover:shadow-lg hover:scale-[1.02] hover:border-primary/50',
          'active:scale-[0.98]',
          isSelected && 'ring-2 ring-primary border-primary',
          variantStyles[variant],
          className
        )}
      >
        <CardContent className="p-4 h-full flex flex-col justify-between">
          {/* Header */}
          <div className="flex-1">
            <h3 className="font-bold text-base leading-tight line-clamp-2 mb-1">
              {service.nameAr}
            </h3>
            {variant === 'detailed' && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {service.name}
              </p>
            )}
            <DurationDisplay duration={service.duration} />
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <PriceDisplay 
              price={service.price} 
              size={variant === 'compact' ? 'small' : 'default'} 
            />
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Plus className="h-4 w-4" />
            </div>
          </div>
          
          {/* Stats Badges */}
          {showStats && (
            <PopularityBadge 
              isPopular={service.isPopular} 
              salesCount={service.salesCount} 
            />
          )}
        </CardContent>
      </Card>
    );
  }
));

// Grid Container for Services
export const ServiceGrid = memo(function ServiceGrid({
  children,
  columns = 'auto',
  className,
}: {
  children: React.ReactNode;
  columns?: 'auto' | 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const gridClasses = {
    auto: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  return (
    <div className={cn('grid gap-3', gridClasses[columns], className)}>
      {children}
    </div>
  );
});

export default ServiceCard;
