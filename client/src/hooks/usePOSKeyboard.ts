/**
 * ⌨️ usePOSKeyboard - Custom Hook لاختصارات لوحة المفاتيح في الكاشير
 * 
 * يوفر اختصارات سريعة لتسريع عمل الكاشير:
 * - F1: الدفع نقداً
 * - F2: الدفع بالبطاقة
 * - F3: الدفع تحويل
 * - F4: دفع مختلط
 * - Enter: تأكيد الفاتورة
 * - Escape: إلغاء/إغلاق
 * - Delete: حذف العنصر المحدد
 * - +/-: زيادة/نقصان الكمية
 * - Ctrl+P: طباعة
 * - Ctrl+N: فاتورة جديدة
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  enabled?: boolean;
}

export interface UsePOSKeyboardOptions {
  onPaymentCash?: () => void;
  onPaymentCard?: () => void;
  onPaymentTransfer?: () => void;
  onPaymentMixed?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onPrint?: () => void;
  onNewInvoice?: () => void;
  onSearch?: () => void;
  onToggleFullscreen?: () => void;
  customShortcuts?: KeyboardShortcut[];
  enabled?: boolean;
}

export function usePOSKeyboard(options: UsePOSKeyboardOptions = {}) {
  const {
    onPaymentCash,
    onPaymentCard,
    onPaymentTransfer,
    onPaymentMixed,
    onConfirm,
    onCancel,
    onDelete,
    onIncrement,
    onDecrement,
    onPrint,
    onNewInvoice,
    onSearch,
    onToggleFullscreen,
    customShortcuts = [],
    enabled = true,
  } = options;

  // Track if input is focused to disable shortcuts
  const isInputFocused = useRef(false);

  // Default shortcuts
  const defaultShortcuts: KeyboardShortcut[] = [
    {
      key: 'F1',
      action: () => onPaymentCash?.(),
      description: 'الدفع نقداً',
      enabled: !!onPaymentCash,
    },
    {
      key: 'F2',
      action: () => onPaymentCard?.(),
      description: 'الدفع بالبطاقة',
      enabled: !!onPaymentCard,
    },
    {
      key: 'F3',
      action: () => onPaymentTransfer?.(),
      description: 'الدفع تحويل',
      enabled: !!onPaymentTransfer,
    },
    {
      key: 'F4',
      action: () => onPaymentMixed?.(),
      description: 'دفع مختلط',
      enabled: !!onPaymentMixed,
    },
    {
      key: 'Enter',
      action: () => onConfirm?.(),
      description: 'تأكيد الفاتورة',
      enabled: !!onConfirm,
    },
    {
      key: 'Escape',
      action: () => onCancel?.(),
      description: 'إلغاء/إغلاق',
      enabled: !!onCancel,
    },
    {
      key: 'Delete',
      action: () => onDelete?.(),
      description: 'حذف العنصر',
      enabled: !!onDelete,
    },
    {
      key: '+',
      action: () => onIncrement?.(),
      description: 'زيادة الكمية',
      enabled: !!onIncrement,
    },
    {
      key: '-',
      action: () => onDecrement?.(),
      description: 'نقصان الكمية',
      enabled: !!onDecrement,
    },
    {
      key: 'p',
      ctrl: true,
      action: () => onPrint?.(),
      description: 'طباعة',
      enabled: !!onPrint,
    },
    {
      key: 'n',
      ctrl: true,
      action: () => onNewInvoice?.(),
      description: 'فاتورة جديدة',
      enabled: !!onNewInvoice,
    },
    {
      key: 'f',
      ctrl: true,
      action: () => onSearch?.(),
      description: 'بحث',
      enabled: !!onSearch,
    },
    {
      key: 'F11',
      action: () => onToggleFullscreen?.(),
      description: 'ملء الشاشة',
      enabled: !!onToggleFullscreen,
    },
  ];

  // Combine default and custom shortcuts
  const allShortcuts = [...defaultShortcuts, ...customShortcuts].filter(s => s.enabled !== false);

  // Handle keydown
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Skip if typing in input/textarea
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape to work even in inputs
      if (event.key !== 'Escape') {
        return;
      }
    }

    // Find matching shortcut
    const shortcut = allShortcuts.find(s => {
      const keyMatch = s.key.toLowerCase() === event.key.toLowerCase() ||
                       s.key === event.key;
      const ctrlMatch = s.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
      const shiftMatch = s.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = s.alt ? event.altKey : !event.altKey;
      
      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  }, [enabled, allShortcuts]);

  // Setup event listeners
  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);

  // Get shortcuts list for display
  const getShortcutsList = useCallback(() => {
    return allShortcuts.map(s => ({
      key: s.key,
      modifiers: [
        s.ctrl ? 'Ctrl' : null,
        s.shift ? 'Shift' : null,
        s.alt ? 'Alt' : null,
      ].filter(Boolean).join('+'),
      description: s.description,
    }));
  }, [allShortcuts]);

  return {
    shortcuts: allShortcuts,
    getShortcutsList,
    isInputFocused,
  };
}

export default usePOSKeyboard;
