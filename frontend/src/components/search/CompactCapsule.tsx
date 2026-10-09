"use client";

import { Search } from "lucide-react";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { formatRange } from "@/lib/dates";
import type { SearchSegment } from "./SearchBar";
import { summaryOf } from "./parts";
import { useSearch } from "./useSearch";

/**
 * The slim "Anywhere | Any week | Add guests" capsule shown in the desktop header whenever the full
 * search is not on screen. Each part re-opens the full search at the matching segment.
 */
export function CompactCapsule({
  onOpen,
  className,
}: {
  onOpen: (segment: SearchSegment) => void;
  className?: string;
}) {
  return (
    <Suspense fallback={<div className="skeleton h-12 w-[340px] rounded-full" aria-hidden="true" />}>
      <CapsuleInner onOpen={onOpen} className={className} />
    </Suspense>
  );
}

function CapsuleInner({ onOpen, className }: { onOpen: (segment: SearchSegment) => void; className?: string }) {
  const { initial } = useSearch();
  const summary = summaryOf(initial);
  const when =
    initial.check_in && initial.check_out ? formatRange(initial.check_in, initial.check_out) : summary.when;

  const part =
    "h-full truncate px-4 text-sm font-medium transition-colors hover:bg-surface active:bg-line";
  return (
    <div
      role="group"
      aria-label="Search summary. Select a part to edit your search"
      className={cn(
        "flex h-12 items-center rounded-full border border-line bg-paper pl-2 pr-2 shadow-search transition-shadow duration-200 hover:shadow-search-hover",
        className,
      )}
    >
      <button type="button" onClick={() => onOpen("where")} className={cn(part, "max-w-[150px] rounded-l-full pl-4")}>
        {summary.where}
      </button>
      <span className="h-6 w-px shrink-0 bg-line" />
      <button type="button" onClick={() => onOpen("when")} className={part}>
        {when}
      </button>
      <span className="h-6 w-px shrink-0 bg-line" />
      <button type="button" onClick={() => onOpen("who")} className={cn(part, "font-normal text-muted")}>
        {summary.who}
      </button>
      <button
        type="button"
        onClick={() => onOpen("where")}
        aria-label="Edit search"
        className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-dark active:scale-95"
      >
        <Search className="size-4" strokeWidth={2.75} />
      </button>
    </div>
  );
}
