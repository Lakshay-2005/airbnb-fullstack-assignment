"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/hooks/useDismiss";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  panelClassName?: string;
}

/** Click-outside / Escape dismissable panel anchored under its trigger. */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = "left",
  className,
  panelClassName,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, onClose);
  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger}
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-3 animate-pop-in rounded-3xl bg-paper shadow-pop ring-1 ring-black/5",
            align === "left" && "left-0",
            align === "right" && "right-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
