"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "md" for forms, "lg" for filters/amenities, "full" for the photo viewer. */
  size?: "sm" | "md" | "lg" | "full";
  className?: string;
  hideHeader?: boolean;
}

const SIZE: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  full: "sm:max-w-none sm:h-full sm:rounded-none",
};

const EXIT_MS = 180;

/**
 * Accessible dialog: bottom sheet on phones, centred card on larger screens. Locks body scroll,
 * closes on Escape/backdrop click, restores focus, and animates in and out.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  className,
  hideHeader,
}: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  if (open && !mounted) setMounted(true);
  const closing = mounted && !open;

  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className={cn("absolute inset-0 bg-black/50", closing ? "animate-fade-out" : "animate-fade-in")}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-paper shadow-pop outline-none sm:rounded-3xl",
          SIZE[size],
          closing
            ? "animate-sheet-out sm:animate-modal-out"
            : "animate-sheet-in sm:animate-modal-in",
          className,
        )}
      >
        {!hideHeader && (
          <div className="relative flex shrink-0 items-center justify-center border-b border-line px-14 py-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full transition hover:bg-surface"
            >
              <X className="size-[18px]" />
            </button>
            {title && (
              <h2 id={titleId} className="truncate text-base font-semibold">
                {title}
              </h2>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-paper px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
