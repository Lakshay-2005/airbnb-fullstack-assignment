"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Removes every visible toast (e.g. a stale error once the retry succeeded). */
  clear: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: <CheckCircle2 className="size-5 shrink-0 text-[#4ade80] dark:text-[#15803d]" />,
  error: <AlertCircle className="size-5 shrink-0 text-[#fb7185] dark:text-[#e11d48]" />,
  info: <Info className="size-5 shrink-0 text-[#93c5fd] dark:text-[#2563eb]" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setItems((all) => [...all.slice(-2), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 6000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
      info: (m) => push("info", m),
      clear: () => setItems([]),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[200] flex flex-col items-center gap-2 px-4 md:bottom-6 print:hidden"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-md animate-toast-in items-start gap-3 rounded-2xl bg-ink px-4 py-3.5 text-sm font-medium text-on-ink shadow-pop"
          >
            {ICONS[item.kind]}
            <p className="flex-1 leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="-mr-1 rounded-full p-0.5 text-on-ink/70 transition hover:text-on-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
