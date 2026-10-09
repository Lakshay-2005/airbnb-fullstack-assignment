"use client";

import { BadgeDollarSign, House, LayoutGrid, Star, type LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { parseQuick, QUICK_FILTERS, type QuickFilterId } from "@/lib/quick-filters";

type TabId = "all" | QuickFilterId;

const TABS: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: "all", label: "All", Icon: LayoutGrid },
  { id: "homes", label: QUICK_FILTERS.homes.label, Icon: House },
  { id: "top-rated", label: QUICK_FILTERS["top-rated"].label, Icon: Star },
  { id: "budget", label: QUICK_FILTERS.budget.label, Icon: BadgeDollarSign },
];

/**
 * Top navigation quick filters. Every tab changes the results: "All" clears the quick filter,
 * the others add `?quick=` to the current search (destination, dates and filters are kept).
 * The selected tab is derived from the URL, so it is always in sync with what is on screen.
 */
export function ProductTabs({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Suspense fallback={<Skeleton className={cn("h-11 w-80 rounded-full", className)} />}>
      <Tabs className={className} compact={compact} />
    </Suspense>
  );
}

function Tabs({ className, compact }: { className?: string; compact?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const selected: TabId = parseQuick(params.get("quick")) ?? "all";

  const choose = (id: TabId) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (id === "all") next.delete("quick");
    else next.set("quick", id);
    const query = next.toString();
    router.push(query ? `/?${query}` : "/", { scroll: false });
  };

  return (
    <div
      role="tablist"
      aria-label="Quick filters"
      className={cn("flex items-center", compact ? "gap-4" : "gap-1", className)}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = selected === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => choose(id)}
            className={cn(
              "relative flex h-11 items-center gap-2 whitespace-nowrap rounded-full text-sm transition-colors duration-150",
              compact ? "px-0.5" : "px-4 hover:bg-black/5",
              active ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink",
            )}
          >
            <Icon className={cn(compact ? "size-4" : "size-[18px]")} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
            {label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute -bottom-px h-0.5 rounded-full bg-ink transition-transform duration-200",
                compact ? "inset-x-0" : "inset-x-3",
                active ? "scale-x-100" : "scale-x-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
