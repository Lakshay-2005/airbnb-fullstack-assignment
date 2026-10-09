"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { SearchValues } from "./parts";

/** Reads the active search from the URL and returns a function that navigates with new values. */
export function useSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const paramsKey = params.toString();

  const initial = useMemo<SearchValues>(
    () => ({
      location: params.get("location") ?? "",
      check_in: params.get("check_in"),
      check_out: params.get("check_out"),
      guests: Number(params.get("guests")) || 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsKey],
  );

  const submit = useCallback(
    (values: SearchValues) => {
      // Keep category/filters/sort when the guest refines their search, but restart pagination.
      const next = new URLSearchParams();
      for (const key of ["category", "min_price", "max_price", "cur", "property_type", "amenities", "min_rating", "bedrooms", "bathrooms", "sort", "quick"]) {
        const value = params.get(key);
        if (value) next.set(key, value);
      }
      if (values.location.trim()) next.set("location", values.location.trim());
      if (values.check_in && values.check_out) {
        next.set("check_in", values.check_in);
        next.set("check_out", values.check_out);
      }
      if (values.guests > 0) next.set("guests", String(values.guests));
      const query = next.toString();
      router.push(query ? `/?${query}` : "/");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paramsKey, router],
  );

  return { initial, submit, paramsKey };
}

export function useSearchDraft(initial: SearchValues) {
  const [values, setValues] = useState<SearchValues>(initial);
  const patch = useCallback((change: Partial<SearchValues>) => setValues((v) => ({ ...v, ...change })), []);
  return { values, patch, reset: () => setValues({ location: "", check_in: null, check_out: null, guests: 0 }) };
}
