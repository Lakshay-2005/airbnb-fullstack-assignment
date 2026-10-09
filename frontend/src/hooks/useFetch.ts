"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAbortError } from "@/lib/api";
import { useCurrency } from "@/lib/currency-store";

interface FetchState<T> {
  /** The request key the stored `data`/`error` belong to. */
  key: string | null;
  data: T | null;
  error: Error | null;
}

/**
 * Runs `fetcher` whenever `deps` (primitives) change and `enabled` is true, cancelling the previous
 * request. The last result stays available while a new request is in flight, so lists don't
 * flash empty; `loading` is derived from whether the stored result matches the current key.
 */
export function useFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  enabled = true,
) {
  const [nonce, setNonce] = useState(0);
  // Prices come back in the display currency, so every request is re-run when it changes.
  const currency = useCurrency();
  const [state, setState] = useState<FetchState<T>>({ key: null, data: null, error: null });
  const key = JSON.stringify([nonce, currency, ...deps]);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetcherRef
      .current(controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((error) => {
        if (!isAbortError(error)) setState((prev) => ({ ...prev, key, error }));
      });
    return () => controller.abort();
  }, [enabled, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (updater: (current: T | null) => T | null) =>
      setState((prev) => ({ ...prev, data: updater(prev.data) })),
    [],
  );
  const settled = state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : null,
    loading: enabled && !settled,
    reload,
    setData,
  };
}
