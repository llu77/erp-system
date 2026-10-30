/**
 * جلسة بوابة الموظفين: الهوية من الخادم (كوكي httpOnly) عبر employeeAuth.me
 * لا تُحفظ هوية الموظف في المتصفح، ولا تُرسل معرفات من الواجهة
 */

import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLocation } from "wouter";
import { errorMessage, PORTAL_LOGIN_PATH, shouldRetryQuery } from "./portalUi";

/** بيانات الموظف المسجل في البوابة (employeeAuth.me) */
export interface PortalMe {
  id: number;
  name: string;
  code: string;
  position: string | null;
  branchId: number | null;
  branchName: string | null;
  /** المؤسسة صاحبة العمل حسب الفرع (قصه وتخفيف / تدرج وتخفيف) */
  establishmentName: string;
  isSupervisor: boolean;
  photoUrl: string | null;
  email: string | null;
  emailVerified: boolean;
}

/** مفاتيح الهوية القديمة في المتصفح (قبل جلسة الكوكي) */
const LEGACY_STORAGE_KEYS = ["employeeInfo", "employeeToken"];

export function clearLegacyPortalStorage(): void {
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // التخزين غير متاح (وضع خاص): لا شيء لحذفه
    }
  }
}

export function usePortalSession() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  const meQuery = trpc.employeeAuth.me.useQuery(undefined, {
    retry: shouldRetryQuery,
    staleTime: 30_000,
  });
  const me: PortalMe | null = meQuery.data ?? null;

  const logoutMutation = trpc.employeeAuth.logout.useMutation();

  /** تسجيل الخروج: يمسح الكوكي من الخادم ثم كل البيانات المخزنة مؤقتاً */
  const logout = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      return { ok: false, message: errorMessage(error, "تعذر تسجيل الخروج، حاول مرة أخرى") };
    }
    clearLegacyPortalStorage();
    // لا تبقى بيانات الموظف في ذاكرة المتصفح بعد الخروج (أجهزة مشتركة)
    queryClient.removeQueries();
    utils.employeeAuth.me.setData(undefined, null);
    navigate(PORTAL_LOGIN_PATH, { replace: true });
    return { ok: true };
  }, [logoutMutation, navigate, queryClient, utils]);

  return {
    me,
    isLoading: meQuery.isLoading,
    error: meQuery.error,
    refetch: meQuery.refetch,
    logout,
    isLoggingOut: logoutMutation.isPending,
  };
}
