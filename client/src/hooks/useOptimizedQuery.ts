/**
 * Optimized Query Hooks - تحسين استعلامات React Query
 * 
 * يوفر:
 * 1. Stale Time محسّن
 * 2. Cache Time محسّن
 * 3. Refetch on Window Focus مُعطّل للبيانات الثابتة
 * 4. Placeholder Data للتحميل السريع
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';

// ===== Query Options Presets =====
export const queryOptions = {
  // للبيانات التي تتغير بشكل متكرر (كل دقيقة)
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000, // 1 minute
  },
  
  // للبيانات العادية (كل 5 دقائق)
  standard: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  },
  
  // للبيانات الثابتة نسبياً (كل 15 دقيقة)
  stable: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  },
  
  // للبيانات الثابتة جداً (كل ساعة)
  static: {
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    refetchOnWindowFocus: false,
  },
  
  // للقوائم المنسدلة والخيارات
  dropdown: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
  },
};

// ===== Debounced Value Hook =====
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Need to import useState
import { useState } from 'react';

// ===== Throttled Callback Hook =====
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): T {
  const lastCall = useRef(0);
  const lastArgs = useRef<any[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs.current = args;
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      return callback(...args);
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      lastCall.current = Date.now();
      callback(...lastArgs.current);
    }, delay - (now - lastCall.current));
  }, [callback, delay]) as T;
}

// ===== Memoized List Hook =====
export function useMemoizedList<T>(
  items: T[],
  keyExtractor: (item: T) => string | number
): T[] {
  const prevItems = useRef<T[]>([]);
  const prevKeys = useRef<Set<string | number>>(new Set());
  
  return useMemo(() => {
    const currentKeys = new Set(items.map(keyExtractor));
    
    // Check if keys are the same
    if (
      prevKeys.current.size === currentKeys.size &&
      Array.from(prevKeys.current).every(k => currentKeys.has(k))
    ) {
      // Check if order is the same
      const sameOrder = items.every((item, i) => 
        keyExtractor(item) === keyExtractor(prevItems.current[i])
      );
      
      if (sameOrder) {
        return prevItems.current;
      }
    }
    
    prevItems.current = items;
    prevKeys.current = currentKeys;
    return items;
  }, [items, keyExtractor]);
}

// ===== Intersection Observer Hook for Lazy Loading =====
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      threshold: 0.1,
      ...options,
    });
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [options]);
  
  return [ref as React.RefObject<HTMLDivElement | null>, isIntersecting];
}

// ===== Previous Value Hook =====
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

// ===== Stable Callback Hook =====
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}

// ===== Optimistic Update Helper =====
export function createOptimisticUpdate<T>(
  currentData: T[],
  newItem: T,
  idKey: keyof T = 'id' as keyof T
): T[] {
  return [...currentData, newItem];
}

export function createOptimisticDelete<T>(
  currentData: T[],
  itemId: number | string,
  idKey: keyof T = 'id' as keyof T
): T[] {
  return currentData.filter(item => item[idKey] !== itemId);
}

export function createOptimisticUpdate2<T>(
  currentData: T[],
  updatedItem: Partial<T> & { id: number | string },
  idKey: keyof T = 'id' as keyof T
): T[] {
  return currentData.map(item => 
    item[idKey] === updatedItem.id 
      ? { ...item, ...updatedItem }
      : item
  );
}
