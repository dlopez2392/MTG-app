"use client";

import { useState, useCallback, useRef } from "react";

export function useToast(duration = 2000) {
  const [toast, setToast] = useState({ message: "", visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, visible: true });
    timerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, duration);
  }, [duration]);

  return { toast, showToast };
}
