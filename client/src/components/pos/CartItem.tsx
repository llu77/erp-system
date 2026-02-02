/**
 * 🛒 CartItem - مكون عنصر السلة المحسن
 * 
 * يستخدم أنماط React المتقدمة:
 * - Memoization للأداء
 * - Controlled vs Uncontrolled patterns
 * - Event delegation
 */

import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface CartItemData {
  serviceId: number;
  serviceName: string;
  serviceNameAr: string;
  price: number;
  quantity: number;
  total: number;
}

export interface CartItemProps {
  item: CartItemData;
  onUpdateQuantity: (serviceId: number, delta: number) => void;
  onRemove: (serviceId: number) => void;
  isCompact?: boolean;
  showControls?: boolean;
  className?: string;
}

// Quantity Controls Component
const QuantityControls = memo(function QuantityControls({
  quantity,
  onIncrement,
  onDecrement,
  onRemove,
  isCompact = false,
}: {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  isCompact?: boolean;
}) {
  const buttonSize = isCompact ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize = isCompact ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className={cn(buttonSize, 'rounded-full')}
        onClick={onDecrement}
        disabled={quantity <= 1}
      >
        <Minus className={iconSize} />
      </Button>
      
      <span className={cn(
        'font-bold text-center min-w-[2rem]',
        isCompact ? 'text-sm' : 'text-base'
      )}>
        {quantity}
      </span>
      
      <Button
        variant="outline"
        size="icon"
        className={cn(buttonSize, 'rounded-full')}
        onClick={onIncrement}
      >
        <Plus className={iconSize} />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className={cn(buttonSize, 'rounded-full text-destructive hover:text-destructive hover:bg-destructive/10')}
        onClick={onRemove}
      >
        <Trash2 className={iconSize} />
      </Button>
    </div>
  );
});

// Price Display Component
const PriceDisplay = memo(function PriceDisplay({
  price,
  total,
  quantity,
  isCompact = false,
}: {
  price: number;
  total: number;
  quantity: number;
  isCompact?: boolean;
}) {
  return (
    <div className={cn(
      'text-left',
      isCompact ? 'space-y-0' : 'space-y-1'
    )}>
      {quantity > 1 && (
        <div className={cn(
          'text-muted-foreground',
          isCompact ? 'text-xs' : 'text-sm'
        )}>
          {price.toFixed(2)} × {quantity}
        </div>
      )}
      <div className={cn(
        'font-bold text-primary',
        isCompact ? 'text-sm' : 'text-base'
      )}>
        {total.toFixed(2)} ر.س
      </div>
    </div>
  );
});

// Main CartItem Component
export const CartItem = memo(function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
  isCompact = false,
  showControls = true,
  className,
}: CartItemProps) {
  // Memoized handlers
  const handleIncrement = useCallback(() => {
    onUpdateQuantity(item.serviceId, 1);
  }, [onUpdateQuantity, item.serviceId]);

  const handleDecrement = useCallback(() => {
    onUpdateQuantity(item.serviceId, -1);
  }, [onUpdateQuantity, item.serviceId]);

  const handleRemove = useCallback(() => {
    onRemove(item.serviceId);
  }, [onRemove, item.serviceId]);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg transition-colors',
        isCompact ? 'p-2 bg-muted/50' : 'p-3 bg-muted/30 hover:bg-muted/50',
        className
      )}
    >
      {/* Service Info */}
      <div className="flex-1 min-w-0">
        <h4 className={cn(
          'font-semibold truncate',
          isCompact ? 'text-sm' : 'text-base'
        )}>
          {item.serviceNameAr}
        </h4>
        {!isCompact && (
          <p className="text-xs text-muted-foreground truncate">
            {item.serviceName}
          </p>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <QuantityControls
          quantity={item.quantity}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemove={handleRemove}
          isCompact={isCompact}
        />
      )}

      {/* Price */}
      <PriceDisplay
        price={item.price}
        total={item.total}
        quantity={item.quantity}
        isCompact={isCompact}
      />
    </div>
  );
});

// Cart Summary Component
export const CartSummary = memo(function CartSummary({
  subtotal,
  discount = 0,
  total,
  itemCount,
  className,
}: {
  subtotal: number;
  discount?: number;
  total: number;
  itemCount: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/20', className)}>
      <div className="flex justify-between text-sm">
        <span>المجموع الفرعي ({itemCount} خدمة)</span>
        <span className="font-semibold">{subtotal.toFixed(2)} ر.س</span>
      </div>
      
      {discount > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>الخصم</span>
          <span className="font-semibold">- {discount.toFixed(2)} ر.س</span>
        </div>
      )}
      
      <div className="flex justify-between items-center pt-2 border-t border-primary/20">
        <span className="text-lg font-bold">الإجمالي</span>
        <span className="text-2xl font-bold text-primary">{total.toFixed(2)} ر.س</span>
      </div>
    </div>
  );
});

export default CartItem;
