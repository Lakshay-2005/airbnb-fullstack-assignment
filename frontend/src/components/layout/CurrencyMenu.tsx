"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Popover } from "@/components/ui/Popover";
import { useApp } from "@/context/AppProvider";
import { cn } from "@/lib/cn";
import { CURRENCY_CODES, currencySymbol } from "@/lib/currency";
import { setCurrency, useCurrency } from "@/lib/currency-store";

/** The supported currencies as a selectable list (used in the header popover and the account menu). */
export function CurrencyList({ onPick, className }: { onPick?: () => void; className?: string }) {
  const { currencyTable } = useApp();
  const selected = useCurrency();
  // The server's table is the source of truth; before it loads the built-in list of codes is shown.
  const entries =
    currencyTable?.currencies.map((c) => ({ code: c.code, name: c.name })) ??
    CURRENCY_CODES.map((code) => ({ code: code as string, name: "" }));

  return (
    <div className={className}>
      <ul role="listbox" aria-label="Display currency" className="max-h-[26rem] overflow-y-auto p-1.5">
        {entries.map(({ code, name }) => {
          const active = code === selected;
          return (
            <li key={code} role="option" aria-selected={active}>
              <button
                type="button"
                onClick={() => {
                  setCurrency(code);
                  onPick?.();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-surface",
                  active && "bg-surface font-semibold",
                )}
              >
                <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-surface px-1 text-sm font-semibold ring-1 ring-line">
                  {currencySymbol(code)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-tight">{code}</span>
                  {name && <span className="block truncate text-xs font-normal text-muted">{name}</span>}
                </span>
                {active && <Check className="size-4 text-success" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-4 py-2.5 text-[11px] leading-snug text-muted">
        Converted with illustrative demo exchange rates, not live rates. Mock checkout: no money is charged.
      </p>
    </div>
  );
}

/** Compact currency button for the header (desktop). */
export function CurrencyButton() {
  const code = useCurrency();
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      panelClassName="w-[300px]"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Display currency: ${code}. Change currency`}
          className={cn(
            "flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition-colors duration-150 hover:bg-black/5 active:scale-95 dark:hover:bg-white/10",
            open && "bg-black/5 dark:bg-white/10",
          )}
        >
          <span aria-hidden="true">{currencySymbol(code)}</span>
          <span className="hidden lg:inline">{code}</span>
          <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </button>
      }
    >
      <CurrencyList onPick={() => setOpen(false)} />
    </Popover>
  );
}
