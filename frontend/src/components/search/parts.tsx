"use client";

import { MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { listingsApi, type Destination } from "@/lib/api";
import { useDebounced } from "@/hooks/useDebounced";
import { Counter } from "@/components/ui/Counter";
import { cn } from "@/lib/cn";

export const MAX_SEARCH_GUESTS = 16;

export interface SearchValues {
  location: string;
  check_in: string | null;
  check_out: string | null;
  guests: number;
}

export function summaryOf(values: SearchValues) {
  return {
    where: values.location || "Anywhere",
    when:
      values.check_in && values.check_out ? undefined : values.check_in ? "Add checkout" : "Any week",
    who: values.guests ? `${values.guests} guest${values.guests === 1 ? "" : "s"}` : "Add guests",
  };
}

/** Destination autocomplete list backed by the API (popular destinations when empty). */
export function DestinationList({
  query,
  onPick,
}: {
  query: string;
  onPick: (destination: Destination) => void;
}) {
  const debounced = useDebounced(query.trim(), 200);
  const [items, setItems] = useState<Destination[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listingsApi
      .destinations(debounced || undefined, { signal: controller.signal })
      .then((result) => {
        setItems(result);
        setLoaded(true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [debounced]);

  return (
    <div className="p-3">
      <p className="px-3 pb-2 pt-1 text-xs font-semibold text-muted">
        {debounced ? "Matching destinations" : "Popular destinations"}
      </p>
      <ul className="max-h-[340px] overflow-y-auto">
        {items.map((d) => (
          <li key={`${d.city}-${d.country}`}>
            <button
              type="button"
              onClick={() => onPick(d)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface">
                <MapPin className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">
                  {d.city}, {d.country}
                </span>
                <span className="block text-xs text-muted">
                  {d.count} {d.count === 1 ? "stay" : "stays"}
                </span>
              </span>
            </button>
          </li>
        ))}
        {loaded && items.length === 0 && (
          <li className="px-3 py-4 text-sm text-muted">
            No destinations match “{debounced}”. Press search to look anyway.
          </li>
        )}
      </ul>
    </div>
  );
}

export function GuestsPicker({
  guests,
  onChange,
}: {
  guests: number;
  onChange: (guests: number) => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-[15px] font-semibold">Guests</p>
          <p className="text-sm text-muted">Total number of people staying</p>
        </div>
        <Counter
          label="guests"
          value={guests}
          min={0}
          max={MAX_SEARCH_GUESTS}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

export function SearchButton({
  expanded,
  onClick,
  className,
}: {
  expanded?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      aria-label="Search stays"
      className={cn(
        "flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand font-semibold text-white transition hover:bg-brand-dark active:scale-95",
        expanded ? "h-12 px-5" : "size-12",
        className,
      )}
    >
      <Search className="size-[18px]" strokeWidth={2.5} />
      {expanded && <span>Search</span>}
    </button>
  );
}
