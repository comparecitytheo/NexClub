import { useEffect, useState } from "react";

// Returns `value` delayed by `delay` ms. Used to debounce search inputs so the
// field updates instantly while filtering only runs once typing settles.
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
