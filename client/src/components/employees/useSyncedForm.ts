import { useCallback, useEffect, useRef, useState } from "react";

function sameValues<T extends object>(a: T, b: T): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Array.from(keys).every(
    k => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k]
  );
}

/**
 * نموذج مرتبط ببيانات الخادم: يُحدَّث تلقائياً عند وصول بيانات جديدة
 * ما لم يكن المستخدم قد عدّل فيه (حتى لا تضيع التعديلات غير المحفوظة عند إعادة الجلب).
 * بعد الحفظ تُستدعى acceptNext() لتحل القيم المحفوظة (بعد توحيدها في الخادم) محل النموذج.
 */
export function useSyncedForm<T extends object>(source: T | null) {
  const [form, setForm] = useState<T | null>(source);
  const baseline = useRef<T | null>(source);
  const forceNext = useRef(false);

  useEffect(() => {
    if (!source) return;
    const force = forceNext.current;
    const previous = baseline.current;
    forceNext.current = false;
    baseline.current = source;
    setForm(current => {
      const untouched =
        current === null || previous === null || sameValues(current, previous);
      return force || untouched ? source : current;
    });
  }, [source]);

  const update = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setForm(current => (current ? { ...current, [key]: value } : current));
  }, []);

  const reset = useCallback(() => setForm(baseline.current), []);

  const acceptNext = useCallback(() => {
    forceNext.current = true;
  }, []);

  const dirty =
    !!form && !!baseline.current && !sameValues(form, baseline.current);

  return { form, update, reset, acceptNext, dirty, baseline: baseline.current };
}
