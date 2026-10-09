"use client";

import { X } from "lucide-react";
import { Suspense, useId, useRef, useState } from "react";
import { RangeCalendar } from "@/components/calendar/RangeCalendar";
import { useDismiss } from "@/hooks/useDismiss";
import { cn } from "@/lib/cn";
import { formatRange, formatShort } from "@/lib/dates";
import { useToast } from "@/components/ui/Toast";
import { DestinationList, GuestsPicker, SearchButton, type SearchValues } from "./parts";
import { useSearch, useSearchDraft } from "./useSearch";

export type SearchSegment = "where" | "when" | "who";

/** Lets the compact (scrolled) capsule ask the expanded bar to open a particular segment. */
export interface SegmentRequest {
  segment: SearchSegment;
  token: number;
}

/** Desktop segmented search pill: Where | When | Who. Updates the URL. */
export function SearchBar({ request }: { request?: SegmentRequest | null }) {
  return (
    <Suspense fallback={<div className="skeleton mx-auto h-16 w-full max-w-[850px] rounded-full" aria-hidden="true" />}>
      <SearchBarInner request={request} />
    </Suspense>
  );
}

function SearchBarInner({ request }: { request?: SegmentRequest | null }) {
  const { initial, submit, paramsKey } = useSearch();
  // Remount with fresh draft state whenever the URL (the source of truth) changes.
  return <SearchBarForm key={paramsKey} initial={initial} onSubmit={submit} request={request} />;
}

function SearchBarForm({
  initial,
  onSubmit,
  request,
}: {
  initial: SearchValues;
  onSubmit: (values: SearchValues) => void;
  request?: SegmentRequest | null;
}) {
  const toast = useToast();
  const whereId = `${useId()}-where`; // the header can mount two bars (in-page + peek overlay)
  const { values, patch } = useSearchDraft(initial);
  const [active, setActive] = useState<SearchSegment | null>(request?.segment ?? null);
  const [seenToken, setSeenToken] = useState(request?.token ?? 0);
  if (request && request.token !== seenToken) {
    setSeenToken(request.token);
    setActive(request.segment);
  }
  const ref = useRef<HTMLFormElement>(null);
  useDismiss(ref, active !== null, () => setActive(null));

  const run = () => {
    setActive(null);
    onSubmit(values);
  };

  const segment = (id: SearchSegment) =>
    cn(
      "relative flex h-full min-w-0 flex-col justify-center rounded-full px-7 text-left outline-offset-[-2px] transition-[background-color,box-shadow] duration-150",
      active === id ? "bg-paper shadow-pop" : "hover:bg-hover active:bg-press",
    );

  const divider = (hidden: boolean) =>
    cn("h-8 w-px shrink-0 bg-line transition-opacity", hidden && "opacity-0");

  const when =
    values.check_in && values.check_out
      ? formatRange(values.check_in, values.check_out)
      : values.check_in
        ? `${formatShort(values.check_in)} – add checkout`
        : null;

  return (
    <form
      ref={ref}
      role="search"
      aria-label="Search stays"
      onSubmit={(event) => {
        event.preventDefault();
        run();
      }}
      className={cn(
        "relative mx-auto flex h-16 w-full max-w-[850px] items-center rounded-full border pr-2 transition-[background-color,box-shadow] duration-200",
        active
          ? "border-transparent bg-hover shadow-search"
          : "border-line bg-paper shadow-search hover:shadow-search-hover",
      )}
    >
      <div className={cn(segment("where"), "flex-[1.25] cursor-pointer")} onClick={() => setActive("where")}>
        <label htmlFor={whereId} className="cursor-pointer text-xs font-semibold">
          Where
        </label>
        <input
          id={whereId}
          value={values.location}
          onChange={(e) => patch({ location: e.target.value })}
          onFocus={() => setActive("where")}
          placeholder="Search destinations"
          autoComplete="off"
          autoFocus={request?.segment === "where"}
          className="w-full truncate bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        {values.location && active === "where" && (
          <button
            type="button"
            aria-label="Clear destination"
            onClick={(e) => {
              e.stopPropagation();
              patch({ location: "" });
            }}
            className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-line transition hover:bg-press"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <span className={divider(active === "where" || active === "when")} />

      <button type="button" className={cn(segment("when"), "flex-1")} onClick={() => setActive("when")}>
        <span className="text-xs font-semibold">When</span>
        <span className={cn("truncate text-sm", when ? "text-ink" : "text-muted")}>{when ?? "Add dates"}</span>
      </button>
      <span className={divider(active === "when" || active === "who")} />

      <button type="button" className={cn(segment("who"), "flex-1")} onClick={() => setActive("who")}>
        <span className="text-xs font-semibold">Who</span>
        <span className={cn("truncate text-sm", values.guests ? "text-ink" : "text-muted")}>
          {values.guests ? `${values.guests} guest${values.guests === 1 ? "" : "s"}` : "Add guests"}
        </span>
      </button>
      <SearchButton expanded={active !== null} />

      {active === "where" && (
        <div className="absolute left-0 top-full z-50 mt-3 w-[400px] animate-pop-in rounded-3xl bg-paper shadow-pop">
          <DestinationList
            query={values.location}
            onPick={(d) => {
              patch({ location: d.city });
              setActive("when");
            }}
          />
        </div>
      )}
      {active === "when" && (
        <div className="absolute left-1/2 top-full z-50 mt-3 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-pop-in rounded-3xl bg-paper p-6 shadow-pop">
          <RangeCalendar
            checkIn={values.check_in}
            checkOut={values.check_out}
            onInvalid={toast.error}
            onChange={(check_in, check_out) => {
              patch({ check_in, check_out });
              if (check_in && check_out) setActive("who");
            }}
          />
          {(values.check_in || values.check_out) && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => patch({ check_in: null, check_out: null })}
                className="text-sm font-semibold underline"
              >
                Clear dates
              </button>
            </div>
          )}
        </div>
      )}
      {active === "who" && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[380px] animate-pop-in rounded-3xl bg-paper shadow-pop">
          <GuestsPicker guests={values.guests} onChange={(guests) => patch({ guests })} />
        </div>
      )}
    </form>
  );
}
