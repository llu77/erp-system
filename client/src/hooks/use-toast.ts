import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastState {
  toasts: Toast[];
}

let toastCount = 0;

export function useToast() {
  const [state, setState] = useState<ToastState>({ toasts: [] });

  const toast = useCallback(({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = String(toastCount++);
    const newToast: Toast = { id, title, description, variant };
    
    setState((prev) => ({
      toasts: [...prev.toasts, newToast],
    }));

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setState((prev) => ({
        toasts: prev.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);

    // Also show as alert for now (simple implementation)
    if (typeof window !== 'undefined') {
      const message = description ? `${title}: ${description}` : title;
      if (variant === 'destructive') {
        console.error(message);
      } else {
        console.log(message);
      }
    }

    return { id, dismiss: () => {} };
  }, []);

  return {
    toast,
    toasts: state.toasts,
    dismiss: (id: string) => {
      setState((prev) => ({
        toasts: prev.toasts.filter((t) => t.id !== id),
      }));
    },
  };
}
