"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CATEGORY_ICONS } from "@/lib/icons";
import { Skeleton } from "@/components/ui/Skeleton";

interface CategoryBarProps {
  categories: { id: string; label: string }[] | undefined;
  selected: string | undefined;
  onSelect: (category: string | undefined) => void;
  filterCount: number;
  onOpenFilters: () => void;
}

export function CategoryBar({ categories, selected, onSelect, filterCount, onOpenFilters }: CategoryBarProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, categories]);

  const scrollBy = (direction: -1 | 1) =>
    scroller.current?.scrollBy({ left: direction * 360, behavior: "smooth" });

  const arrow = (side: "left" | "right", hidden: boolean) =>
    cn(
      "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper shadow-sm transition hover:scale-105 hover:shadow-md md:flex",
      side === "left" ? "left-0" : "right-0",
      hidden && "pointer-events-none opacity-0",
    );

  return (
    <div className="sticky top-[70px] z-30 border-b border-line bg-paper md:top-20">
      <div className="container-page flex items-center gap-4 py-3">
        <div className="relative min-w-0 flex-1">
          <button type="button" aria-label="Scroll categories left" onClick={() => scrollBy(-1)} className={arrow("left", edges.start)}>
            <ChevronLeft className="size-4" />
          </button>
          <div
            ref={scroller}
            onScroll={measure}
            role="tablist"
            aria-label="Browse by category"
            className={cn(
              "no-scrollbar flex gap-8 overflow-x-auto scroll-smooth transition-[mask-position] md:px-1",
              // Soft fade on the side(s) where more categories continue.
              !edges.start && !edges.end && "[mask-image:linear-gradient(to_right,transparent,#000_36px,#000_calc(100%-36px),transparent)]",
              !edges.start && edges.end && "[mask-image:linear-gradient(to_right,transparent,#000_36px)]",
              edges.start && !edges.end && "[mask-image:linear-gradient(to_right,#000_calc(100%-36px),transparent)]",
            )}
          >
            {categories
              ? categories.map(({ id, label }) => {
                  const Icon = CATEGORY_ICONS[id];
                  const active = selected === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => onSelect(active ? undefined : id)}
                      className={cn(
                        "group flex shrink-0 flex-col items-center gap-2 border-b-2 pb-2.5 pt-1 text-xs font-medium transition",
                        active
                          ? "border-ink text-ink"
                          : "border-transparent text-muted hover:border-edge hover:text-ink",
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={cn("size-6 transition-transform group-hover:scale-110", active && "scale-110")}
                          strokeWidth={active ? 2 : 1.6}
                        />
                      )}
                      <span className="whitespace-nowrap">{label}</span>
                    </button>
                  );
                })
              : Array.from({ length: 9 }, (_, i) => (
                  <div key={i} className="flex shrink-0 flex-col items-center gap-2 pb-3 pt-1">
                    <Skeleton className="size-6" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
          </div>
          <button type="button" aria-label="Scroll categories right" onClick={() => scrollBy(1)} className={arrow("right", edges.end)}>
            <ChevronRight className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenFilters}
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition hover:border-ink hover:bg-surface",
            filterCount ? "border-ink" : "border-edge",
          )}
        >
          <SlidersHorizontal className="size-4" />
          <span className="hidden xs:inline">Filters</span>
          {filterCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-on-ink">
              {filterCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
