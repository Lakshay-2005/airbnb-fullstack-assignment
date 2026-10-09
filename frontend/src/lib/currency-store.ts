"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_CURRENCY, sanitizeCurrency, type CurrencyCode } from "./currency";

export const CURRENCY_KEY = "airbnb-clone.currency";

const listeners = new Set<() => void>();
let current: CurrencyCode | null = null;

/** The guest's display currency: the saved choice if it is a supported code, otherwise INR. */
export function getCurrency(): CurrencyCode {
  if (current === null) {
    try {
      current = sanitizeCurrency(window.localStorage.getItem(CURRENCY_KEY));
    } catch {
      current = DEFAULT_CURRENCY;
    }
  }
  return current;
}

export function setCurrency(code: string): void {
  const next = sanitizeCurrency(code);
  if (next === getCurrency()) return;
  current = next;
  try {
    window.localStorage.setItem(CURRENCY_KEY, next);
  } catch {
    /* storage unavailable (private mode): the choice lasts for this page view */
  }
  listeners.forEach((notify) => notify());
}

/** Reactive display currency. The server render and hydration use INR, then the saved value applies. */
export function useCurrency(): CurrencyCode {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    getCurrency,
    () => DEFAULT_CURRENCY,
  );
}
