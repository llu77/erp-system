/**
 * 💳 PaymentMethodSelector - مكون اختيار طريقة الدفع المحسن
 * 
 * يستخدم أنماط React المتقدمة:
 * - Compound Components Pattern
 * - Render Props Pattern
 * - State Machines for payment flow
 */

import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Banknote, CreditCard, Split, Gift, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export type PaymentMethod = 'cash' | 'card' | 'split' | 'loyalty';

export interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  labelAr: string;
  icon: React.ReactNode;
  shortcut?: string;
  description?: string;
  disabled?: boolean;
}

export interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  hasLoyaltyCustomer?: boolean;
  isLoyaltyEligible?: boolean;
  loyaltyDiscount?: number;
  className?: string;
  variant?: 'default' | 'compact' | 'grid';
}

// Default payment methods
const defaultPaymentMethods: PaymentMethodOption[] = [
  {
    id: 'cash',
    label: 'Cash',
    labelAr: 'نقداً',
    icon: <Banknote className="h-5 w-5" />,
    shortcut: 'F1',
    description: 'الدفع نقداً',
  },
  {
    id: 'card',
    label: 'Card',
    labelAr: 'شبكة',
    icon: <CreditCard className="h-5 w-5" />,
    shortcut: 'F2',
    description: 'الدفع بالبطاقة',
  },
  {
    id: 'split',
    label: 'Split',
    labelAr: 'مختلط',
    icon: <Split className="h-5 w-5" />,
    shortcut: 'F4',
    description: 'نقداً + شبكة',
  },
  {
    id: 'loyalty',
    label: 'Loyalty',
    labelAr: 'ولاء',
    icon: <Gift className="h-5 w-5" />,
    shortcut: 'F3',
    description: 'برنامج الولاء',
  },
];

// Single Payment Method Button
const PaymentMethodButton = memo(function PaymentMethodButton({
  method,
  isSelected,
  onClick,
  disabled,
  showShortcut = true,
  variant = 'default',
}: {
  method: PaymentMethodOption;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  showShortcut?: boolean;
  variant?: 'default' | 'compact' | 'grid';
}) {
  const variantStyles = {
    default: 'flex-1 h-16 flex-col gap-1',
    compact: 'flex-1 h-12 flex-row gap-2',
    grid: 'h-20 flex-col gap-1',
  };

  return (
    <Button
      variant={isSelected ? 'default' : 'outline'}
      className={cn(
        'relative transition-all duration-200',
        variantStyles[variant],
        isSelected && 'ring-2 ring-primary ring-offset-2',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {method.icon}
      <span className={cn(
        'font-semibold',
        variant === 'compact' ? 'text-sm' : 'text-base'
      )}>
        {method.labelAr}
      </span>
      
      {/* Shortcut Badge */}
      {showShortcut && method.shortcut && variant !== 'compact' && (
        <Badge 
          variant="secondary" 
          className="absolute top-1 left-1 text-[10px] px-1 py-0 h-4"
        >
          {method.shortcut}
        </Badge>
      )}
      
      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1">
          <Check className="h-4 w-4" />
        </div>
      )}
    </Button>
  );
});

// Loyalty Badge Component
const LoyaltyBadge = memo(function LoyaltyBadge({
  isEligible,
  discountPercent,
}: {
  isEligible: boolean;
  discountPercent?: number;
}) {
  if (!isEligible) return null;

  return (
    <Badge className="bg-green-500 text-white animate-pulse">
      خصم {discountPercent || 60}%
    </Badge>
  );
});

// Main Component
export const PaymentMethodSelector = memo(function PaymentMethodSelector({
  value,
  onChange,
  hasLoyaltyCustomer = false,
  isLoyaltyEligible = false,
  loyaltyDiscount,
  className,
  variant = 'default',
}: PaymentMethodSelectorProps) {
  // Get payment methods with loyalty status
  const paymentMethods = defaultPaymentMethods.map(method => ({
    ...method,
    disabled: method.id === 'loyalty' && !hasLoyaltyCustomer,
  }));

  // Handle method change
  const handleMethodChange = useCallback((method: PaymentMethod) => {
    onChange(method);
  }, [onChange]);

  const containerStyles = {
    default: 'flex gap-2',
    compact: 'flex gap-2',
    grid: 'grid grid-cols-2 gap-2',
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Loyalty Eligibility Banner */}
      {hasLoyaltyCustomer && isLoyaltyEligible && (
        <div className="flex items-center justify-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <Gift className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">
            العميل مؤهل لخصم الولاء!
          </span>
          <LoyaltyBadge isEligible={isLoyaltyEligible} discountPercent={loyaltyDiscount} />
        </div>
      )}

      {/* Payment Methods */}
      <div className={containerStyles[variant]}>
        {paymentMethods.map(method => (
          <PaymentMethodButton
            key={method.id}
            method={method}
            isSelected={value === method.id}
            onClick={() => handleMethodChange(method.id)}
            disabled={method.disabled}
            variant={variant}
          />
        ))}
      </div>

      {/* Method Description */}
      {variant !== 'compact' && (
        <p className="text-xs text-muted-foreground text-center">
          {paymentMethods.find(m => m.id === value)?.description}
        </p>
      )}
    </div>
  );
});

export default PaymentMethodSelector;
