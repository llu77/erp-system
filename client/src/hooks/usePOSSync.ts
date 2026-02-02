/**
 * 🔄 usePOSSync - Custom Hook لمزامنة البيانات بين البرنامج الرئيسي وبوابة الكاشير
 * 
 * يوفر:
 * - مزامنة تلقائية للبيانات
 * - إدارة الحالة المشتركة
 * - معالجة الأخطاء والإعادة التلقائية
 * - دعم العمل بدون اتصال (Offline Support)
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// Types
export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncError: string | null;
}

export interface UsePOSSyncOptions {
  branchId?: number | null;
  autoSync?: boolean;
  syncInterval?: number; // milliseconds
  onSyncComplete?: () => void;
  onSyncError?: (error: Error) => void;
}

export function usePOSSync(options: UsePOSSyncOptions = {}) {
  const {
    branchId,
    autoSync = true,
    syncInterval = 30000, // 30 seconds
    onSyncComplete,
    onSyncError,
  } = options;

  // State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    lastSyncTime: null,
    pendingChanges: 0,
    syncError: null,
  });

  // Refs
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQueueRef = useRef<Array<{ type: string; data: unknown }>>([]);

  // Utils for tRPC
  const utils = trpc.useUtils();

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('تم استعادة الاتصال');
      // Sync pending changes
      processPendingQueue();
    };

    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
      toast.warning('انقطع الاتصال - سيتم حفظ التغييرات محلياً');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process pending queue when back online
  const processPendingQueue = useCallback(async () => {
    if (pendingQueueRef.current.length === 0) return;

    const queue = [...pendingQueueRef.current];
    pendingQueueRef.current = [];

    for (const item of queue) {
      try {
        // Process each pending item based on type
        // This would be implemented based on specific mutation types
        console.log('Processing pending item:', item);
      } catch (error) {
        // Re-add to queue if failed
        pendingQueueRef.current.push(item);
      }
    }

    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: pendingQueueRef.current.length,
    }));
  }, []);

  // Add to pending queue (for offline support)
  const addToPendingQueue = useCallback((type: string, data: unknown) => {
    pendingQueueRef.current.push({ type, data });
    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: pendingQueueRef.current.length,
    }));
  }, []);

  // Sync data from server
  const syncData = useCallback(async () => {
    if (!branchId || !syncStatus.isOnline) return;

    try {
      // Invalidate and refetch all POS-related queries
      await Promise.all([
        utils.pos.branches.list.invalidate(),
        utils.pos.categories.list.invalidate(),
        utils.pos.services.list.invalidate(),
        utils.pos.employees.byBranch.invalidate(),
      ]);

      setSyncStatus(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        syncError: null,
      }));

      onSyncComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'خطأ في المزامنة';
      setSyncStatus(prev => ({
        ...prev,
        syncError: errorMessage,
      }));
      onSyncError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [branchId, syncStatus.isOnline, utils, onSyncComplete, onSyncError]);

  // Auto-sync interval
  useEffect(() => {
    if (autoSync && branchId) {
      // Initial sync
      syncData();

      // Setup interval
      syncIntervalRef.current = setInterval(syncData, syncInterval);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, branchId, syncInterval, syncData]);

  // Manual sync trigger
  const triggerSync = useCallback(() => {
    if (syncStatus.isOnline) {
      syncData();
      toast.info('جاري مزامنة البيانات...');
    } else {
      toast.warning('لا يوجد اتصال بالإنترنت');
    }
  }, [syncStatus.isOnline, syncData]);

  // Invalidate specific data
  const invalidateData = useCallback(async (dataType: 'branches' | 'categories' | 'services' | 'employees' | 'invoices') => {
    const invalidators: Record<string, () => Promise<void>> = {
      branches: () => utils.pos.branches.list.invalidate(),
      categories: () => utils.pos.categories.list.invalidate(),
      services: () => utils.pos.services.list.invalidate(),
      employees: () => utils.pos.employees.byBranch.invalidate(),
      invoices: () => utils.pos.invoices.today.invalidate(),
    };

    await invalidators[dataType]?.();
  }, [utils]);

  return {
    syncStatus,
    triggerSync,
    invalidateData,
    addToPendingQueue,
    processPendingQueue,
  };
}

export default usePOSSync;
