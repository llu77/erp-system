import { useEffect, useState } from "react";

/** قيمة تتأخر حتى يتوقف التغيير لمدة delayMs (للمعاينات الحية بدون طلب لكل ضغطة مفتاح) */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
